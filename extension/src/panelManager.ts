import * as vscode from 'vscode';
import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { ProcessManager } from './processManager';

export type PanelMode = 'development' | 'production';
export type PanelState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

export interface PanelConfig {
  port: number;
  autoStart: boolean;
  mode: PanelMode;
}

export interface PanelManagerCallbacks {
  onStateChange: (state: PanelState, error?: string) => void;
  onOutput: (line: string, isError: boolean) => void;
}

/**
 * Singleton manager for the Next.js web panel lifecycle
 * Handles development mode (npm run dev) and production mode (static serving)
 */
export class PanelManager {
  private static instance: PanelManager;
  private context: vscode.ExtensionContext;
  private processManager: ProcessManager;

  // State
  private state: PanelState = 'stopped';
  private panelProcess: ChildProcess | null = null;
  private currentPort: number = 3001;
  private currentMode: PanelMode = 'development';

  // VS Code integration
  private outputChannel: vscode.OutputChannel;
  private statusBarItem: vscode.StatusBarItem;

  // Callbacks
  private callbacks: PanelManagerCallbacks | null = null;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.processManager = ProcessManager.getInstance(context);

    // Create Output Channel
    this.outputChannel = vscode.window.createOutputChannel('AI App Builder Panel');
    context.subscriptions.push(this.outputChannel);

    // Create Status Bar Item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'aiAppBuilder.panelQuickActions';
    context.subscriptions.push(this.statusBarItem);

    // Register cleanup
    this.processManager.registerCleanup(async () => {
      await this.stop();
    });

