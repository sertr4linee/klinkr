import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { ModelBridge } from './modelBridge';
import { ChatParticipantBridge } from './chatParticipant';
import { ActivityTracker } from './activityTracker';
import { CopilotHistoryService } from './copilotHistory';
import { ProcessManager } from './processManager';
import { WebSocketMessage, ChangeModelPayload, WorkspaceInfo, FileTreeItem, NextJsProject, ProjectConfig, ProjectCreationLog } from './types';

// REALM Protocol imports
import { SyncEngine, SyncClient } from './realm/sync/SyncEngine';
import { EventBus, createEvent } from './realm/sync/EventBus';
import type { RealmEvent, RealmID } from './realm/types';

// Babel imports for safe AST manipulation
import * as babelParser from '@babel/parser';
import babelTraverse from '@babel/traverse';
import babelGenerate from '@babel/generator';
import * as t from '@babel/types';

/**
 * Serveur HTTP + WebSocket pour la communication avec le panel Next.js
 */
export class AppBuilderServer {
  private app: express.Application;
  private server: http.Server;
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private modelBridge: ModelBridge;
  private activityTracker: ActivityTracker;
  private copilotHistoryService: CopilotHistoryService;
  private processManager: ProcessManager;
  private port: number;
  private nextJsProjects: Map<string, NextJsProject> = new Map();
  private nextJsProcesses: Map<string, ChildProcess> = new Map();
  
  // REALM Protocol
  private syncEngine: SyncEngine;
  private realmEventBus: EventBus;
  private wsClientMap: Map<WebSocket, string> = new Map(); // ws -> clientId

  constructor(port: number, private context: vscode.ExtensionContext) {
    console.log('[Server] Initializing AppBuilderServer...');
    this.port = port;
    this.modelBridge = ModelBridge.getInstance();
    this.activityTracker = ActivityTracker.getInstance();
    this.processManager = ProcessManager.getInstance(context);
    
    // Initialize CopilotHistoryService with error handling
    try {
      console.log('[Server] Initializing CopilotHistoryService...');
      this.copilotHistoryService = CopilotHistoryService.getInstance(context);
      console.log('[Server] CopilotHistoryService initialized:', !!this.copilotHistoryService);
    } catch (error) {
      console.error('[Server] ERROR initializing CopilotHistoryService:', error);
      throw error;
    }
    
    this.syncEngine = SyncEngine.getInstance();
    this.realmEventBus = EventBus.getInstance();
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupModelBridgeListeners();
    this.setupChatParticipantBridge();
    this.setupActivityTracker();
    this.setupRealmEventHandlers();
    console.log('[Server] AppBuilderServer initialized successfully');
  }
  
  /**
   * Setup REALM event handlers for broadcasting to clients
   */
  private setupRealmEventHandlers(): void {
    // Broadcast REALM events to WebSocket clients
    this.realmEventBus.on('*', (event) => {
      // Broadcast to all connected clients as realm_event
      this.broadcastRealmEvent(event);
    });
    
    console.log('[Server] REALM event handlers configured');
  }
  
