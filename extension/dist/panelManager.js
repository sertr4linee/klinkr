"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PanelManager = void 0;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const processManager_1 = require("./processManager");
/**
 * Singleton manager for the Next.js web panel lifecycle
 * Handles development mode (npm run dev) and production mode (static serving)
 */
class PanelManager {
    static instance;
    context;
    processManager;
    // State
    state = 'stopped';
    panelProcess = null;
    currentPort = 3001;
    currentMode = 'development';
    // VS Code integration
    outputChannel;
    statusBarItem;
    // Callbacks
    callbacks = null;
    constructor(context) {
        this.context = context;
        this.processManager = processManager_1.ProcessManager.getInstance(context);
        // Create Output Channel
        this.outputChannel = vscode.window.createOutputChannel('AI App Builder Panel');
        context.subscriptions.push(this.outputChannel);
        // Create Status Bar Item
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'aiAppBuilder.panelQuickActions';
        context.subscriptions.push(this.statusBarItem);
        // Register cleanup
        this.processManager.registerCleanup(async () => {
            await this.stop();
        });
        this.updateStatusBar();
    }
    static getInstance(context) {
        if (!PanelManager.instance) {
            PanelManager.instance = new PanelManager(context);
        }
        return PanelManager.instance;
    }
    setCallbacks(callbacks) {
        this.callbacks = callbacks;
    }
    getState() {
        return this.state;
    }
    getPort() {
        return this.currentPort;
    }
    getMode() {
        return this.currentMode;
    }
    /**
     * Start the panel in the configured mode
     */
    async start() {
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
            }
            else {
                await this.startProductionMode();
            }
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.log(`Error starting panel: ${errorMsg}`, true);
            this.setState('error', errorMsg);
            throw error;
        }
    }
    /**
     * Stop the panel
     */
    async stop() {
        if (this.state === 'stopped' || this.state === 'stopping') {
            return;
        }
        this.setState('stopping');
        this.log('Stopping panel...');
        if (this.panelProcess) {
            try {
                this.panelProcess.kill('SIGTERM');
                // Force kill after 5 seconds
                await new Promise((resolve) => {
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
            }
            catch (error) {
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
    async restart() {
        await this.stop();
        await this.start();
    }
    /**
     * Show the output channel
     */
    showLogs() {
        this.outputChannel.show(true);
    }
    /**
     * Clear the output channel
     */
    clearLogs() {
        this.outputChannel.clear();
        this.log('Logs cleared');
    }
    /**
     * Get panel URL
     */
    getUrl() {
        return `http://localhost:${this.currentPort}`;
    }
    // ============== Private Methods ==============
    async startDevMode() {
        const wwwPath = this.getWwwPath();
        this.log(`Extension path: ${this.context.extensionPath}`);
        this.log(`Calculated www path: ${wwwPath}`);
        if (!fs.existsSync(wwwPath)) {
            throw new Error(`Panel directory not found: ${wwwPath}`);
        }
        this.log(`www directory found!`);
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
        let command;
        let args;
        if (hasBunLock) {
            command = `${homeDir}/.bun/bin/bun`;
            args = ['run', 'dev', '--port', String(this.currentPort)];
        }
        else if (hasPnpmLock) {
            command = 'pnpm';
            args = ['dev', '--port', String(this.currentPort)];
        }
        else if (hasYarnLock) {
            command = 'yarn';
            args = ['dev', '--port', String(this.currentPort)];
        }
        else {
            command = 'npm';
            args = ['run', 'dev', '--', '--port', String(this.currentPort)];
        }
        this.log(`Running: ${command} ${args.join(' ')}`);
        this.log(`Working directory: ${wwwPath}`);
        const enhancedPath = this.getEnhancedPath(wwwPath);
        this.panelProcess = (0, child_process_1.spawn)(command, args, {
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
        this.panelProcess.stdout?.on('data', (data) => {
            const output = data.toString();
            this.log(output.trim());
            if (!isReady && this.isReadyMessage(output)) {
                isReady = true;
                this.setState('running');
                this.log(`Panel ready at ${this.getUrl()}`);
                vscode.window.showInformationMessage(`AI App Builder Panel running at ${this.getUrl()}`, 'Open Panel').then(selection => {
                    if (selection === 'Open Panel') {
                        vscode.commands.executeCommand('aiAppBuilder.openPanel');
                    }
                });
            }
        });
        this.panelProcess.stderr?.on('data', (data) => {
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
            }
            else {
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
    async startProductionMode() {
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
        let command;
        let args;
        if (hasBunLock) {
            command = `${homeDir}/.bun/bin/bun`;
            args = ['run', 'start', '--port', String(this.currentPort)];
        }
        else {
            command = 'npm';
            args = ['run', 'start', '--', '--port', String(this.currentPort)];
        }
        this.log(`Running: ${command} ${args.join(' ')}`);
        const enhancedPath = this.getEnhancedPath(wwwPath);
        this.panelProcess = (0, child_process_1.spawn)(command, args, {
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
        this.panelProcess.stdout?.on('data', (data) => {
            const output = data.toString();
            this.log(output.trim());
            if (!isReady && this.isReadyMessage(output)) {
                isReady = true;
                this.setState('running');
                this.log(`Panel ready at ${this.getUrl()}`);
            }
        });
        this.panelProcess.stderr?.on('data', (data) => {
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
            }
            else {
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
    async runInstall(wwwPath) {
        return new Promise((resolve, reject) => {
            const hasBunLock = fs.existsSync(path.join(wwwPath, 'bun.lock')) ||
                fs.existsSync(path.join(wwwPath, 'bun.lockb'));
            const homeDir = process.env.HOME || '/Users/moneyprinter';
            const command = hasBunLock ? `${homeDir}/.bun/bin/bun` : 'npm';
            const args = ['install'];
            this.log(`Installing dependencies with ${command}...`);
            const installProcess = (0, child_process_1.spawn)(command, args, {
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
                }
                else {
                    reject(new Error(`Install failed with code ${code}`));
                }
            });
            installProcess.on('error', (error) => {
                reject(error);
            });
        });
    }
    async runBuild(wwwPath) {
        return new Promise((resolve, reject) => {
            const hasBunLock = fs.existsSync(path.join(wwwPath, 'bun.lock')) ||
                fs.existsSync(path.join(wwwPath, 'bun.lockb'));
            const homeDir = process.env.HOME || '/Users/moneyprinter';
            const command = hasBunLock ? `${homeDir}/.bun/bin/bun` : 'npm';
            const args = ['run', 'build'];
            this.log(`Building panel with ${command}...`);
            const buildProcess = (0, child_process_1.spawn)(command, args, {
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
                }
                else {
                    reject(new Error(`Build failed with code ${code}`));
                }
            });
            buildProcess.on('error', (error) => {
                reject(error);
            });
        });
    }
    getWwwPath() {
        // Try multiple strategies to find www folder
        // Strategy 1: Check if we're in development mode (extension source folder)
        // In dev mode, extensionPath is the actual source folder
        const devWwwPath = path.join(this.context.extensionPath, '..', 'www');
        if (fs.existsSync(devWwwPath)) {
            return devWwwPath;
        }
        // Strategy 2: Check workspace folders
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            for (const folder of workspaceFolders) {
                // Check if www exists in this workspace
                const wwwInWorkspace = path.join(folder.uri.fsPath, 'www');
                if (fs.existsSync(wwwInWorkspace)) {
                    return wwwInWorkspace;
                }
                // Check if we're inside the hataystudio project
                const parentWww = path.join(folder.uri.fsPath, '..', 'www');
                if (fs.existsSync(parentWww)) {
                    return parentWww;
                }
            }
        }
        // Strategy 3: Use configuration (user can set custom path)
        const config = vscode.workspace.getConfiguration('aiAppBuilder');
        const customPath = config.get('panelPath');
        if (customPath && fs.existsSync(customPath)) {
            return customPath;
        }
        // Fallback: return dev path and let caller handle the error
        return devWwwPath;
    }
    getEnhancedPath(projectPath) {
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
    isReadyMessage(output) {
        return output.includes('Ready') ||
            output.includes('started server') ||
            output.includes(`localhost:${this.currentPort}`) ||
            output.includes('Local:') ||
            output.includes('listening on');
    }
    getConfig() {
        const config = vscode.workspace.getConfiguration('aiAppBuilder');
        return {
            port: config.get('panelPort', 3001),
            autoStart: config.get('panelAutoStart', true),
            mode: config.get('panelMode', 'development')
        };
    }
    setState(state, error) {
        this.state = state;
        this.updateStatusBar();
        this.callbacks?.onStateChange(state, error);
    }
    log(message, isError = false) {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = isError ? '[ERROR]' : '[INFO]';
        const line = `[${timestamp}] ${prefix} ${message}`;
        this.outputChannel.appendLine(line);
        this.callbacks?.onOutput(line, isError);
        if (isError) {
            console.error(`[PanelManager] ${message}`);
        }
        else {
            console.log(`[PanelManager] ${message}`);
        }
    }
    updateStatusBar() {
        const icons = {
            stopped: '$(circle-outline)',
            starting: '$(loading~spin)',
            running: '$(circle-filled)',
            stopping: '$(loading~spin)',
            error: '$(error)'
        };
        const tooltips = {
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
        }
        else if (this.state === 'starting' || this.state === 'stopping') {
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
        else {
            this.statusBarItem.backgroundColor = undefined;
        }
        this.statusBarItem.show();
    }
    dispose() {
        this.stop();
        this.outputChannel.dispose();
        this.statusBarItem.dispose();
    }
}
exports.PanelManager = PanelManager;
//# sourceMappingURL=panelManager.js.map