    this.updateStatusBar();
  }

  public static getInstance(context: vscode.ExtensionContext): PanelManager {
    if (!PanelManager.instance) {
      PanelManager.instance = new PanelManager(context);
    }
    return PanelManager.instance;
  }

  public setCallbacks(callbacks: PanelManagerCallbacks): void {
    this.callbacks = callbacks;
  }

  public getState(): PanelState {
    return this.state;
  }

  public getPort(): number {
    return this.currentPort;
  }

  public getMode(): PanelMode {
    return this.currentMode;
  }

  /**
   * Start the panel in the configured mode
   */
  public async start(): Promise<void> {
    if (this.state === 'running' || this.state === 'starting') {
      this.log('Panel already running or starting');
      return;
    }

    const config = this.getConfig();
    this.currentMode = config.mode;

    this.setState('starting');
    this.log(`Starting panel in ${config.mode} mode...`);

    try {
      // Reserve port
      this.currentPort = await this.processManager.reservePort(config.port, true);
      this.log(`Port ${this.currentPort} reserved`);

      if (config.mode === 'development') {
        await this.startDevMode();
      } else {
        await this.startProductionMode();
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log(`Error starting panel: ${errorMsg}`, true);
      this.setState('error', errorMsg);
      throw error;
    }
  }

  /**
   * Stop the panel
   */
  public async stop(): Promise<void> {
    if (this.state === 'stopped' || this.state === 'stopping') {
      return;
    }

    this.setState('stopping');
    this.log('Stopping panel...');

    if (this.panelProcess) {
      try {
        this.panelProcess.kill('SIGTERM');

        // Force kill after 5 seconds
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            if (this.panelProcess && !this.panelProcess.killed) {
              this.panelProcess.kill('SIGKILL');
            }
            resolve();
          }, 5000);

          this.panelProcess?.on('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      } catch (error) {
        this.log(`Error killing panel process: ${error}`, true);
      }

      this.panelProcess = null;
    }

    // Free port
    await this.processManager.freePort(this.currentPort, true);

    this.setState('stopped');
    this.log('Panel stopped');
  }

  /**
   * Restart the panel
   */
  public async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /**
   * Show the output channel
   */
  public showLogs(): void {
    this.outputChannel.show(true);
  }

  /**
   * Clear the output channel
   */
  public clearLogs(): void {
    this.outputChannel.clear();
    this.log('Logs cleared');
  }

  /**
   * Get panel URL
   */
  public getUrl(): string {
    return `http://localhost:${this.currentPort}`;
  }

  // ============== Private Methods ==============

  private async startDevMode(): Promise<void> {
    const wwwPath = this.getWwwPath();

    if (!fs.existsSync(wwwPath)) {
      throw new Error(`Panel directory not found: ${wwwPath}`);
    }

    // Check for node_modules
    const nodeModulesPath = path.join(wwwPath, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      this.log('Installing dependencies...');
      await this.runInstall(wwwPath);
    }

    // Detect package manager
    const hasBunLock = fs.existsSync(path.join(wwwPath, 'bun.lock')) ||
                       fs.existsSync(path.join(wwwPath, 'bun.lockb'));
    const hasPnpmLock = fs.existsSync(path.join(wwwPath, 'pnpm-lock.yaml'));
    const hasYarnLock = fs.existsSync(path.join(wwwPath, 'yarn.lock'));

    const homeDir = process.env.HOME || '/Users/moneyprinter';
    let command: string;
    let args: string[];

    if (hasBunLock) {
      command = `${homeDir}/.bun/bin/bun`;
      args = ['run', 'dev', '--port', String(this.currentPort)];
    } else if (hasPnpmLock) {
      command = 'pnpm';
      args = ['dev', '--port', String(this.currentPort)];
    } else if (hasYarnLock) {
      command = 'yarn';
      args = ['dev', '--port', String(this.currentPort)];
    } else {
      command = 'npm';
      args = ['run', 'dev', '--', '--port', String(this.currentPort)];
    }

    this.log(`Running: ${command} ${args.join(' ')}`);
    this.log(`Working directory: ${wwwPath}`);

    const enhancedPath = this.getEnhancedPath(wwwPath);

    this.panelProcess = spawn(command, args, {
      cwd: wwwPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: String(this.currentPort),
        PATH: enhancedPath,
        HOME: homeDir
      },
      shell: true
    });

    let isReady = false;

    this.panelProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      this.log(output.trim());

      if (!isReady && this.isReadyMessage(output)) {
        isReady = true;
        this.setState('running');
        this.log(`Panel ready at ${this.getUrl()}`);

        vscode.window.showInformationMessage(
          `AI App Builder Panel running at ${this.getUrl()}`,
          'Open Panel'
        ).then(selection => {
          if (selection === 'Open Panel') {
            vscode.commands.executeCommand('aiAppBuilder.openPanel');
          }
        });
      }
    });

    this.panelProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      // Next.js logs many things to stderr that aren't errors
      this.log(output.trim());

      if (!isReady && this.isReadyMessage(output)) {
        isReady = true;
        this.setState('running');
      }
    });

    this.panelProcess.on('error', (error) => {
      this.log(`Process error: ${error.message}`, true);
      this.setState('error', error.message);
    });

    this.panelProcess.on('exit', (code) => {
      this.log(`Process exited with code ${code}`);
      if (this.state !== 'stopping') {
        this.setState(code === 0 ? 'stopped' : 'error', code !== 0 ? `Exited with code ${code}` : undefined);
      } else {
        this.setState('stopped');
      }
      this.panelProcess = null;
    });

    // Timeout fallback - assume ready after 20s if no "Ready" message detected
    setTimeout(() => {
      if (!isReady && this.state === 'starting') {
        this.setState('running');
        this.log('Panel assumed ready (timeout fallback)');
      }
    }, 20000);
  }

  private async startProductionMode(): Promise<void> {
    const wwwPath = this.getWwwPath();
    const nextBuildPath = path.join(wwwPath, '.next');

    if (!fs.existsSync(nextBuildPath)) {
      this.log('Production build not found, building...');
      await this.runBuild(wwwPath);
    }

    // In production mode, run `next start`
    const hasBunLock = fs.existsSync(path.join(wwwPath, 'bun.lock')) ||
                       fs.existsSync(path.join(wwwPath, 'bun.lockb'));
    const homeDir = process.env.HOME || '/Users/moneyprinter';

    let command: string;
    let args: string[];

    if (hasBunLock) {
      command = `${homeDir}/.bun/bin/bun`;
      args = ['run', 'start', '--port', String(this.currentPort)];
    } else {
      command = 'npm';
      args = ['run', 'start', '--', '--port', String(this.currentPort)];
    }

    this.log(`Running: ${command} ${args.join(' ')}`);

    const enhancedPath = this.getEnhancedPath(wwwPath);

    this.panelProcess = spawn(command, args, {
      cwd: wwwPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: String(this.currentPort),
        PATH: enhancedPath,
        HOME: homeDir
      },
      shell: true
    });

    let isReady = false;

    this.panelProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      this.log(output.trim());

      if (!isReady && this.isReadyMessage(output)) {
        isReady = true;
        this.setState('running');
        this.log(`Panel ready at ${this.getUrl()}`);
      }
    });

    this.panelProcess.stderr?.on('data', (data: Buffer) => {
      this.log(data.toString().trim());
    });

    this.panelProcess.on('error', (error) => {
      this.log(`Process error: ${error.message}`, true);
      this.setState('error', error.message);
    });

    this.panelProcess.on('exit', (code) => {
      this.log(`Process exited with code ${code}`);
      if (this.state !== 'stopping') {
        this.setState(code === 0 ? 'stopped' : 'error');
      } else {
        this.setState('stopped');
      }
      this.panelProcess = null;
    });

    // Timeout fallback
    setTimeout(() => {
      if (!isReady && this.state === 'starting') {
        this.setState('running');
        this.log('Panel assumed ready (timeout fallback)');
      }
    }, 15000);
  }

  private async runInstall(wwwPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const hasBunLock = fs.existsSync(path.join(wwwPath, 'bun.lock')) ||
                         fs.existsSync(path.join(wwwPath, 'bun.lockb'));
      const homeDir = process.env.HOME || '/Users/moneyprinter';

      const command = hasBunLock ? `${homeDir}/.bun/bin/bun` : 'npm';
      const args = ['install'];

      this.log(`Installing dependencies with ${command}...`);

      const installProcess = spawn(command, args, {
        cwd: wwwPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
        env: {
          ...process.env,
          PATH: this.getEnhancedPath(wwwPath),
          HOME: homeDir
        }
      });

      installProcess.stdout?.on('data', (data) => this.log(data.toString().trim()));
      installProcess.stderr?.on('data', (data) => this.log(data.toString().trim()));

      installProcess.on('exit', (code) => {
        if (code === 0) {
          this.log('Dependencies installed successfully');
          resolve();
        } else {
          reject(new Error(`Install failed with code ${code}`));
        }
      });

      installProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async runBuild(wwwPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const hasBunLock = fs.existsSync(path.join(wwwPath, 'bun.lock')) ||
                         fs.existsSync(path.join(wwwPath, 'bun.lockb'));
      const homeDir = process.env.HOME || '/Users/moneyprinter';

      const command = hasBunLock ? `${homeDir}/.bun/bin/bun` : 'npm';
      const args = ['run', 'build'];

      this.log(`Building panel with ${command}...`);

      const buildProcess = spawn(command, args, {
        cwd: wwwPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
        env: {
          ...process.env,
          PATH: this.getEnhancedPath(wwwPath),
          HOME: homeDir
        }
      });

      buildProcess.stdout?.on('data', (data) => this.log(data.toString().trim()));
      buildProcess.stderr?.on('data', (data) => this.log(data.toString().trim()));

      buildProcess.on('exit', (code) => {
        if (code === 0) {
          this.log('Build completed successfully');
          resolve();
        } else {
          reject(new Error(`Build failed with code ${code}`));
        }
      });

      buildProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  private getWwwPath(): string {
    // Get the extension's installation path
    const extensionPath = this.context.extensionPath;
    // www/ is a sibling to extension/
    return path.join(extensionPath, '..', 'www');
  }

  private getEnhancedPath(projectPath: string): string {
    const homeDir = process.env.HOME || '/Users/moneyprinter';
    const additionalPaths = [
      path.join(projectPath, 'node_modules', '.bin'),
      '/opt/homebrew/bin',
      '/usr/local/bin',
      '/usr/bin',
      `${homeDir}/.bun/bin`,
      `${homeDir}/.nvm/versions/node/current/bin`,
      `${homeDir}/.local/bin`,
    ].join(':');

    return `${additionalPaths}:${process.env.PATH || ''}`;
  }

  private isReadyMessage(output: string): boolean {
    return output.includes('Ready') ||
           output.includes('started server') ||
           output.includes(`localhost:${this.currentPort}`) ||
           output.includes('Local:') ||
           output.includes('listening on');
  }

  private getConfig(): PanelConfig {
    const config = vscode.workspace.getConfiguration('aiAppBuilder');
    return {
      port: config.get<number>('panelPort', 3001),
      autoStart: config.get<boolean>('panelAutoStart', true),
      mode: config.get<PanelMode>('panelMode', 'development')
    };
  }

  private setState(state: PanelState, error?: string): void {
    this.state = state;
    this.updateStatusBar();
    this.callbacks?.onStateChange(state, error);
  }

  private log(message: string, isError: boolean = false): void {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = isError ? '[ERROR]' : '[INFO]';
    const line = `[${timestamp}] ${prefix} ${message}`;

    this.outputChannel.appendLine(line);
    this.callbacks?.onOutput(line, isError);

    if (isError) {
      console.error(`[PanelManager] ${message}`);
    } else {
      console.log(`[PanelManager] ${message}`);
    }
  }

  private updateStatusBar(): void {
    const icons: Record<PanelState, string> = {
      stopped: '$(circle-outline)',
      starting: '$(loading~spin)',
      running: '$(circle-filled)',
      stopping: '$(loading~spin)',
      error: '$(error)'
    };

    const tooltips: Record<PanelState, string> = {
      stopped: 'Panel stopped - Click to start',
      starting: 'Panel starting...',
      running: `Panel running at localhost:${this.currentPort} - Click for options`,
      stopping: 'Panel stopping...',
      error: 'Panel error - Click to retry'
    };

    this.statusBarItem.text = `${icons[this.state]} Panel`;
    this.statusBarItem.tooltip = tooltips[this.state];

    // Set background color based on state
    if (this.state === 'error') {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (this.state === 'starting' || this.state === 'stopping') {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.statusBarItem.backgroundColor = undefined;
    }

    this.statusBarItem.show();
  }

  public dispose(): void {
    this.stop();
    this.outputChannel.dispose();
    this.statusBarItem.dispose();
  }
}