  /**
   * Broadcast a REALM event to all connected WebSocket clients
   */
  private broadcastRealmEvent(event: RealmEvent): void {
    const message = JSON.stringify({
      type: 'realm_event',
      payload: event,
    });
    
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  private setupMiddleware(): void {
    console.log('[Server] Setting up middleware...');
    this.app.use(express.json());
    
    // CORS pour le panel Next.js
    this.app.use((req, res, next) => {
      console.log(`[Server] ${req.method} ${req.url}`);
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });
    console.log('[Server] Middleware configured');
  }

  private setupRoutes(): void {
    console.log('[Server] Setting up routes...');
    
    // Health check
    this.app.get('/api/health', (req, res) => {
      console.log('[Server] Health check called');
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    // Liste des modèles (API REST fallback)
    this.app.get('/api/models', async (req, res) => {
      console.log('[Server] Models API called');
      try {
        const models = await this.modelBridge.getModelsByVendor();
        res.json({ success: true, data: models });
      } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
      }
    });

    // Changer le modèle (API REST fallback)
    this.app.post('/api/models/change', async (req, res) => {
      try {
        const payload: ChangeModelPayload = req.body;
        const success = await this.modelBridge.changeModel(payload);
        res.json({ success });
      } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
      }
    });

    // Info sur le serveur
    this.app.get('/api/info', (req, res) => {
      res.json({
        name: 'AI App Builder',
        version: '0.1.0',
        wsPort: this.port,
        panelUrl: 'http://localhost:3001',
        capabilities: [
          'listModels',
          'changeModel',
          'modelSubscription',
          'activityTracking',
          'nextJsProjects',
          'mcpServers'
        ]
      });
    });

    // Simple status page - le panel Next.js est accessible directement sur localhost:3001
    this.app.get('/', (req, res) => {
      res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI App Builder - API Server</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #09090b;
      color: #fafafa;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 600px; text-align: center; }
    h1 {
      font-size: 2rem;
      margin-bottom: 1rem;
      background: linear-gradient(to right, #3b82f6, #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    p { color: #a1a1aa; margin-bottom: 1rem; line-height: 1.6; }
    .status { 
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 8px;
      margin: 0.5rem;
    }
    .dot {
      width: 8px; height: 8px;
      background: #22c55e;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    .btn {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 12px 24px;
      background: #3b82f6;
      color: white;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 500;
      font-size: 1rem;
    }
    .btn:hover { background: #2563eb; }
    .endpoints {
      margin-top: 2rem;
      text-align: left;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 16px;
    }
    .endpoints h3 { margin-bottom: 12px; font-size: 0.875rem; color: #71717a; text-transform: uppercase; }
    .endpoint { font-family: monospace; font-size: 13px; padding: 4px 0; color: #a1a1aa; }
    .endpoint span { color: #3b82f6; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 AI App Builder</h1>
    <p>API & WebSocket Server</p>
    
    <div class="status">
      <span class="dot"></span>
      <span>WebSocket: ws://localhost:${this.port}</span>
    </div>
    <div class="status">
      <span class="dot"></span>
      <span>API: http://localhost:${this.port}/api</span>
    </div>

    <a href="http://localhost:3001" class="btn" target="_blank">Open Control Panel →</a>

    <div class="endpoints">
      <h3>API Endpoints</h3>
      <div class="endpoint"><span>GET</span> /api/health</div>
      <div class="endpoint"><span>GET</span> /api/info</div>
      <div class="endpoint"><span>GET</span> /api/models</div>
      <div class="endpoint"><span>POST</span> /api/models/change</div>
    </div>
  </div>
</body>
</html>
      `);
    });
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('[Server] New WebSocket client connected');
      this.clients.add(ws);

      // Envoyer la liste des modèles au nouveau client
      this.sendModelsToClient(ws);

      ws.on('message', async (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          await this.handleWebSocketMessage(ws, message);
        } catch (error) {
          console.error('[Server] Error parsing WebSocket message:', error);
          this.sendToClient(ws, {
            type: 'error',
            payload: { message: 'Invalid message format' }
          });
        }
      });

      ws.on('close', () => {
        console.log('[Server] WebSocket client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('[Server] WebSocket error:', error);
        this.clients.delete(ws);
      });
    });
  }

  private async handleWebSocketMessage(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    console.log(`[Server] Received message: ${message.type}`);

    switch (message.type) {
      case 'listModels':
        await this.sendModelsToClient(ws);
        break;

      case 'changeModel':
        const payload = message.payload as ChangeModelPayload;
        const success = await this.modelBridge.changeModel(payload);
        this.sendToClient(ws, {
          type: 'modelChanged',
          payload: { success, model: payload },
          requestId: message.requestId
        });
        break;

      case 'sendMessage':
        await this.handleChatMessage(ws, message);
        break;

      case 'sendToCopilot':
        await this.handleCopilotMessage(ws, message);
        break;

      case 'sendToBuilder':
        // Envoyer un prompt au Chat Participant @builder
        await this.handleBuilderMessage(ws, message);
        break;

      case 'getWorkspace':
        await this.sendWorkspaceInfo(ws);
        break;

      case 'detectNextJsProjects':
        await this.detectAndSendNextJsProjects(ws);
        break;

      case 'startNextJsProject':
        await this.startNextJsProject(ws, message.payload.path, message.payload.port);
        break;

      case 'stopNextJsProject':
        await this.stopNextJsProject(ws, message.payload.path);
        break;

      case 'createProject':
        await this.handleCreateProject(ws, message.payload, message.requestId);
        break;

      case 'detectMCPServers':
        await this.detectAndSendMCPServers(ws);
        break;

      case 'getCopilotHistory':
        console.log('[Server] Received getCopilotHistory request');
        await this.handleGetCopilotHistory(ws);
        break;

      case 'getCopilotHistoryConfig':
        console.log('[Server] Received getCopilotHistoryConfig request');
        await this.handleGetCopilotHistoryConfig(ws);
        break;

      case 'updateCopilotHistoryConfig':
        console.log('[Server] Received updateCopilotHistoryConfig request');
        await this.handleUpdateCopilotHistoryConfig(ws, message.payload);
        break;

      case 'getAvailableCopilotVersions':
        console.log('[Server] Received getAvailableCopilotVersions request');
        await this.handleGetAvailableCopilotVersions(ws);
        break;

      case 'setupDOMBridge':
        await this.handleSetupDOMBridge(ws, message.payload.projectPath);
        break;

      case 'applyElementChanges':
        await this.handleApplyElementChanges(ws, message);
        break;
        
      // ============================================================================
      // REALM Protocol Messages
      // ============================================================================
      case 'realm_event':
        this.handleRealmEvent(ws, message.payload as RealmEvent);
        break;

      case 'ping':
        this.sendToClient(ws, { type: 'pong' });
        break;

      default:
        this.sendToClient(ws, {
          type: 'error',
          payload: { message: `Unknown message type: ${message.type}` }
        });
    }
  }
  
  /**
   * Handle incoming REALM protocol events from WebSocket clients
   */
  private handleRealmEvent(ws: WebSocket, event: RealmEvent): void {
    console.log(`[Server/REALM] Received event: ${event.type}`);
    
    // Get or create client ID for this WebSocket
    let clientId = this.wsClientMap.get(ws);
    if (!clientId) {
      clientId = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.wsClientMap.set(ws, clientId);
      
      // Register as a sync client
      const syncClient: SyncClient = {
        id: clientId,
        type: 'websocket',
        send: (ev: RealmEvent) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'realm_event', payload: ev }));
          }
        },
        isConnected: () => ws.readyState === WebSocket.OPEN,
      };
      this.syncEngine.registerClient(syncClient);
    }
    
    // Forward to SyncEngine for processing
    this.syncEngine.receiveFromClient(clientId, event);
    
    // Handle specific event types for immediate response
    if (event.type === 'COMMIT_REQUESTED') {
      this.handleRealmCommit(ws, event as RealmEvent & { type: 'COMMIT_REQUESTED'; realmId: RealmID });
    } else if (event.type === 'ROLLBACK_REQUESTED') {
      this.handleRealmRollback(ws, event as RealmEvent & { type: 'ROLLBACK_REQUESTED'; realmId: RealmID });
    }
  }
  
  /**
   * Handle REALM commit request
   */
  private async handleRealmCommit(ws: WebSocket, event: { type: 'COMMIT_REQUESTED'; realmId: RealmID }): Promise<void> {
    try {
      console.log('[Server/REALM] Processing commit for:', event.realmId.hash);
      
      // Commit via SyncEngine (which uses TransactionManager)
      await this.syncEngine.commitPendingChanges(event.realmId);
      
      // Send success response
      const response: RealmEvent = {
        id: `evt_commit_${Date.now()}`,
        timestamp: Date.now(),
        type: 'COMMIT_COMPLETED',
        source: 'system',
        realmId: event.realmId,
      };
      ws.send(JSON.stringify({ type: 'realm_event', payload: response }));
      
    } catch (error) {
      console.error('[Server/REALM] Commit failed:', error);
      // Send error via transaction failed event
      const errorEvent: RealmEvent = {
        id: `evt_error_${Date.now()}`,
        timestamp: Date.now(),
        type: 'TRANSACTION_FAILED',
        source: 'system',
        transactionId: 'commit_' + Date.now(),
        realmId: event.realmId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      ws.send(JSON.stringify({ type: 'realm_event', payload: errorEvent }));
    }
  }
  
  /**
   * Handle REALM rollback request
   */
  private async handleRealmRollback(ws: WebSocket, event: { type: 'ROLLBACK_REQUESTED'; realmId: RealmID }): Promise<void> {
    try {
      console.log('[Server/REALM] Processing rollback for:', event.realmId.hash);
      
      // Rollback via SyncEngine
      await this.syncEngine.rollbackPendingChanges(event.realmId);
      
      // Send success response
      const response: RealmEvent = {
        id: `evt_rollback_${Date.now()}`,
        timestamp: Date.now(),
        type: 'ROLLBACK_COMPLETED',
        source: 'system',
        realmId: event.realmId,
      };
      ws.send(JSON.stringify({ type: 'realm_event', payload: response }));
      
    } catch (error) {
      console.error('[Server/REALM] Rollback failed:', error);
    }
  }

  private async sendModelsToClient(ws: WebSocket): Promise<void> {
    const models = await this.modelBridge.getModelsByVendor();
    this.sendToClient(ws, {
      type: 'modelsUpdated',
      payload: models
    });
  }

  private async sendWorkspaceInfo(ws: WebSocket): Promise<void> {
    console.log('[Server] Getting workspace info...');
    const workspaceInfo = await this.getWorkspaceInfo();
    console.log('[Server] Workspace path:', workspaceInfo.path);
    console.log('[Server] FileTree keys count:', Object.keys(workspaceInfo.fileTree).length);
    this.sendToClient(ws, {
      type: 'workspaceInfo',
      payload: workspaceInfo
    });
    console.log('[Server] Workspace info sent');
  }

  private async getWorkspaceInfo(): Promise<WorkspaceInfo> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return {
        path: '',
        fileTree: {}
      };
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    const fileTree = await this.buildFileTree(workspacePath, workspacePath);

    return {
      path: workspacePath,
      fileTree
    };
  }

  private async buildFileTree(
    rootPath: string,
    currentPath: string,
    maxDepth: number = 10,
    currentDepth: number = 0
  ): Promise<Record<string, FileTreeItem>> {
    const tree: Record<string, FileTreeItem> = {};

    if (currentDepth >= maxDepth) {
      return tree;
    }

    try {
      const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        // Ignorer les dossiers/fichiers cachés et node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') {
          continue;
        }

        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(rootPath, fullPath);
        const itemId = relativePath.replace(/\\/g, '/');

        if (entry.isDirectory()) {
          // D'abord, scanner les enfants pour obtenir leurs IDs
          const childEntries = await fs.promises.readdir(fullPath, { withFileTypes: true });
          const childIds = childEntries
            .filter(child => !child.name.startsWith('.') && child.name !== 'node_modules' && child.name !== 'dist' && child.name !== 'build')
            .map(child => {
              const childPath = path.relative(rootPath, path.join(fullPath, child.name));
              return childPath.replace(/\\/g, '/');
            });

          tree[itemId] = {
            name: entry.name,
            path: relativePath.replace(/\\/g, '/'),
            type: 'directory',
            children: childIds
          };

          // Récursion pour construire le sous-arbre
          const subTree = await this.buildFileTree(rootPath, fullPath, maxDepth, currentDepth + 1);
          Object.assign(tree, subTree);
        } else {
          tree[itemId] = {
            name: entry.name,
            path: relativePath.replace(/\\/g, '/'),
            type: 'file'
          };
        }
      }
    } catch (error) {
      console.error(`[Server] Error reading directory ${currentPath}:`, error);
    }

    return tree;
  }

  private async handleChatMessage(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    const { message: userMessage, requestId } = message.payload;

    await this.modelBridge.sendMessage(
      userMessage,
      // onChunk
      (chunk: string) => {
        this.sendToClient(ws, {
          type: 'messageChunk',
          payload: { chunk },
          requestId
        });
      },
      // onComplete
      () => {
        this.sendToClient(ws, {
          type: 'messageComplete',
          requestId
        });
      },
      // onError
      (error: string) => {
        this.sendToClient(ws, {
          type: 'messageError',
          payload: { error },
          requestId
        });
      }
    );
  }

  private async handleCopilotMessage(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    const { prompt, requestId } = message.payload;

    await this.modelBridge.sendToCopilotChat(
      prompt,
      // onWord - reçoit chaque mot individuellement
      (word: string) => {
        this.sendToClient(ws, {
          type: 'copilotWord',
          payload: { word },
          requestId
        });
      },
      // onComplete
      () => {
        this.sendToClient(ws, {
          type: 'copilotComplete',
          requestId
        });
      },
      // onError
      (error: string) => {
        this.sendToClient(ws, {
          type: 'copilotError',
          payload: { error },
          requestId
        });
      },
      // onChatOpened
      () => {
        this.sendToClient(ws, {
          type: 'copilotChatOpened',
          requestId
        });
      }
    );
  }

  /**
   * Handler pour envoyer un prompt au Chat Participant @builder
   * Ouvre le Copilot Chat avec @builder et le prompt
   */
  private async handleBuilderMessage(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    const { prompt, requestId } = message.payload;
    
    console.log(`[Server] Sending to @builder: "${prompt.substring(0, 50)}..."`);
    
    try {
      const chatParticipant = ChatParticipantBridge.getInstance();
      await chatParticipant.sendPrompt(prompt);
      
      // Note: Les réponses arriveront via les callbacks configurés dans setupChatParticipantBridge
      // et seront automatiquement broadcastés à tous les clients
    } catch (error) {
      console.error('[Server] Error sending to @builder:', error);
      this.sendToClient(ws, {
        type: 'builderResponseError',
        payload: { error: String(error), requestId }
      });
    }
  }

  private sendToClient(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private broadcastToAll(message: WebSocketMessage): void {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  private setupModelBridgeListeners(): void {
    this.modelBridge.onModelsChanged((models) => {
      console.log('[Server] Models changed, broadcasting to all clients');
      this.broadcastToAll({
        type: 'modelsUpdated',
        payload: models
      });
    });
  }

  /**
   * Configure le bridge avec le Chat Participant @builder
   * Permet de capturer les réponses Copilot directement depuis le Chat UI
   */
  private setupChatParticipantBridge(): void {
    const chatParticipant = ChatParticipantBridge.getInstance();
    
    chatParticipant.setCallbacks({
      // Quand un prompt est reçu via @builder
      onPromptReceived: (prompt: string, requestId: string) => {
        console.log(`[Server] @builder received prompt: "${prompt.substring(0, 50)}..."`);
        this.broadcastToAll({
          type: 'builderPromptReceived',
          payload: { prompt, requestId }
        } as WebSocketMessage);
      },
      
      // Quand un chunk de réponse arrive (streaming)
      onResponseChunk: (chunk: string, requestId: string) => {
        console.log(`[Server] @builder chunk: ${chunk.length} chars`);
        this.broadcastToAll({
          type: 'builderResponseChunk',
          payload: { chunk, requestId }
        } as WebSocketMessage);
      },
      
      // Quand la réponse est complète
      onResponseComplete: (fullResponse: string, requestId: string) => {
        console.log(`[Server] @builder complete: ${fullResponse.length} chars`);
        this.broadcastToAll({
          type: 'builderResponseComplete',
          payload: { fullResponse, requestId }
        } as WebSocketMessage);
      },
      
      // Quand une erreur se produit
      onResponseError: (error: string, requestId: string) => {
        console.error(`[Server] @builder error: ${error}`);
        this.broadcastToAll({
          type: 'builderResponseError',
          payload: { error, requestId }
        } as WebSocketMessage);
      }
    });
    
    console.log('[Server] Chat Participant Bridge connected');
  }

  /**
   * Configure l'ActivityTracker pour capturer les événements en temps réel
   * et les envoyer au panel (fichiers lus, créés, modifiés, etc.)
   */
  private setupActivityTracker(): void {
    this.activityTracker.setCallbacks({
      onActivity: (activity) => {
        // Envoyer l'activité à tous les clients connectés
        this.broadcastToAll({
          type: 'activity',
          payload: activity
        } as WebSocketMessage);
      }
    });

    // Démarrer le tracking
    this.activityTracker.startTracking();
    console.log('[Server] Activity Tracker connected and tracking');
  }

  // ============== Next.js Project Management ==============

  private async detectNextJsProjects(): Promise<NextJsProject[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return [];

    const projects: NextJsProject[] = [];
    
    for (const folder of workspaceFolders) {
      const rootPath = folder.uri.fsPath;
      await this.scanForNextJsProjects(rootPath, projects);
    }

    // Update the map
    for (const project of projects) {
      const existing = this.nextJsProjects.get(project.path);
      if (existing) {
        project.status = existing.status;
        project.port = existing.port;
        project.error = existing.error;
      }
      this.nextJsProjects.set(project.path, project);
    }

    return projects;
  }

  private async scanForNextJsProjects(dirPath: string, projects: NextJsProject[], depth: number = 0): Promise<void> {
    if (depth > 5) return; // Limit depth

    try {
      const packageJsonPath = path.join(dirPath, 'package.json');

      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

        if (dependencies && dependencies['next']) {
          // Check for next.config
          const hasNextConfig =
            fs.existsSync(path.join(dirPath, 'next.config.js')) ||
            fs.existsSync(path.join(dirPath, 'next.config.mjs')) ||
            fs.existsSync(path.join(dirPath, 'next.config.ts'));

          // Check if DOM Bridge is already set up
          const domBridgeSetup = this.checkDOMBridgeSetup(dirPath);

          projects.push({
            path: dirPath,
            name: packageJson.name || path.basename(dirPath),
            packageJsonPath,
            hasNextConfig,
            port: 3000,
            status: 'stopped',
            domBridgeSetup
          });
          return; // Don't scan subdirectories of a Next.js project
        }
      }

      // Scan subdirectories
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() &&
            !entry.name.startsWith('.') &&
            entry.name !== 'node_modules' &&
            entry.name !== 'dist' &&
            entry.name !== 'build' &&
            entry.name !== '.next') {
          await this.scanForNextJsProjects(path.join(dirPath, entry.name), projects, depth + 1);
        }
      }
    } catch (error) {
      console.error(`[Server] Error scanning ${dirPath}:`, error);
    }
  }

  /**
   * Check if DOM Bridge is already set up in a Next.js project
   */
  private checkDOMBridgeSetup(projectPath: string): boolean {
    try {
      // Check both possible app directories
      const appDir = path.join(projectPath, 'app');
      const srcAppDir = path.join(projectPath, 'src', 'app');

      let targetAppDir = appDir;
      if (!fs.existsSync(appDir) && fs.existsSync(srcAppDir)) {
        targetAppDir = srcAppDir;
      }

      if (!fs.existsSync(targetAppDir)) {
        return false;
      }

      // Check if DOMSelectorBridge.tsx exists
      const bridgeFilePath = path.join(targetAppDir, 'DOMSelectorBridge.tsx');
      if (!fs.existsSync(bridgeFilePath)) {
        return false;
      }

      // Check if layout.tsx imports DOMSelectorBridge
      const layoutFilePath = path.join(targetAppDir, 'layout.tsx');
      if (!fs.existsSync(layoutFilePath)) {
        return false;
      }

      const layoutContent = fs.readFileSync(layoutFilePath, 'utf-8');
      return layoutContent.includes('DOMSelectorBridge');
    } catch (error) {
      console.error(`[Server] Error checking DOM Bridge setup:`, error);
      return false;
    }
  }

  private async detectAndSendNextJsProjects(ws: WebSocket): Promise<void> {
    console.log('[Server] Detecting Next.js projects...');
    const projects = await this.detectNextJsProjects();
    console.log(`[Server] Found ${projects.length} Next.js projects`);
    
    this.sendToClient(ws, {
      type: 'nextJsProjectsDetected',
      payload: { projects }
    });
  }

  private async startNextJsProject(ws: WebSocket, projectPath: string, port: number = 3000): Promise<void> {
    console.log(`[Server] Starting Next.js project at ${projectPath} on port ${port}`);
    
    const project = this.nextJsProjects.get(projectPath);
    if (!project) {
      this.sendToClient(ws, {
        type: 'nextJsProjectStatus',
        payload: { path: projectPath, status: 'error', error: 'Project not found' }
      });
      return;
    }

    // Check if already running
    if (this.nextJsProcesses.has(projectPath)) {
      this.sendToClient(ws, {
        type: 'nextJsProjectStatus',
        payload: { path: projectPath, status: 'running', port: project.port }
      });
      return;
    }

    // ✅ Vérifier si le port est disponible
    const isPortFree = await this.processManager.isPortAvailable(port);
    if (!isPortFree) {
      console.log(`[Server] Port ${port} is busy, finding alternative...`);
      try {
        port = await this.processManager.findAvailablePort(port, 20);
        console.log(`[Server] Using alternative port: ${port}`);
      } catch (error) {
        this.sendToClient(ws, {
          type: 'nextJsProjectStatus',
          payload: { path: projectPath, status: 'error', error: `No available port found starting from ${port}` }
        });
        return;
      }
    }

    // Update status to starting
    project.status = 'starting';
    project.port = port;
    this.nextJsProjects.set(projectPath, project);

    this.sendToClient(ws, {
      type: 'nextJsProjectStatus',
      payload: { path: projectPath, status: 'starting' }
    });

    try {
      // Determine package manager
      const hasYarnLock = fs.existsSync(path.join(projectPath, 'yarn.lock'));
      const hasPnpmLock = fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'));
      const hasBunLock = fs.existsSync(path.join(projectPath, 'bun.lockb')) || 
                         fs.existsSync(path.join(projectPath, 'bun.lock'));
      
      const hasNodeModules = fs.existsSync(path.join(projectPath, 'node_modules'));
      const homeDir = process.env.HOME || '/Users/moneyprinter';
      
      // ✅ Installer les dépendances si nécessaire
      if (!hasNodeModules) {
        console.log(`[Server] node_modules not found, installing dependencies...`);
        
        this.sendToClient(ws, {
          type: 'nextJsProjectStatus',
          payload: { path: projectPath, status: 'installing' }
        });

        let installCommand: string;
        if (hasBunLock) {
          installCommand = `"${homeDir}/.bun/bin/bun" install`;
        } else if (hasPnpmLock) {
          installCommand = `pnpm install`;
        } else if (hasYarnLock) {
          installCommand = `yarn install`;
        } else {
          installCommand = `npm install`;
        }

        try {
          await new Promise<void>((resolve, reject) => {
            const installProcess = spawn('/bin/zsh', ['-c', installCommand], {
              cwd: projectPath,
              stdio: ['ignore', 'pipe', 'pipe'],
              env: { ...process.env, HOME: homeDir }
            });

            installProcess.stdout?.on('data', (data) => {
              console.log(`[Install ${project.name}] ${data.toString()}`);
            });

            installProcess.stderr?.on('data', (data) => {
              console.error(`[Install ${project.name}] ${data.toString()}`);
            });

            installProcess.on('error', reject);
            installProcess.on('exit', (code) => {
              if (code === 0) {
                resolve();
              } else {
                reject(new Error(`Installation failed with code ${code}`));
              }
            });
          });

          console.log(`[Server] Dependencies installed successfully`);
        } catch (error) {
          console.error(`[Server] Failed to install dependencies:`, error);
          project.status = 'error';
          project.error = `Failed to install dependencies: ${error}`;
          this.nextJsProjects.set(projectPath, project);
          
          this.sendToClient(ws, {
            type: 'nextJsProjectStatus',
            payload: { path: projectPath, status: 'error', error: project.error }
          });
          return;
        }
      }
      
      // Build the full command with absolute paths
      let fullCommand: string;

      if (hasBunLock) {
        const bunPath = `${homeDir}/.bun/bin/bun`;
        fullCommand = `"${bunPath}" run dev --port ${port}`;
      } else if (hasPnpmLock) {
        fullCommand = `pnpm dev --port ${port}`;
      } else if (hasYarnLock) {
        fullCommand = `yarn dev --port ${port}`;
      } else {
        fullCommand = `npm run dev -- --port ${port}`;
      }

      // Enhanced PATH - include project's node_modules/.bin for local binaries like 'next'
      const additionalPaths = [
        path.join(projectPath, 'node_modules', '.bin'),  // Local project binaries (next, etc.)
        '/opt/homebrew/bin',
        '/usr/local/bin',
        '/usr/bin',
        `${homeDir}/.bun/bin`,
        `${homeDir}/.nvm/versions/node/current/bin`,
        `${homeDir}/.local/bin`,
      ].join(':');
      
      const enhancedPath = `${additionalPaths}:${process.env.PATH || ''}`;

      console.log(`[Server] Running: ${fullCommand}`);
      console.log(`[Server] CWD: ${projectPath}`);

      // Use spawn with shell command directly
      const child = spawn('/bin/zsh', ['-c', fullCommand], {
        cwd: projectPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { 
          ...process.env, 
          PORT: String(port),
          PATH: enhancedPath,
          HOME: homeDir
        }
      });

      this.nextJsProcesses.set(projectPath, child);

      let isReady = false;

      child.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log(`[NextJS ${project.name}] ${output}`);

        // Detect when the server is ready
        if (!isReady && (output.includes('Ready') || output.includes('started') || output.includes(`localhost:${port}`))) {
          isReady = true;
          project.status = 'running';
          this.nextJsProjects.set(projectPath, project);

          this.broadcastToAll({
            type: 'nextJsProjectStatus',
            payload: { path: projectPath, status: 'running', port }
          });

          // ✅ Notification VS Code
          vscode.window.showInformationMessage(
            `✅ ${project.name} is running on http://localhost:${port}`,
            'Open in Browser'
          ).then(selection => {
            if (selection === 'Open in Browser') {
              vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${port}`));
            }
          });
        }
      });

      child.stderr?.on('data', (data) => {
        const output = data.toString();
        console.error(`[NextJS ${project.name}] ${output}`);
        
        // Sometimes Ready message comes on stderr
        if (!isReady && (output.includes('Ready') || output.includes('started') || output.includes(`localhost:${port}`))) {
          isReady = true;
          project.status = 'running';
          this.nextJsProjects.set(projectPath, project);

          this.broadcastToAll({
            type: 'nextJsProjectStatus',
            payload: { path: projectPath, status: 'running', port }
          });
        }
      });

      child.on('error', (error) => {
        console.error(`[Server] Error starting Next.js project:`, error);
        project.status = 'error';
        project.error = error.message;
        this.nextJsProjects.set(projectPath, project);
        this.nextJsProcesses.delete(projectPath);

        this.broadcastToAll({
          type: 'nextJsProjectStatus',
          payload: { path: projectPath, status: 'error', error: error.message }
        });
      });

      child.on('exit', (code) => {
        console.log(`[Server] Next.js project exited with code ${code}`);
        project.status = 'stopped';
        project.error = code !== 0 ? `Exited with code ${code}` : undefined;
        this.nextJsProjects.set(projectPath, project);
        this.nextJsProcesses.delete(projectPath);

        this.broadcastToAll({
          type: 'nextJsProjectStatus',
          payload: { path: projectPath, status: 'stopped', error: project.error }
        });
      });

      // Timeout for server readiness
      setTimeout(() => {
        if (!isReady && project.status === 'starting') {
          // Assume it's running if no error
          project.status = 'running';
          this.nextJsProjects.set(projectPath, project);

          this.broadcastToAll({
            type: 'nextJsProjectStatus',
            payload: { path: projectPath, status: 'running', port }
          });
        }
      }, 15000);

    } catch (error) {
      console.error('[Server] Failed to start Next.js project:', error);
      project.status = 'error';
      project.error = String(error);
      this.nextJsProjects.set(projectPath, project);

      this.sendToClient(ws, {
        type: 'nextJsProjectStatus',
        payload: { path: projectPath, status: 'error', error: String(error) }
      });
    }
  }

  private async stopNextJsProject(ws: WebSocket, projectPath: string): Promise<void> {
    console.log(`[Server] Stopping Next.js project at ${projectPath}`);
    
    const child = this.nextJsProcesses.get(projectPath);
    const project = this.nextJsProjects.get(projectPath);

    if (child) {
      child.kill('SIGTERM');
      
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);

      this.nextJsProcesses.delete(projectPath);
    }

    if (project) {
      project.status = 'stopped';
      project.error = undefined;
      this.nextJsProjects.set(projectPath, project);
    }

    this.broadcastToAll({
      type: 'nextJsProjectStatus',
      payload: { path: projectPath, status: 'stopped' }
    });
  }

  // ============== End Next.js Project Management ==============

  // ============== Project Creation ==============

  /**
   * Handle project creation request
   */
  private async handleCreateProject(ws: WebSocket, config: ProjectConfig, requestId?: string): Promise<void> {
    console.log('[Server] Creating project:', config);

    const sendLog = (type: ProjectCreationLog['type'], message: string) => {
      this.sendToClient(ws, {
        type: 'projectCreationLog',
        payload: { type, message, timestamp: Date.now() },
        requestId
      });
    };

    try {
      // Get workspace path
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        throw new Error('No workspace folder open');
      }

      const workspacePath = workspaceFolders[0].uri.fsPath;
      const projectPath = path.join(workspacePath, config.name);

      // Check if directory already exists
      if (fs.existsSync(projectPath)) {
        throw new Error(`Directory "${config.name}" already exists`);
      }

      sendLog('info', `Creating project "${config.name}"...`);

      // Determine package manager command
      const homeDir = process.env.HOME || '/Users/moneyprinter';
      let pmCmd: string;
      let pmExec: string;

      switch (config.packageManager) {
        case 'bun':
          pmCmd = `${homeDir}/.bun/bin/bun`;
          pmExec = `${homeDir}/.bun/bin/bunx`;
          break;
        case 'pnpm':
          pmCmd = 'pnpm';
          pmExec = 'pnpm dlx';
          break;
        case 'yarn':
          pmCmd = 'yarn';
          pmExec = 'yarn dlx';
          break;
        default:
          pmCmd = 'npm';
          pmExec = 'npx';
      }

      // Build create command based on framework
      let createCommand: string;
      const useTs = config.features.includes('typescript');
      const useTailwind = config.features.includes('tailwind') || config.styling === 'tailwind';
      const useEslint = config.features.includes('eslint');

      switch (config.framework) {
        case 'nextjs':
          createCommand = `${pmExec} create-next-app@latest ${config.name} --yes`;
          if (useTs) createCommand += ' --typescript';
          if (useTailwind) createCommand += ' --tailwind';
          if (useEslint) createCommand += ' --eslint';
          createCommand += ' --app --src-dir --import-alias "@/*"';
          break;

        case 'vite-react':
          createCommand = `${pmExec} create-vite@latest ${config.name} --template ${useTs ? 'react-ts' : 'react'}`;
          break;

        case 'vite-vue':
          createCommand = `${pmExec} create-vite@latest ${config.name} --template ${useTs ? 'vue-ts' : 'vue'}`;
          break;

        case 'vite-svelte':
          createCommand = `${pmExec} create-vite@latest ${config.name} --template ${useTs ? 'svelte-ts' : 'svelte'}`;
          break;

        case 'astro':
          createCommand = `${pmExec} create-astro@latest ${config.name} --template minimal --yes`;
          if (useTs) createCommand += ' --typescript strict';
          break;

        case 'remix':
          createCommand = `${pmExec} create-remix@latest ${config.name} --yes`;
          break;

        default:
          createCommand = `${pmExec} create-vite@latest ${config.name} --template ${useTs ? 'react-ts' : 'react'}`;
      }

      sendLog('command', `$ ${createCommand}`);

      // Execute create command
      await this.executeCommand(createCommand, workspacePath, sendLog);
      sendLog('success', 'Project scaffolded successfully!');

      // Install additional dependencies based on config
      const depsToInstall: string[] = [];
      const devDepsToInstall: string[] = [];

      // Tailwind (for non-Next.js projects)
      if (useTailwind && config.framework !== 'nextjs') {
        devDepsToInstall.push('tailwindcss', 'postcss', 'autoprefixer');
        sendLog('info', 'Adding Tailwind CSS...');
      }

      // Prettier
      if (config.features.includes('prettier')) {
        devDepsToInstall.push('prettier');
        if (useTailwind) devDepsToInstall.push('prettier-plugin-tailwindcss');
        sendLog('info', 'Adding Prettier...');
      }

      // Database
      if (config.database) {
        switch (config.database) {
          case 'prisma-postgres':
          case 'prisma-sqlite':
            depsToInstall.push('@prisma/client');
            devDepsToInstall.push('prisma');
            sendLog('info', 'Adding Prisma...');
            break;
          case 'drizzle-postgres':
            depsToInstall.push('drizzle-orm', 'pg');
            devDepsToInstall.push('drizzle-kit', '@types/pg');
            sendLog('info', 'Adding Drizzle ORM...');
            break;
          case 'mongoose':
            depsToInstall.push('mongoose');
            sendLog('info', 'Adding Mongoose...');
            break;
          case 'supabase':
            depsToInstall.push('@supabase/supabase-js');
            sendLog('info', 'Adding Supabase...');
            break;
        }
      }

      // Auth
      if (config.auth) {
        switch (config.auth) {
          case 'nextauth':
            depsToInstall.push('next-auth');
            sendLog('info', 'Adding NextAuth.js...');
            break;
          case 'clerk':
            depsToInstall.push('@clerk/nextjs');
            sendLog('info', 'Adding Clerk...');
            break;
          case 'lucia':
            depsToInstall.push('lucia');
            sendLog('info', 'Adding Lucia...');
            break;
          case 'supabase-auth':
            if (!config.database?.includes('supabase')) {
              depsToInstall.push('@supabase/supabase-js');
            }
            sendLog('info', 'Adding Supabase Auth...');
            break;
        }
      }

      // Install dependencies
      if (depsToInstall.length > 0) {
        const installCmd = `${pmCmd} add ${depsToInstall.join(' ')}`;
        sendLog('command', `$ ${installCmd}`);
        await this.executeCommand(installCmd, projectPath, sendLog);
      }

      // Install dev dependencies
      if (devDepsToInstall.length > 0) {
        const installDevCmd = `${pmCmd} add -D ${devDepsToInstall.join(' ')}`;
        sendLog('command', `$ ${installDevCmd}`);
        await this.executeCommand(installDevCmd, projectPath, sendLog);
      }

      // Initialize Prisma if needed
      if (config.database?.includes('prisma')) {
        const dbType = config.database.includes('sqlite') ? 'sqlite' : 'postgresql';
        const prismaInitCmd = `${pmExec} prisma init --datasource-provider ${dbType}`;
        sendLog('command', `$ ${prismaInitCmd}`);
        await this.executeCommand(prismaInitCmd, projectPath, sendLog);
        sendLog('success', 'Prisma initialized!');
      }

      // Initialize Tailwind if needed (for non-Next.js)
      if (useTailwind && config.framework !== 'nextjs') {
        const tailwindInitCmd = `${pmExec} tailwindcss init -p`;
        sendLog('command', `$ ${tailwindInitCmd}`);
        await this.executeCommand(tailwindInitCmd, projectPath, sendLog);
        sendLog('success', 'Tailwind CSS configured!');
      }

      // Final success
      sendLog('success', '🎉 Project created successfully!');
      sendLog('info', `cd ${config.name} && ${pmCmd} run dev`);

      // Send completion message
      this.sendToClient(ws, {
        type: 'projectCreationComplete',
        payload: {
          name: config.name,
          path: projectPath,
          config
        },
        requestId
      });

      // Refresh project list
      await this.detectAndSendNextJsProjects(ws);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      sendLog('error', `Error: ${errorMessage}`);

      this.sendToClient(ws, {
        type: 'projectCreationError',
        payload: { error: errorMessage },
        requestId
      });
    }
  }

  /**
   * Execute a shell command and stream output
   */
  private executeCommand(
    command: string,
    cwd: string,
    sendLog: (type: ProjectCreationLog['type'], message: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const homeDir = process.env.HOME || '/Users/moneyprinter';
      const enhancedPath = [
        `${homeDir}/.bun/bin`,
        `${homeDir}/.nvm/versions/node/current/bin`,
        '/opt/homebrew/bin',
        '/usr/local/bin',
        '/usr/bin',
        process.env.PATH
      ].join(':');

      const child = spawn('/bin/zsh', ['-c', command], {
        cwd,
        env: {
          ...process.env,
          PATH: enhancedPath,
          HOME: homeDir
        }
      });

      child.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        lines.forEach(line => sendLog('info', line));
      });

      child.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        lines.forEach(line => {
          // Don't treat all stderr as errors (npm/yarn use stderr for progress)
          if (line.toLowerCase().includes('error') || line.toLowerCase().includes('failed')) {
            sendLog('warning', line);
          } else {
            sendLog('info', line);
          }
        });
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  // ============== End Project Creation ==============

  // ============== Copilot History ==============

  /**
   * Gère la récupération de l'historique Copilot
   */
  private async handleGetCopilotHistory(ws: WebSocket): Promise<void> {
    try {
      console.log('[Server] Getting Copilot history...');
      const conversations = await this.copilotHistoryService.getRecentConversations();
      
      this.sendToClient(ws, {
        type: 'copilotHistory',
        payload: { conversations }
      });
      
      console.log(`[Server] Sent ${conversations.length} conversations`);
    } catch (error) {
      console.error('[Server] Error getting Copilot history:', error);
      this.sendToClient(ws, {
        type: 'error',
        payload: { message: 'Failed to get Copilot history', error: String(error) }
      });
    }
  }

  /**
   * Gère la récupération de la configuration de l'historique
   */
  private async handleGetCopilotHistoryConfig(ws: WebSocket): Promise<void> {
    try {
      const config = this.copilotHistoryService.getConfig();
      this.sendToClient(ws, {
        type: 'copilotHistoryConfig',
        payload: config
      });
    } catch (error) {
      console.error('[Server] Error getting Copilot history config:', error);
      this.sendToClient(ws, {
        type: 'error',
        payload: { message: 'Failed to get config', error: String(error) }
      });
    }
  }

  /**
   * Gère la mise à jour de la configuration de l'historique
   */
  private async handleUpdateCopilotHistoryConfig(ws: WebSocket, payload: any): Promise<void> {
    try {
      await this.copilotHistoryService.updateConfig(payload);
      const updatedConfig = this.copilotHistoryService.getConfig();
      
      this.sendToClient(ws, {
        type: 'copilotHistoryConfig',
        payload: updatedConfig
      });
      
      console.log('[Server] Updated Copilot history config:', updatedConfig);
    } catch (error) {
      console.error('[Server] Error updating Copilot history config:', error);
      this.sendToClient(ws, {
        type: 'error',
        payload: { message: 'Failed to update config', error: String(error) }
      });
    }
  }

  /**
   * Gère la récupération des versions disponibles (stable/insiders)
   */
  private async handleGetAvailableCopilotVersions(ws: WebSocket): Promise<void> {
    try {
      const versions = await this.copilotHistoryService.getAvailableVersions();
      this.sendToClient(ws, {
        type: 'availableCopilotVersions',
        payload: versions
      });
    } catch (error) {
      console.error('[Server] Error getting available versions:', error);
      this.sendToClient(ws, {
        type: 'error',
        payload: { message: 'Failed to get available versions', error: String(error) }
      });
    }
  }

  // ============== End Copilot History ==============

  // ============== MCP Server Detection ==============

  private async detectAndSendMCPServers(ws: WebSocket): Promise<void> {
    console.log('[Server] Detecting MCP servers...');
    const servers = await this.detectMCPServers();
    console.log(`[Server] Found ${servers.length} MCP servers`);
    
    this.sendToClient(ws, {
      type: 'mcpServersDetected',
      payload: { servers }
    });
  }

  private async detectMCPServers(): Promise<any[]> {
    try {
      const servers: any[] = [];
      
      // Check VS Code settings for MCP servers
      const config = vscode.workspace.getConfiguration();
      
      // Check for MCP servers in different possible configuration locations
      const mcpConfig = 
        config.get<any>('mcp.servers') || 
        config.get<any>('mcpServers') ||
        config.get<any>('github.copilot.chat.codeGeneration.mcp.servers') ||
        {};

      console.log('[Server] VS Code MCP Config:', Object.keys(mcpConfig).length, 'servers');

      // Parse MCP server configurations
      for (const [name, serverConfig] of Object.entries(mcpConfig as Record<string, any>)) {
        if (serverConfig && typeof serverConfig === 'object') {
          servers.push({
            name,
            command: serverConfig.command || '',
            args: Array.isArray(serverConfig.args) ? serverConfig.args : [],
            env: serverConfig.env || {},
            status: 'active',
            description: serverConfig.description || `MCP server: ${name}`,
            tools: [] // Tools are managed by VS Code/Copilot, not us
          });
        }
      }

      // Also check workspace .vscode/settings.json
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (workspaceFolder) {
        const settingsPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'settings.json');
        if (fs.existsSync(settingsPath)) {
          try {
            const settingsContent = fs.readFileSync(settingsPath, 'utf-8');
            // Remove comments from JSON
            const cleanJson = settingsContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
            const settings = JSON.parse(cleanJson);
            
            // Check various MCP configuration keys
            const mcpKeys = ['mcp.servers', 'mcpServers', 'mcp'];

            for (const key of mcpKeys) {
              const mcpServers = this.getNestedProperty(settings, key);
              if (mcpServers && typeof mcpServers === 'object') {
                for (const [name, serverConfig] of Object.entries(mcpServers as Record<string, any>)) {
                  // Avoid duplicates
                  if (!servers.find(s => s.name === name) && serverConfig && typeof serverConfig === 'object') {
                    servers.push({
                      name,
                      command: serverConfig.command || '',
                      args: Array.isArray(serverConfig.args) ? serverConfig.args : [],
                      env: serverConfig.env || {},
                      status: 'active',
                      description: serverConfig.description || `MCP server: ${name}`,
                      tools: []
                    });
                  }
                }
              }
            }
          } catch (error) {
            console.error('[Server] Error reading settings.json:', error);
          }
        }
        
        // Check mcp.json in workspace root
        const mcpJsonPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'mcp.json');
        if (fs.existsSync(mcpJsonPath)) {
          try {
            const mcpContent = fs.readFileSync(mcpJsonPath, 'utf-8');
            const cleanJson = mcpContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
            const mcpJson = JSON.parse(cleanJson);
            
            const mcpServers = mcpJson.servers || mcpJson;
            if (mcpServers && typeof mcpServers === 'object') {
              for (const [name, serverConfig] of Object.entries(mcpServers as Record<string, any>)) {
                if (!servers.find(s => s.name === name) && serverConfig && typeof serverConfig === 'object') {
                  servers.push({
                    name,
                    command: serverConfig.command || '',
                    args: Array.isArray(serverConfig.args) ? serverConfig.args : [],
                    env: serverConfig.env || {},
                    status: 'active',
                    description: serverConfig.description || `MCP server: ${name}`,
                    tools: []
                  });
                }
              }
            }
          } catch (error) {
            console.error('[Server] Error reading mcp.json:', error);
          }
        }
      }

      console.log(`[Server] Found ${servers.length} MCP servers total`);
      return servers;
    } catch (error) {
      console.error('[Server] Error detecting MCP servers:', error);
      return [];
    }
  }

  private getNestedProperty(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }
    return current;
  }

  /**
   * Fetch tools from an MCP server using the MCP protocol
   */
  private async fetchMCPTools(server: any): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        mcpProcess.kill();
        reject(new Error('MCP server timeout'));
      }, 10000); // 10 second timeout

      let stdout = '';
      let stderr = '';
      let initialized = false;

      // Spawn the MCP server process
      const mcpProcess = spawn(server.command, server.args, {
        env: { ...process.env, ...server.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      mcpProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
        
        // Try to parse JSON-RPC responses
        const lines = stdout.split('\n');
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line) {
            try {
              const response = JSON.parse(line);
              
              // Handle initialization response
              if (response.id === 1 && response.result) {
                console.log(`[MCP] ${server.name} initialized:`, response.result);
                initialized = true;
                
                // Request tools list
                const toolsRequest = {
                  jsonrpc: '2.0',
                  id: 2,
                  method: 'tools/list',
                  params: {}
                };
                mcpProcess.stdin?.write(JSON.stringify(toolsRequest) + '\n');
              }
              
              // Handle tools list response
              if (response.id === 2 && response.result) {
                clearTimeout(timeout);
                mcpProcess.kill();
                
                const tools = response.result.tools || [];
                console.log(`[MCP] ${server.name} tools:`, tools);
                
                // Transform to our format
                const formattedTools = tools.map((tool: any) => ({
                  name: tool.name,
                  description: tool.description || '',
                  inputSchema: tool.inputSchema || {}
                }));
                
                resolve(formattedTools);
              }
              
              // Handle errors
              if (response.error) {
                console.error(`[MCP] ${server.name} error:`, response.error);
                clearTimeout(timeout);
                mcpProcess.kill();
                reject(new Error(response.error.message || 'MCP server error'));
              }
            } catch (e) {
              // Not valid JSON, continue collecting output
            }
          }
        }
        // Keep the last incomplete line
        stdout = lines[lines.length - 1];
      });

      mcpProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
        console.error(`[MCP] ${server.name} stderr:`, data.toString());
      });

      mcpProcess.on('error', (error) => {
        clearTimeout(timeout);
        console.error(`[MCP] ${server.name} process error:`, error);
        reject(error);
      });

      mcpProcess.on('exit', (code) => {
        clearTimeout(timeout);
        if (code !== 0 && code !== null) {
          console.error(`[MCP] ${server.name} exited with code ${code}`);
          console.error(`[MCP] stderr:`, stderr);
          reject(new Error(`MCP server exited with code ${code}`));
        }
      });

      // Send initialization request
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          clientInfo: {
            name: 'AI App Builder',
            version: '0.1.0'
          }
        }
      };

      mcpProcess.stdin?.write(JSON.stringify(initRequest) + '\n');
    });
  }

  // ============== End MCP Server Detection ==============

  // ============== DOM Bridge Setup ==============

  /**
   * Setup DOM Bridge for a Next.js project
   * Creates DOMSelectorBridge.tsx and modifies layout.tsx to import it
   */
  private async handleSetupDOMBridge(ws: WebSocket, projectPath: string): Promise<void> {
    console.log(`[Server] Setting up DOM Bridge for project: ${projectPath}`);
    
    try {
      const appDir = path.join(projectPath, 'app');
      const srcAppDir = path.join(projectPath, 'src', 'app');
      
      // Determine the app directory (could be /app or /src/app)
      let targetAppDir = appDir;
      if (!fs.existsSync(appDir) && fs.existsSync(srcAppDir)) {
        targetAppDir = srcAppDir;
      }
      
      if (!fs.existsSync(targetAppDir)) {
        throw new Error(`App directory not found: ${targetAppDir}`);
      }

      const bridgeFilePath = path.join(targetAppDir, 'DOMSelectorBridge.tsx');
      const layoutFilePath = path.join(targetAppDir, 'layout.tsx');

      // 1. Create DOMSelectorBridge.tsx
      const bridgeCode = this.getDOMSelectorBridgeCode();
      fs.writeFileSync(bridgeFilePath, bridgeCode, 'utf-8');
      console.log(`[Server] Created DOMSelectorBridge.tsx at ${bridgeFilePath}`);

      // 2. Modify layout.tsx to import and use DOMSelectorBridge
      if (!fs.existsSync(layoutFilePath)) {
        throw new Error(`Layout file not found: ${layoutFilePath}`);
      }

      let layoutContent = fs.readFileSync(layoutFilePath, 'utf-8');
      
      // Check if already imported
      if (layoutContent.includes('DOMSelectorBridge')) {
        console.log('[Server] DOMSelectorBridge already imported in layout.tsx');
        this.sendToClient(ws, {
          type: 'domBridgeSetupComplete',
          payload: { 
            success: true, 
            message: 'DOM Bridge already setup',
            projectPath 
          }
        });
        return;
      }

      // Add import at the top (after 'use client' if present, or after other imports)
      const importStatement = "import { DOMSelectorBridge } from './DOMSelectorBridge';\n";
      
      // Find the best place to add the import
      if (layoutContent.includes("'use client'") || layoutContent.includes('"use client"')) {
        // Add after 'use client' directive
        layoutContent = layoutContent.replace(
          /(['"]use client['"];?\n)/,
          `$1\n${importStatement}`
        );
      } else {
        // Find the last import statement and add after it
        const importRegex = /^import .+;?\n/gm;
        let lastImportMatch;
        let match;
        while ((match = importRegex.exec(layoutContent)) !== null) {
          lastImportMatch = match;
        }
        
        if (lastImportMatch) {
          const insertPosition = lastImportMatch.index + lastImportMatch[0].length;
          layoutContent = layoutContent.slice(0, insertPosition) + importStatement + layoutContent.slice(insertPosition);
        } else {
          // No imports found, add at the beginning
          layoutContent = importStatement + layoutContent;
        }
      }

      // Add <DOMSelectorBridge /> inside the body tag
      // Look for {children} and add before it
      if (layoutContent.includes('{children}')) {
        layoutContent = layoutContent.replace(
          /(\{children\})/,
          '<DOMSelectorBridge />\n        $1'
        );
      } else {
        // Alternative: look for </body> and add before it
        layoutContent = layoutContent.replace(
          /(<\/body>)/,
          '        <DOMSelectorBridge />\n      $1'
        );
      }

      // Write the modified layout
      fs.writeFileSync(layoutFilePath, layoutContent, 'utf-8');
      console.log(`[Server] Modified layout.tsx to include DOMSelectorBridge`);

      // Send success response
      this.sendToClient(ws, {
        type: 'domBridgeSetupComplete',
        payload: { 
          success: true, 
          message: 'DOM Bridge setup complete! Please restart your dev server.',
          projectPath,
          filesModified: [bridgeFilePath, layoutFilePath]
        }
      });

      // Show notification in VS Code
      vscode.window.showInformationMessage(
        `DOM Bridge setup complete for ${path.basename(projectPath)}. Please restart the dev server.`
      );

    } catch (error) {
      console.error('[Server] Error setting up DOM Bridge:', error);
      this.sendToClient(ws, {
        type: 'domBridgeSetupError',
        payload: { 
          error: error instanceof Error ? error.message : String(error),
          projectPath 
        }
      });
    }
  }

  private getDOMSelectorBridgeCode(): string {
    return `'use client';

import { useEffect } from 'react';

export function DOMSelectorBridge() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__DOM_SELECTOR_INJECTED__) return;
    (window as any).__DOM_SELECTOR_INJECTED__ = true;

    console.log('[DOMSelectorBridge] Initializing...');

    let isInspecting = false;
    let hoverOverlay: HTMLDivElement | null = null;
    let currentElement: Element | null = null;

    function createOverlay() {
      if (hoverOverlay) return;
      hoverOverlay = document.createElement('div');
      hoverOverlay.id = '__dom-selector-overlay__';
      hoverOverlay.style.cssText = 'position: fixed; pointer-events: none; z-index: 999999; background: rgba(59, 130, 246, 0.15); border: 2px solid rgba(59, 130, 246, 0.8); transition: all 0.05s ease-out; display: none;';
      document.body.appendChild(hoverOverlay);
    }

    function removeOverlay() {
      if (hoverOverlay) {
        hoverOverlay.remove();
        hoverOverlay = null;
      }
    }

    function getUniqueSelector(element: Element): string {
      if (element.id) return '#' + element.id;
      const path: string[] = [];
      let current: Element | null = element;
      while (current && current !== document.body && current !== document.documentElement) {
        let selector = current.tagName.toLowerCase();
        if (current.className && typeof current.className === 'string') {
          const classes = current.className.trim().split(/\\s+/).filter((c: string) => c && !c.startsWith('hover')).slice(0, 2);
          if (classes.length) selector += '.' + classes.join('.');
        }
        if (current.parentElement) {
          const siblings = Array.from(current.parentElement.children);
          const sameTag = siblings.filter(s => s.tagName === current!.tagName);
          if (sameTag.length > 1) {
            const index = sameTag.indexOf(current) + 1;
            selector += ':nth-of-type(' + index + ')';
          }
        }
        path.unshift(selector);
        current = current.parentElement;
      }
      return path.join(' > ');
    }

    function getDirectTextContent(element: Element): string {
      let text = '';
      for (let i = 0; i < element.childNodes.length; i++) {
        const node = element.childNodes[i];
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent || '';
        }
      }
      return text.trim();
    }

    function sendBounds(element: Element | null, type: string) {
      if (!element) {
        window.parent.postMessage({ type: 'dom-selector-' + type, bounds: null }, '*');
        return;
      }
      const rect = element.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(element);
      const directText = getDirectTextContent(element);
      const fullText = element.textContent?.trim() || '';
      const hasChildren = element.children.length > 0;
      const isComplexText = hasChildren && directText !== fullText;
      
      const styles = {
        display: computedStyle.display, position: computedStyle.position, backgroundColor: computedStyle.backgroundColor,
        color: computedStyle.color, fontSize: computedStyle.fontSize, fontFamily: computedStyle.fontFamily,
        fontWeight: computedStyle.fontWeight, lineHeight: computedStyle.lineHeight,
        padding: computedStyle.padding, paddingTop: computedStyle.paddingTop, paddingRight: computedStyle.paddingRight,
        paddingBottom: computedStyle.paddingBottom, paddingLeft: computedStyle.paddingLeft,
        margin: computedStyle.margin, marginTop: computedStyle.marginTop, marginRight: computedStyle.marginRight,
        marginBottom: computedStyle.marginBottom, marginLeft: computedStyle.marginLeft,
        border: computedStyle.border, borderRadius: computedStyle.borderRadius,
        width: computedStyle.width, height: computedStyle.height, maxWidth: computedStyle.maxWidth, maxHeight: computedStyle.maxHeight,
        minWidth: computedStyle.minWidth, minHeight: computedStyle.minHeight, boxSizing: computedStyle.boxSizing,
        flexDirection: computedStyle.flexDirection, flexWrap: computedStyle.flexWrap, justifyContent: computedStyle.justifyContent,
        alignItems: computedStyle.alignItems, gap: computedStyle.gap, gridTemplateColumns: computedStyle.gridTemplateColumns,
        gridTemplateRows: computedStyle.gridTemplateRows, textAlign: computedStyle.textAlign, textDecoration: computedStyle.textDecoration,
        textTransform: computedStyle.textTransform, letterSpacing: computedStyle.letterSpacing,
        opacity: computedStyle.opacity, transform: computedStyle.transform, transition: computedStyle.transition,
        cursor: computedStyle.cursor, overflow: computedStyle.overflow, zIndex: computedStyle.zIndex,
      };
      const attributes: Record<string, string> = {};
      if (element instanceof HTMLElement) {
        Array.from(element.attributes).forEach(attr => { attributes[attr.name] = attr.value; });
      }
      
      window.parent.postMessage({
        type: 'dom-selector-' + type,
        bounds: {
          x: rect.left, y: rect.top, width: rect.width, height: rect.height,
          selector: getUniqueSelector(element), tagName: element.tagName.toLowerCase(),
          id: element.id || undefined, className: element.className || undefined,
          computedStyles: styles, attributes: attributes,
          textContent: isComplexText ? directText : fullText.substring(0, 200),
          fullTextContent: fullText.substring(0, 500),
          directTextContent: directText,
          hasChildren: hasChildren,
          childCount: element.children.length,
          isComplexText: isComplexText,
        }
      }, '*');
    }

    function updateOverlay(element: Element | null) {
      if (!hoverOverlay || !element) {
        if (hoverOverlay) hoverOverlay.style.display = 'none';
        return;
      }
      const rect = element.getBoundingClientRect();
      hoverOverlay.style.display = 'block';
      hoverOverlay.style.left = rect.left + 'px';
      hoverOverlay.style.top = rect.top + 'px';
      hoverOverlay.style.width = rect.width + 'px';
      hoverOverlay.style.height = rect.height + 'px';
    }

    function handleMouseMove(e: MouseEvent) {
      if (!isInspecting) return;
      const element = document.elementFromPoint(e.clientX, e.clientY);
      if (!element || element === hoverOverlay || element === document.body || element === document.documentElement) return;
      if (element !== currentElement) {
        currentElement = element;
        updateOverlay(element);
        sendBounds(element, 'hover');
      }
    }

    function handleClick(e: MouseEvent) {
      if (!isInspecting) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const element = document.elementFromPoint(e.clientX, e.clientY);
      if (element && element !== hoverOverlay) {
        sendBounds(element, 'select');
      }
      return false;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isInspecting) {
        window.parent.postMessage({ type: 'dom-selector-cancel' }, '*');
      }
    }

    // Helper function to find element by complex selector path
    function findElementByPath(selectorPath: string): Element | null {
      try {
        const direct = document.querySelector(selectorPath);
        if (direct) return direct;
      } catch (e) {}

      const parts = selectorPath.split(' > ').map(s => s.trim()).filter(s => s);
      if (parts.length === 0) return null;

      let current: Element | null = document.body;
      
      for (const part of parts) {
        if (!current) return null;
        
        const nthMatch = part.match(/:nth-of-type\\((\\d+)\\)$/);
        const nthIndex = nthMatch ? parseInt(nthMatch[1]) : null;
        const cleanPart = part.replace(/:nth-of-type\\(\\d+\\)$/, '');
        
        const tagMatch = cleanPart.match(/^([a-z0-9]+)/i);
        const tag = tagMatch ? tagMatch[1].toUpperCase() : null;
        const classMatch = cleanPart.match(/\\.([^.]+)/g);
        const classes = classMatch ? classMatch.map(c => c.slice(1)) : [];
        
        const childElements: Element[] = Array.from(current.children);
        const matching: Element[] = childElements.filter((child: Element) => {
          if (tag && child.tagName !== tag) return false;
          if (classes.length > 0) {
            const childClasses = (child.className as string)?.split?.(/\\s+/) || [];
            if (!classes.some(c => childClasses.includes(c))) return false;
          }
          return true;
        });
        
        if (nthIndex !== null && nthIndex >= 1 && nthIndex <= matching.length) {
          current = matching[nthIndex - 1];
        } else if (matching.length > 0) {
          current = matching[0];
        } else {
          try {
            current = current.querySelector(cleanPart);
          } catch {
            return null;
          }
        }
      }
      
      return current;
    }

    function handleMessage(e: MessageEvent) {
      const { type, selector, styles, text } = e.data || {};
      
      if (type === 'dom-selector-enable') {
        isInspecting = true;
        createOverlay();
        document.body.style.cursor = 'crosshair';
      } else if (type === 'dom-selector-disable') {
        isInspecting = false;
        removeOverlay();
        currentElement = null;
        document.body.style.cursor = '';
      } else if (type === 'dom-selector-modify-style') {
        const element = findElementByPath(selector);
        if (element && element instanceof HTMLElement) {
          Object.entries(styles || {}).forEach(([key, value]) => {
            (element as HTMLElement).style[key as any] = value as string;
          });
          window.parent.postMessage({ type: 'dom-selector-style-applied', selector, styles }, '*');
        }
      } else if (type === 'dom-selector-modify-text') {
        const element = findElementByPath(selector);
        if (element) {
          const hasChildElements = element.children.length > 0;
          if (!hasChildElements) {
            element.textContent = text;
          } else {
            const textNodes: ChildNode[] = [];
            for (let i = 0; i < element.childNodes.length; i++) {
              const node = element.childNodes[i];
              if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
                textNodes.push(node);
              }
            }
            if (textNodes.length === 0) {
              const firstChild = element.children[0];
              if (firstChild && firstChild.children.length === 0) {
                firstChild.textContent = text;
              } else {
                element.textContent = text;
              }
            } else {
              textNodes[0].textContent = text;
            }
          }
          window.parent.postMessage({ type: 'dom-selector-text-applied', selector, text }, '*');
          sendBounds(element, 'select');
        }
      }
    }

    window.addEventListener('message', handleMessage);
    document.addEventListener('mousemove', handleMouseMove, { capture: true, passive: true });
    document.addEventListener('click', handleClick, { capture: true });
    document.addEventListener('keydown', handleKeyDown, { capture: true });

    window.parent.postMessage({ type: 'dom-selector-ready' }, '*');

    return () => {
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('mousemove', handleMouseMove, { capture: true } as any);
      document.removeEventListener('click', handleClick, { capture: true } as any);
      document.removeEventListener('keydown', handleKeyDown, { capture: true } as any);
      removeOverlay();
      (window as any).__DOM_SELECTOR_INJECTED__ = false;
    };
  }, []);

  return null;
}
`;
  }

  // ============== End DOM Bridge Setup ==============

  // ============== Element Change Application ==============

  /**
   * Handle applying element changes to source code files
   * This method finds the source file based on the URL and selector,
   * then modifies the styles/text in the source code
   */
  private async handleApplyElementChanges(ws: WebSocket, message: WebSocketMessage): Promise<void> {
    console.log(`[Server] ========================================`);
    console.log(`[Server] handleApplyElementChanges called`);
    console.log(`[Server] Payload:`, JSON.stringify(message.payload, null, 2));
    console.log(`[Server] ========================================`);
    
    try {
      const { selector, changes, url } = message.payload as {
        selector: string;
        changes: { 
          styles?: Record<string, string>; 
          textContent?: string; 
          className?: string;
          tailwindClassesToAdd?: string[];
        };
        url: string;
      };

      // Validation précoce des paramètres
      if (!selector || !url) {
        const errorPayload = { 
          error: `Missing required parameters: selector=${!!selector}, url=${!!url}`, 
          selector: selector || 'unknown' 
        };
        console.error('[Server] Missing required params:', errorPayload);
        this.sendToClient(ws, {
          type: 'elementChangesError',
          payload: errorPayload
        });
        return;
      }

      if (!changes || Object.keys(changes).length === 0) {
        const errorPayload = { error: 'No changes provided', selector };
        console.error('[Server] No changes provided:', errorPayload);
        this.sendToClient(ws, {
          type: 'elementChangesError',
          payload: errorPayload
        });
        return;
      }

      console.log(`[Server] Valid request - selector: "${selector}", changes keys:`, Object.keys(changes));

      // Try to find the source file based on the URL
      const sourceFile = await this.findSourceFileFromUrl(url);
      
      if (!sourceFile) {
        this.sendToClient(ws, {
          type: 'elementChangesError',
          payload: { error: 'Could not find source file for this URL', selector }
        });
        return;
      }

      console.log(`[Server] Found source file: ${sourceFile}`);

      // Read the source file content
      const content = fs.readFileSync(sourceFile, 'utf-8');
      
      // Apply changes based on file type
      const ext = path.extname(sourceFile).toLowerCase();
      let newContent: string | null = null;

      console.log(`[Server] File extension: ${ext}, applying changes...`);

      if (ext === '.tsx' || ext === '.jsx') {
        newContent = await this.applyChangesToReactFile(content, selector, changes);
        console.log(`[Server] applyChangesToReactFile returned: ${newContent ? 'new content' : 'null'}`);
      } else if (ext === '.css' || ext === '.scss' || ext === '.sass') {
        newContent = await this.applyChangesToCssFile(content, selector, changes);
      } else if (ext === '.html') {
        newContent = await this.applyChangesToHtmlFile(content, selector, changes);
      }

      if (newContent && newContent !== content) {
        // Write the modified content back to the file
        fs.writeFileSync(sourceFile, newContent, 'utf-8');
        
        console.log(`[Server] Applied changes to ${sourceFile}`);
        
        // Send success response
        this.sendToClient(ws, {
          type: 'elementChangesApplied',
          payload: { 
            success: true, 
            selector, 
            file: sourceFile,
            changes 
          }
        });

        // Also broadcast to all clients for UI update
        this.broadcastToAll({
          type: 'fileModified',
          payload: { path: sourceFile }
        });
      } else {
        // Send a response indicating the element/styles couldn't be found
        const errorMsg = newContent === null 
          ? 'Could not find matching element in source file' 
          : 'No changes detected (content unchanged)';
        console.log(`[Server] Error: ${errorMsg}`);
        this.sendToClient(ws, {
          type: 'elementChangesError',
          payload: { 
            error: errorMsg, 
            selector,
            file: sourceFile 
          }
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error(`[Server] Error applying element changes:`, { error: errorMessage, stack: errorStack });
      this.sendToClient(ws, {
        type: 'elementChangesError',
        payload: { 
          error: errorMessage || 'Unknown error occurred',
          selector: (message.payload as { selector?: string })?.selector || 'unknown'
        }
      });
    }
  }

  /**
   * Find the source file based on the preview URL
   */
  private async findSourceFileFromUrl(url: string): Promise<string | null> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return null;

    const rootPath = workspaceFolder.uri.fsPath;

    try {
      // Parse the URL to get the route and port
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const port = urlObj.port;
      
      console.log(`[Server] Finding source for path: ${pathname}, port: ${port}`);

      // First, try to find the project by matching the port with running Next.js projects
      let projectRoot: string | null = null;
      
      for (const [projectPath, project] of this.nextJsProjects) {
        if (project.port?.toString() === port) {
          projectRoot = projectPath;
          console.log(`[Server] Found project by port in nextJsProjects: ${projectRoot}`);
          break;
        }
      }

      // If not found by port, try to detect which project is running on this port
      if (!projectRoot) {
        console.log(`[Server] Port ${port} not found in tracked projects, scanning workspace...`);
        const nextJsProjects = await this.findNextJsProjectsInWorkspace(rootPath);
        console.log(`[Server] Found ${nextJsProjects.length} Next.js projects:`, nextJsProjects);
        
        // Try to find project by checking which one might be running on this port
        // by looking at .next folder timestamps or package.json scripts
        for (const proj of nextJsProjects) {
          const nextFolder = path.join(proj, '.next');
          if (fs.existsSync(nextFolder)) {
            // Check if dev-server is running for this project
            const appPage = path.join(proj, 'app', 'page.tsx');
            const srcAppPage = path.join(proj, 'src', 'app', 'page.tsx');
            if (fs.existsSync(appPage) || fs.existsSync(srcAppPage)) {
              // For now, use heuristics: if it's my-app and port is 3002, or web-panel and port is 3000
              const projectName = path.basename(proj);
              console.log(`[Server] Checking project: ${projectName}`);
              
              // Common port assignments
              if ((projectName === 'my-app' && (port === '3002' || port === '3001')) ||
                  (projectName === 'web-panel' && port === '3000') ||
                  projectName.includes('test') || projectName.includes('app')) {
                projectRoot = proj;
                console.log(`[Server] Selected project by name heuristic: ${projectRoot}`);
                break;
              }
            }
          }
        }
        
        // If still not found, use the first project that has app/page.tsx
        if (!projectRoot) {
          for (const proj of nextJsProjects) {
            const appPage = path.join(proj, 'app', 'page.tsx');
            if (fs.existsSync(appPage)) {
              projectRoot = proj;
              console.log(`[Server] Selected first project with app/page.tsx: ${projectRoot}`);
              break;
            }
          }
        }
        
        if (!projectRoot && nextJsProjects.length > 0) {
          projectRoot = nextJsProjects[0];
          console.log(`[Server] Fallback to first project: ${projectRoot}`);
        }
      }

      // If still no project found, use workspace root
      const searchRoot = projectRoot || rootPath;
      console.log(`[Server] Searching in: ${searchRoot}`);

      // For Next.js App Router, check app/ directory
      const appDir = path.join(searchRoot, 'app');
      const srcAppDir = path.join(searchRoot, 'src', 'app');
      
      const possibleDirs = [
        fs.existsSync(srcAppDir) ? srcAppDir : null,
        fs.existsSync(appDir) ? appDir : null,
      ].filter(Boolean) as string[];

      for (const appDirectory of possibleDirs) {
        // Determine the route directory
        const routePath = pathname === '/' ? '' : pathname;
        const routeDir = path.join(appDirectory, routePath);
        
        // Check for page files
        const pageFiles = [
          path.join(routeDir, 'page.tsx'),
          path.join(routeDir, 'page.jsx'),
          path.join(routeDir, 'page.js'),
          path.join(appDirectory, 'page.tsx'),
          path.join(appDirectory, 'page.jsx'),
        ];

        for (const pageFile of pageFiles) {
          if (fs.existsSync(pageFile)) {
            console.log(`[Server] Found page file: ${pageFile}`);
            return pageFile;
          }
        }
      }

      // For Pages Router, check pages/ directory
      const pagesDir = path.join(rootPath, 'pages');
      const srcPagesDir = path.join(rootPath, 'src', 'pages');
      
      const possiblePagesDirs = [
        fs.existsSync(srcPagesDir) ? srcPagesDir : null,
        fs.existsSync(pagesDir) ? pagesDir : null,
      ].filter(Boolean) as string[];

      for (const pagesDirectory of possiblePagesDirs) {
        const routePath = pathname === '/' ? 'index' : pathname;
        const pageFiles = [
          path.join(pagesDirectory, `${routePath}.tsx`),
          path.join(pagesDirectory, `${routePath}.jsx`),
          path.join(pagesDirectory, `${routePath}.js`),
          path.join(pagesDirectory, routePath, 'index.tsx'),
        ];

        for (const pageFile of pageFiles) {
          if (fs.existsSync(pageFile)) {
            return pageFile;
          }
        }
      }

      // Fallback: Search all source files in the project
      const sourceFiles = await this.findAllSourceFiles(searchRoot);
      if (sourceFiles.length > 0) {
        // Return the main page file if found
        const mainPage = sourceFiles.find(f => 
          f.includes('page.tsx') || f.includes('page.jsx') || f.includes('index.tsx')
        );
        return mainPage || sourceFiles[0];
      }

    } catch (error) {
      console.error(`[Server] Error finding source file:`, error);
    }

    return null;
  }

  /**
   * Find all Next.js projects in the workspace
   */
  private async findNextJsProjectsInWorkspace(rootPath: string): Promise<string[]> {
    const projects: string[] = [];
    
    const scanDir = (dirPath: string, depth: number = 0) => {
      if (depth > 3) return;
      
      try {
        // Check if this directory is a Next.js project
        const packageJsonPath = path.join(dirPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            if (pkg.dependencies?.next || pkg.devDependencies?.next) {
              projects.push(dirPath);
              return; // Don't scan subdirectories of a Next.js project
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
        
        // Scan subdirectories
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !['node_modules', '.next', 'dist', 'build', '.git'].includes(entry.name)) {
            scanDir(path.join(dirPath, entry.name), depth + 1);
          }
        }
      } catch (e) {
        // Ignore errors
      }
    };
    
    scanDir(rootPath);
    return projects;
  }

  /**
   * Find all source files in the project
   */
  private async findAllSourceFiles(dirPath: string, files: string[] = [], depth: number = 0): Promise<string[]> {
    if (depth > 5) return files;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          if (!['node_modules', '.next', 'dist', 'build', '.git'].includes(entry.name)) {
            await this.findAllSourceFiles(fullPath, files, depth + 1);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.tsx', '.jsx', '.css', '.scss'].includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`[Server] Error scanning ${dirPath}:`, error);
    }

    return files;
  }

  /**
   * Validate TSX/JSX content is syntactically correct
   */
  private validateJsxSyntax(content: string): boolean {
    try {
      babelParser.parse(content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });
      return true;
    } catch (e) {
      console.error('[Server] JSX validation failed:', e);
      return false;
    }
  }

  /**
   * Apply style changes to a React/TSX file using Babel AST (safe approach)
   */
  private async applyChangesToReactFile(
    content: string, 
    selector: string, 
    changes: { styles?: Record<string, string>; textContent?: string; className?: string }
  ): Promise<string | null> {
    // Extract element info from selector
    // Handle complex selectors like "div > div > a.flex.h-12.w-full:nth-of-type(1)"
    // We only care about the LAST part (the actual target element)
    const selectorParts = selector.split(/\s*>\s*/);
    const lastPart = selectorParts[selectorParts.length - 1].trim();
    
    // Extract :nth-of-type() index BEFORE removing it
    const nthMatch = lastPart.match(/:nth-of-type\((\d+)\)/);
    const nthIndex = nthMatch ? parseInt(nthMatch[1], 10) : 1; // Default to 1 (first element)
    
    // Remove :nth-of-type() for class matching (but NOT Tailwind variant prefixes like dark:)
    const cleanSelector = lastPart.replace(/:nth-of-type\(\d+\)/g, '');
    
    const tagMatch = cleanSelector.match(/^(\w+)/);
    const idMatch = cleanSelector.match(/#([\w-]+)/);
    
    // Match classes including Tailwind variants like dark:text-white, hover:bg-red-500, etc.
    // The pattern matches: . followed by any combination of word chars, hyphens, brackets, colons, slashes, percents
    // Examples: .dark:text-zinc-400, .hover:bg-[#123], .text-[100%], .md:w-1/2
    const classMatch = cleanSelector.match(/\.([\w:-]+(?:\[[^\]]+\])?[\w:-]*)/g);
    
    const targetTag = tagMatch?.[1]?.toLowerCase();
    const targetId = idMatch?.[1];
    const targetClasses = classMatch?.map(c => c.slice(1)) || [];

    console.log(`[Server] AST: Parsed selector:`, { 
      originalSelector: selector,
      lastPart,
      cleanSelector,
      targetTag, 
      targetId, 
      targetClasses,
      nthIndex
    });

    let hasChanges = false;
    let elementFound = false;
    
    // Track matches per parent to correctly handle nth-of-type
    // This map tracks: parent path -> count of matches
    const matchesByParent = new Map<string, number>();

    try {
      // Parse the JSX content into an AST
      const ast = babelParser.parse(content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });

      // Mapping of Next.js/React components to their rendered HTML tags
      const componentToTagMap: Record<string, string[]> = {
        'image': ['img'],      // Next.js Image -> img
        'link': ['a'],          // Next.js Link -> a
        'script': ['script'],   // Next.js Script -> script
        'head': ['head'],       // Next.js Head -> head
      };

      // Traverse the AST to find and modify the target element
      babelTraverse(ast, {
        JSXElement: (path) => {
          // Only modify the first matching element
          if (elementFound) return;

          const openingElement = path.node.openingElement;
          const elementName = t.isJSXIdentifier(openingElement.name) ? openingElement.name.name : null;
          
          if (!elementName) return;
          
          // Skip if tag doesn't match
          // Handle Next.js component-to-tag mappings (e.g., Image -> img, Link -> a)
          const elementNameLower = elementName.toLowerCase();
          const possibleRenderedTags = componentToTagMap[elementNameLower] || [elementNameLower];
          
          if (targetTag && !possibleRenderedTags.includes(targetTag) && elementNameLower !== targetTag) return;

          // Get element attributes
          const attributes = openingElement.attributes.filter((attr): attr is t.JSXAttribute => 
            t.isJSXAttribute(attr)
          );

          // Check for ID match
          if (targetId) {
            const idAttr = attributes.find((attr: t.JSXAttribute) => 
              t.isJSXIdentifier(attr.name) && attr.name.name === 'id'
            );
            if (!idAttr || !t.isStringLiteral(idAttr.value) || idAttr.value.value !== targetId) {
              return;
            }
          }

          // ---------- NTH-OF-TYPE COUNTING FIRST ----------
          // CSS nth-of-type counts ALL elements of the same tag under the same parent
          // regardless of classes. So we must count FIRST, then check classes.
          
          // Get parent path as identifier for nth-of-type counting
          // Key includes both parent AND tag name to correctly count same-type siblings
          const parentPath = path.parentPath;
          const parentKey = `${parentPath?.node?.start?.toString() || 'root'}_${elementNameLower}`;
          
          // Increment count for this tag type under this parent
          const currentCount = (matchesByParent.get(parentKey) || 0) + 1;
          matchesByParent.set(parentKey, currentCount);
          
          console.log(`[Server] AST: <${elementName}> #${currentCount} under parent (need nth=${nthIndex})`);
          
          // Skip if this is not the nth-of-type we're looking for
          if (currentCount !== nthIndex) {
            return;
          }
          
          console.log(`[Server] AST: ✓ Found ${elementName} at position #${nthIndex}, checking classes...`);
          
          // ---------- NOW CHECK CLASSES ----------
          
          // Check for className match
          let classesMatch = false;
          // Check if this is a Next.js component that injects styles at runtime
          const isNextJsComponent = ['Image', 'Link', 'Script'].includes(elementName);
          
          if (targetClasses.length > 0) {
            const classAttr = attributes.find((attr: t.JSXAttribute) => 
              t.isJSXIdentifier(attr.name) && attr.name.name === 'className'
            );
            if (classAttr && t.isStringLiteral(classAttr.value)) {
              const sourceClasses = classAttr.value.value.split(/\s+/).filter(c => c.length > 0);
              
              // Count how many target classes are in source
              const matchingClasses = targetClasses.filter(tc => sourceClasses.includes(tc));
              const matchRatio = matchingClasses.length / targetClasses.length;
              
              // Also count how many source classes are in target (reverse match)
              const reverseMatchingClasses = sourceClasses.filter(sc => targetClasses.includes(sc));
              const reverseMatchRatio = sourceClasses.length > 0 ? reverseMatchingClasses.length / sourceClasses.length : 0;
              
              console.log(`[Server] AST: Classes check - source: [${sourceClasses.slice(0, 5).join(', ')}...], target: [${targetClasses.join(', ')}]`);
              console.log(`[Server] AST: Match ratios - forward: ${matchingClasses.length}/${targetClasses.length} (${(matchRatio * 100).toFixed(0)}%), reverse: ${reverseMatchingClasses.length}/${sourceClasses.length}`);
              
              // Match criteria - RELAXED for better matching
              if (matchRatio >= 1.0 || 
                  (matchRatio >= 0.5 && matchingClasses.length >= 2) ||
                  (matchingClasses.length >= 2) ||
                  (isNextJsComponent && reverseMatchRatio >= 0.5)) {
                classesMatch = true;
                console.log(`[Server] AST: ✓ Class match!`);
              } else {
                console.log(`[Server] AST: ✗ Class match failed`);
              }
            } else if (!classAttr) {
              console.log(`[Server] AST: No className in source for ${elementName}, allowing tag-only match`);
              classesMatch = true;
            } else if (classAttr && !t.isStringLiteral(classAttr.value)) {
              console.log(`[Server] AST: Dynamic className for ${elementName}, allowing tag-only match`);
              classesMatch = true;
            }
          } else if (!targetId) {
            // If no classes and no ID specified, match by tag only
            classesMatch = true;
          }
          
          if (!classesMatch && !targetId) {
            console.log(`[Server] AST: ✗ ${elementName} #${nthIndex} classes don't match, but this IS the nth-of-type position - returning early`);
            return;
          }

          // Mark as found
          elementFound = true;
          console.log(`[Server] AST: Found matching element #${nthIndex}: ${elementName}`);

          // Apply style changes
          if (changes.styles && Object.keys(changes.styles).length > 0) {
            // Find existing style attribute
            const styleAttrIndex = attributes.findIndex((attr: t.JSXAttribute) => 
              t.isJSXIdentifier(attr.name) && attr.name.name === 'style'
            );

            // Create new style object properties
            const styleProperties = Object.entries(changes.styles).map(([key, value]) => 
              t.objectProperty(
                t.identifier(key),
                t.stringLiteral(value)
              )
            );

            const newStyleExpr = t.jsxExpressionContainer(
              t.objectExpression(styleProperties)
            );

            if (styleAttrIndex >= 0) {
              // Update existing style attribute
              const existingStyleAttr = openingElement.attributes[styleAttrIndex] as t.JSXAttribute;
              
              // If existing style is an expression with an object, merge properties
              if (t.isJSXExpressionContainer(existingStyleAttr.value) && 
                  t.isObjectExpression(existingStyleAttr.value.expression)) {
                const existingObj = existingStyleAttr.value.expression;
                
                // Remove properties that we're updating
                const updatedKeys = Object.keys(changes.styles);
                const filteredProps = existingObj.properties.filter(prop => {
                  if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
                    return !updatedKeys.includes(prop.key.name);
                  }
                  return true;
                });

                // Add new/updated properties
                existingObj.properties = [...filteredProps, ...styleProperties];
              } else {
                // Replace with new style
                existingStyleAttr.value = newStyleExpr;
              }
            } else {
              // Add new style attribute
              const styleAttr = t.jsxAttribute(
                t.jsxIdentifier('style'),
                newStyleExpr
              );
              openingElement.attributes.push(styleAttr);
            }
            hasChanges = true;
          }

          // Apply className changes - either direct className or merge tailwindClassesToAdd
          const tailwindClassesToAdd = (changes as { tailwindClassesToAdd?: string[] }).tailwindClassesToAdd;
          
          if (tailwindClassesToAdd && tailwindClassesToAdd.length > 0) {
            // Smart merge: add new Tailwind classes while replacing conflicting ones
            const classAttrIndex = attributes.findIndex((attr: t.JSXAttribute) => 
              t.isJSXIdentifier(attr.name) && attr.name.name === 'className'
            );

            console.log(`[Server] AST: Merging Tailwind classes:`, tailwindClassesToAdd);

            if (classAttrIndex >= 0) {
              const existingClassAttr = openingElement.attributes[classAttrIndex] as t.JSXAttribute;
              
              if (t.isStringLiteral(existingClassAttr.value)) {
                // Merge classes intelligently
                const existingClasses = existingClassAttr.value.value;
                const mergedClasses = this.mergeClassesInBackend(existingClasses, tailwindClassesToAdd.join(' '));
                existingClassAttr.value = t.stringLiteral(mergedClasses);
                console.log(`[Server] AST: Merged className: "${existingClasses}" + "${tailwindClassesToAdd.join(' ')}" = "${mergedClasses}"`);
              } else {
                // Non-string className (dynamic), just append
                console.log(`[Server] AST: Warning - dynamic className, cannot merge safely`);
              }
            } else {
              // No existing className, add new one
              const classAttr = t.jsxAttribute(
                t.jsxIdentifier('className'),
                t.stringLiteral(tailwindClassesToAdd.join(' '))
              );
              openingElement.attributes.push(classAttr);
              console.log(`[Server] AST: Added new className: "${tailwindClassesToAdd.join(' ')}"`);
            }
            hasChanges = true;
          } else if (changes.className !== undefined) {
            // Direct className replacement (fallback)
            const classAttrIndex = attributes.findIndex((attr: t.JSXAttribute) => 
              t.isJSXIdentifier(attr.name) && attr.name.name === 'className'
            );

            console.log(`[Server] AST: Applying direct className: ${changes.className}`);

            if (classAttrIndex >= 0) {
              // Update existing className attribute
              const existingClassAttr = openingElement.attributes[classAttrIndex] as t.JSXAttribute;
              existingClassAttr.value = t.stringLiteral(changes.className);
              console.log(`[Server] AST: Updated existing className`);
            } else {
              // Add new className attribute
              const classAttr = t.jsxAttribute(
                t.jsxIdentifier('className'),
                t.stringLiteral(changes.className)
              );
              openingElement.attributes.push(classAttr);
              console.log(`[Server] AST: Added new className attribute`);
            }
            hasChanges = true;
          }

          // Apply text content changes - only modify direct text children, not nested elements
          if (changes.textContent !== undefined) {
            const jsxElement = path.node;
            
            // Only modify if the element has simple text content (no nested JSX elements)
            const hasOnlyTextChildren = jsxElement.children.every(child => 
              t.isJSXText(child) || 
              (t.isJSXExpressionContainer(child) && t.isStringLiteral(child.expression))
            );

            if (hasOnlyTextChildren || jsxElement.children.length === 0) {
              // Safe to replace - element only contains text
              jsxElement.children = [t.jsxText(changes.textContent)];
              hasChanges = true;
            } else {
              // Element has nested JSX children - find and replace only text nodes
              console.log(`[Server] AST: Element has nested children, modifying only text nodes`);
              let textModified = false;
              for (let i = 0; i < jsxElement.children.length; i++) {
                const child = jsxElement.children[i];
                if (t.isJSXText(child) && child.value.trim()) {
                  // Replace this text node
                  jsxElement.children[i] = t.jsxText(changes.textContent);
                  textModified = true;
                  break; // Only replace first text node
                }
              }
              if (textModified) {
                hasChanges = true;
              }
            }
          }
        }
      });

      if (!hasChanges) {
        console.log(`[Server] AST: No matching element found for selector: ${selector}`);
        return null;
      }

      // Generate code from modified AST
      const output = babelGenerate(ast, {
        retainLines: true,
        retainFunctionParens: true,
      }, content);

      // Validate the generated code before returning
      if (!this.validateJsxSyntax(output.code)) {
        console.error('[Server] AST: Generated code failed validation, aborting changes');
        return null;
      }

      console.log(`[Server] AST: Successfully modified element`);
      return output.code;

    } catch (error) {
      console.error(`[Server] AST: Error parsing/modifying JSX:`, error);
      
      // Fallback: return null to indicate failure (don't corrupt the file)
      return null;
    }
  }

  /**
   * Merge Tailwind classes intelligently
   * Replaces classes from the same "group" instead of adding duplicates
   * Also handles dark: variants - when changing a color, removes conflicting dark: variants
   */
  private mergeClassesInBackend(existingClasses: string, newClasses: string): string {
    // Define class groups (mutually exclusive classes)
    const classGroups: Record<string, RegExp> = {
      // Colors (including arbitrary values like text-[#ff0000])
      textColor: /^text-(\[.+?\]|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-\d+)?)$/,
      bgColor: /^bg-(\[.+?\]|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black|transparent)(-\d+)?)$/,
      borderColor: /^border-(\[.+?\]|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black|transparent)(-\d+)?)$/,
      
      // Dark mode variants for colors
      darkTextColor: /^dark:text-(\[.+?\]|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-\d+)?)$/,
      darkBgColor: /^dark:bg-(\[.+?\]|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black|transparent)(-\d+)?)$/,
      darkBorderColor: /^dark:border-(\[.+?\]|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black|transparent)(-\d+)?)$/,
      
      // Typography
      fontSize: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/,
      fontWeight: /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/,
      textAlign: /^text-(left|center|right|justify|start|end)$/,
      
      // Spacing
      padding: /^p-/,
      paddingX: /^px-/,
      paddingY: /^py-/,
      paddingTop: /^pt-/,
      paddingRight: /^pr-/,
      paddingBottom: /^pb-/,
      paddingLeft: /^pl-/,
      margin: /^m-/,
      marginX: /^mx-/,
      marginY: /^my-/,
      marginTop: /^mt-/,
      marginRight: /^mr-/,
      marginBottom: /^mb-/,
      marginLeft: /^ml-/,
      
      // Sizing
      width: /^w-/,
      height: /^h-/,
      
      // Layout
      display: /^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden|contents)$/,
      position: /^(static|relative|absolute|fixed|sticky)$/,
      
      // Flexbox
      flexDirection: /^flex-(row|row-reverse|col|col-reverse)$/,
      justifyContent: /^justify-/,
      alignItems: /^items-/,
      gap: /^gap-/,
      
      // Border
      borderRadius: /^rounded-/,
      
      // Effects
      shadow: /^shadow-/,
      opacity: /^opacity-/,
    };

    // Map base groups to their dark variants (to remove dark: when changing base color)
    const groupToDarkVariant: Record<string, string> = {
      textColor: 'darkTextColor',
      bgColor: 'darkBgColor',
      borderColor: 'darkBorderColor',
    };

    const getClassGroup = (cls: string): string | null => {
      for (const [group, pattern] of Object.entries(classGroups)) {
        if (pattern.test(cls)) {
          return group;
        }
      }
      return null;
    };

    const existing = existingClasses.split(/\s+/).filter(Boolean);
    const newOnes = newClasses.split(/\s+/).filter(Boolean);
    
    // Map existing classes by group
    const existingByGroup = new Map<string, string[]>();
    const ungroupedExisting: string[] = [];
    
    for (const cls of existing) {
      const group = getClassGroup(cls);
      if (group) {
        if (!existingByGroup.has(group)) {
          existingByGroup.set(group, []);
        }
        existingByGroup.get(group)!.push(cls);
      } else {
        ungroupedExisting.push(cls);
      }
    }
    
    // Build result: ungrouped + new classes (replacing same-group existing)
    const result = [...ungroupedExisting];
    const usedGroups = new Set<string>();
    
    // Add all new classes first
    for (const cls of newOnes) {
      const group = getClassGroup(cls);
      if (group) {
        usedGroups.add(group);
        // Also mark the dark variant as used (to remove dark:text-* when changing text-*)
        const darkVariant = groupToDarkVariant[group];
        if (darkVariant) {
          usedGroups.add(darkVariant);
          console.log(`[Server] mergeClasses: Adding ${cls} (${group}), also removing ${darkVariant} variants`);
        }
        result.push(cls);
      } else if (!result.includes(cls)) {
        result.push(cls);
      }
    }
    
    // Re-add grouped existing classes that weren't replaced
    for (const [group, classes] of existingByGroup.entries()) {
      if (!usedGroups.has(group)) {
        result.push(...classes);
      } else {
        console.log(`[Server] mergeClasses: Removing existing ${group} classes: ${classes.join(', ')}`);
      }
    }
    
    return result.join(' ');
  }

  /**
   * Apply style changes to a CSS file
   */
  private async applyChangesToCssFile(
    content: string, 
    selector: string, 
    changes: { styles?: Record<string, string> }
  ): Promise<string | null> {
    if (!changes.styles || Object.keys(changes.styles).length === 0) {
      return null;
    }

    let modified = content;
    
    // Convert camelCase to kebab-case for CSS
    const cssProperties = Object.entries(changes.styles)
      .map(([key, value]) => {
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `  ${cssKey}: ${value};`;
      })
      .join('\n');

    // Check if selector exists in CSS
    const selectorRegex = new RegExp(
      `(${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s*\\{([^}]*)\\}`,
      'g'
    );

    if (selectorRegex.test(content)) {
      // Update existing selector
      modified = content.replace(selectorRegex, (match, sel, props) => {
        // Merge properties
        return `${sel} {\n${cssProperties}\n}`;
      });
    } else {
      // Add new selector block at the end
      modified = content + `\n\n${selector} {\n${cssProperties}\n}\n`;
    }

    return modified;
  }

  /**
   * Apply changes to an HTML file
   */
  private async applyChangesToHtmlFile(
    content: string, 
    selector: string, 
    changes: { styles?: Record<string, string>; textContent?: string }
  ): Promise<string | null> {
    let modified = content;
    let hasChanges = false;

    const idMatch = selector.match(/#([\w-]+)/);
    const classMatch = selector.match(/\.(\w[\w-]*)/);
    
    const id = idMatch?.[1];
    const className = classMatch?.[1];

    if (changes.styles && Object.keys(changes.styles).length > 0) {
      const styleString = Object.entries(changes.styles)
        .map(([key, value]) => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          return `${cssKey}: ${value}`;
        })
        .join('; ');

      if (id) {
        const idRegex = new RegExp(`(<[^>]*id=["']${id}["'][^>]*)(>)`, 'g');
        if (idRegex.test(content)) {
          modified = content.replace(idRegex, (match, before, after) => {
            if (before.includes('style=')) {
              return before.replace(/style=["'][^"']*["']/, `style="${styleString}"`) + after;
            }
            return `${before} style="${styleString}"${after}`;
          });
          hasChanges = true;
        }
      }

      if (!hasChanges && className) {
        const classRegex = new RegExp(`(<[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*)(>)`, 'g');
        if (classRegex.test(content)) {
          modified = content.replace(classRegex, (match, before, after) => {
            if (before.includes('style=')) {
              return before.replace(/style=["'][^"']*["']/, `style="${styleString}"`) + after;
            }
            return `${before} style="${styleString}"${after}`;
          });
          hasChanges = true;
        }
      }
    }

    return hasChanges ? modified : null;
  }

  // ============== End Element Change Application ==============

  public async start(): Promise<string> {
    // Vérifier et réserver le port avec ProcessManager
    try {
      console.log(`[Server] Checking port ${this.port} availability...`);
      this.port = await this.processManager.reservePort(this.port, true);
      console.log(`[Server] Port ${this.port} reserved`);
    } catch (error) {
      console.error('[Server] Failed to reserve port:', error);
      throw error;
    }

    // Enregistrer le callback de nettoyage
    this.processManager.registerCleanup(async () => {
      console.log('[Server] ProcessManager cleanup callback triggered');
      this.stop();
    });

    return new Promise((resolve, reject) => {
      this.server.listen(this.port, '127.0.0.1', () => {
        const url = `http://127.0.0.1:${this.port}`;
        console.log(`[Server] AI App Builder server running at ${url}`);
        resolve(url);
      });

      this.server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`[Server] Port ${this.port} is already in use`);
          reject(new Error(`Port ${this.port} is already in use`));
        } else {
          reject(error);
        }
      });
    });
  }

  public stop(): void {
    console.log('[Server] Stopping server...');
    
    // Stop all Next.js processes
    for (const [projectPath, child] of this.nextJsProcesses) {
      console.log(`[Server] Stopping Next.js project at ${projectPath}`);
      try {
        child.kill('SIGTERM');
        // Force kill si toujours en vie après 2s
        setTimeout(() => {
          if (!child.killed) {
            console.log(`[Server] Force killing Next.js project at ${projectPath}`);
            child.kill('SIGKILL');
          }
        }, 2000);
      } catch (error) {
        console.error(`[Server] Error stopping Next.js project at ${projectPath}:`, error);
      }
    }
    this.nextJsProcesses.clear();

    // Close WebSocket connections
    this.clients.forEach(client => {
      try {
        client.close();
      } catch (error) {
        console.error('[Server] Error closing WebSocket client:', error);
      }
    });
    this.clients.clear();
    
    // Close WebSocket server
    try {
      this.wss.close();
    } catch (error) {
      console.error('[Server] Error closing WebSocket server:', error);
    }
    
    // Close HTTP server
    try {
      this.server.close();
    } catch (error) {
      console.error('[Server] Error closing HTTP server:', error);
    }
    
    console.log('[Server] Server stopped');
  }

  public getPort(): number {
    return this.port;
  }
}
