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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppBuilderServer = void 0;
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const http = __importStar(require("http"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const modelBridge_1 = require("./modelBridge");
const chatParticipant_1 = require("./chatParticipant");
const activityTracker_1 = require("./activityTracker");
// Babel imports for safe AST manipulation
const babelParser = __importStar(require("@babel/parser"));
const traverse_1 = __importDefault(require("@babel/traverse"));
const generator_1 = __importDefault(require("@babel/generator"));
const t = __importStar(require("@babel/types"));
/**
 * Serveur HTTP + WebSocket pour la communication avec le panel Next.js
 */
class AppBuilderServer {
    app;
    server;
    wss;
    clients = new Set();
    modelBridge;
    activityTracker;
    port;
    nextJsProjects = new Map();
    nextJsProcesses = new Map();
    constructor(port) {
        this.port = port;
        this.modelBridge = modelBridge_1.ModelBridge.getInstance();
        this.activityTracker = activityTracker_1.ActivityTracker.getInstance();
        this.app = (0, express_1.default)();
        this.server = http.createServer(this.app);
        this.wss = new ws_1.WebSocketServer({ server: this.server });
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.setupModelBridgeListeners();
        this.setupChatParticipantBridge();
        this.setupActivityTracker();
    }
    setupMiddleware() {
        this.app.use(express_1.default.json());
        // CORS pour le panel Next.js
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            if (req.method === 'OPTIONS') {
                return res.sendStatus(200);
            }
            next();
        });
    }
    setupRoutes() {
        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({ status: 'ok', timestamp: Date.now() });
        });
        // Liste des modèles (API REST fallback)
        this.app.get('/api/models', async (req, res) => {
            try {
                const models = await this.modelBridge.getModelsByVendor();
                res.json({ success: true, data: models });
            }
            catch (error) {
                res.status(500).json({ success: false, error: String(error) });
            }
        });
        // Changer le modèle (API REST fallback)
        this.app.post('/api/models/change', async (req, res) => {
            try {
                const payload = req.body;
                const success = await this.modelBridge.changeModel(payload);
                res.json({ success });
            }
            catch (error) {
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
    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('[Server] New WebSocket client connected');
            this.clients.add(ws);
            // Envoyer la liste des modèles au nouveau client
            this.sendModelsToClient(ws);
            ws.on('message', async (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    await this.handleWebSocketMessage(ws, message);
                }
                catch (error) {
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
    async handleWebSocketMessage(ws, message) {
        console.log(`[Server] Received message: ${message.type}`);
        switch (message.type) {
            case 'listModels':
                await this.sendModelsToClient(ws);
                break;
            case 'changeModel':
                const payload = message.payload;
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
            case 'detectMCPServers':
                await this.detectAndSendMCPServers(ws);
                break;
            case 'applyElementChanges':
                await this.handleApplyElementChanges(ws, message);
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
    async sendModelsToClient(ws) {
        const models = await this.modelBridge.getModelsByVendor();
        this.sendToClient(ws, {
            type: 'modelsUpdated',
            payload: models
        });
    }
    async sendWorkspaceInfo(ws) {
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
    async getWorkspaceInfo() {
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
    async buildFileTree(rootPath, currentPath, maxDepth = 10, currentDepth = 0) {
        const tree = {};
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
                }
                else {
                    tree[itemId] = {
                        name: entry.name,
                        path: relativePath.replace(/\\/g, '/'),
                        type: 'file'
                    };
                }
            }
        }
        catch (error) {
            console.error(`[Server] Error reading directory ${currentPath}:`, error);
        }
        return tree;
    }
    async handleChatMessage(ws, message) {
        const { message: userMessage, requestId } = message.payload;
        await this.modelBridge.sendMessage(userMessage, 
        // onChunk
        (chunk) => {
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
        (error) => {
            this.sendToClient(ws, {
                type: 'messageError',
                payload: { error },
                requestId
            });
        });
    }
    async handleCopilotMessage(ws, message) {
        const { prompt, requestId } = message.payload;
        await this.modelBridge.sendToCopilotChat(prompt, 
        // onWord - reçoit chaque mot individuellement
        (word) => {
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
        (error) => {
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
        });
    }
    /**
     * Handler pour envoyer un prompt au Chat Participant @builder
     * Ouvre le Copilot Chat avec @builder et le prompt
     */
    async handleBuilderMessage(ws, message) {
        const { prompt, requestId } = message.payload;
        console.log(`[Server] Sending to @builder: "${prompt.substring(0, 50)}..."`);
        try {
            const chatParticipant = chatParticipant_1.ChatParticipantBridge.getInstance();
            await chatParticipant.sendPrompt(prompt);
            // Note: Les réponses arriveront via les callbacks configurés dans setupChatParticipantBridge
            // et seront automatiquement broadcastés à tous les clients
        }
        catch (error) {
            console.error('[Server] Error sending to @builder:', error);
            this.sendToClient(ws, {
                type: 'builderResponseError',
                payload: { error: String(error), requestId }
            });
        }
    }
    sendToClient(ws, message) {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    }
    broadcastToAll(message) {
        const data = JSON.stringify(message);
        this.clients.forEach(client => {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(data);
            }
        });
    }
    setupModelBridgeListeners() {
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
    setupChatParticipantBridge() {
        const chatParticipant = chatParticipant_1.ChatParticipantBridge.getInstance();
        chatParticipant.setCallbacks({
            // Quand un prompt est reçu via @builder
            onPromptReceived: (prompt, requestId) => {
                console.log(`[Server] @builder received prompt: "${prompt.substring(0, 50)}..."`);
                this.broadcastToAll({
                    type: 'builderPromptReceived',
                    payload: { prompt, requestId }
                });
            },
            // Quand un chunk de réponse arrive (streaming)
            onResponseChunk: (chunk, requestId) => {
                console.log(`[Server] @builder chunk: ${chunk.length} chars`);
                this.broadcastToAll({
                    type: 'builderResponseChunk',
                    payload: { chunk, requestId }
                });
            },
            // Quand la réponse est complète
            onResponseComplete: (fullResponse, requestId) => {
                console.log(`[Server] @builder complete: ${fullResponse.length} chars`);
                this.broadcastToAll({
                    type: 'builderResponseComplete',
                    payload: { fullResponse, requestId }
                });
            },
            // Quand une erreur se produit
            onResponseError: (error, requestId) => {
                console.error(`[Server] @builder error: ${error}`);
                this.broadcastToAll({
                    type: 'builderResponseError',
                    payload: { error, requestId }
                });
            }
        });
        console.log('[Server] Chat Participant Bridge connected');
    }
    /**
     * Configure l'ActivityTracker pour capturer les événements en temps réel
     * et les envoyer au panel (fichiers lus, créés, modifiés, etc.)
     */
    setupActivityTracker() {
        this.activityTracker.setCallbacks({
            onActivity: (activity) => {
                // Envoyer l'activité à tous les clients connectés
                this.broadcastToAll({
                    type: 'activity',
                    payload: activity
                });
            }
        });
        // Démarrer le tracking
        this.activityTracker.startTracking();
        console.log('[Server] Activity Tracker connected and tracking');
    }
    // ============== Next.js Project Management ==============
    async detectNextJsProjects() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders)
            return [];
        const projects = [];
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
    async scanForNextJsProjects(dirPath, projects, depth = 0) {
        if (depth > 5)
            return; // Limit depth
        try {
            const packageJsonPath = path.join(dirPath, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
                if (dependencies && dependencies['next']) {
                    // Check for next.config
                    const hasNextConfig = fs.existsSync(path.join(dirPath, 'next.config.js')) ||
                        fs.existsSync(path.join(dirPath, 'next.config.mjs')) ||
                        fs.existsSync(path.join(dirPath, 'next.config.ts'));
                    projects.push({
                        path: dirPath,
                        name: packageJson.name || path.basename(dirPath),
                        packageJsonPath,
                        hasNextConfig,
                        port: 3000,
                        status: 'stopped'
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
        }
        catch (error) {
            console.error(`[Server] Error scanning ${dirPath}:`, error);
        }
    }
    async detectAndSendNextJsProjects(ws) {
        console.log('[Server] Detecting Next.js projects...');
        const projects = await this.detectNextJsProjects();
        console.log(`[Server] Found ${projects.length} Next.js projects`);
        this.sendToClient(ws, {
            type: 'nextJsProjectsDetected',
            payload: { projects }
        });
    }
    async startNextJsProject(ws, projectPath, port = 3000) {
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
            const homeDir = process.env.HOME || '/Users/moneyprinter';
            // Build the full command with absolute paths
            let fullCommand;
            if (hasBunLock) {
                const bunPath = `${homeDir}/.bun/bin/bun`;
                fullCommand = `"${bunPath}" run dev --port ${port}`;
            }
            else if (hasPnpmLock) {
                fullCommand = `pnpm dev --port ${port}`;
            }
            else if (hasYarnLock) {
                fullCommand = `yarn dev --port ${port}`;
            }
            else {
                fullCommand = `npm run dev -- --port ${port}`;
            }
            // Enhanced PATH - include project's node_modules/.bin for local binaries like 'next'
            const additionalPaths = [
                path.join(projectPath, 'node_modules', '.bin'), // Local project binaries (next, etc.)
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
            const child = (0, child_process_1.spawn)('/bin/zsh', ['-c', fullCommand], {
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
        }
        catch (error) {
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
    async stopNextJsProject(ws, projectPath) {
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
    // ============== MCP Server Detection ==============
    async detectAndSendMCPServers(ws) {
        console.log('[Server] Detecting MCP servers...');
        const servers = await this.detectMCPServers();
        console.log(`[Server] Found ${servers.length} MCP servers`);
        this.sendToClient(ws, {
            type: 'mcpServersDetected',
            payload: { servers }
        });
    }
    async detectMCPServers() {
        try {
            const servers = [];
            // Check VS Code settings for MCP servers
            const config = vscode.workspace.getConfiguration();
            // Check for MCP servers in different possible configuration locations
            const mcpConfig = config.get('mcp.servers') ||
                config.get('mcpServers') ||
                config.get('github.copilot.chat.codeGeneration.mcp.servers') ||
                {};
            console.log('[Server] VS Code MCP Config:', Object.keys(mcpConfig).length, 'servers');
            // Parse MCP server configurations
            for (const [name, serverConfig] of Object.entries(mcpConfig)) {
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
                                for (const [name, serverConfig] of Object.entries(mcpServers)) {
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
                    }
                    catch (error) {
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
                            for (const [name, serverConfig] of Object.entries(mcpServers)) {
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
                    catch (error) {
                        console.error('[Server] Error reading mcp.json:', error);
                    }
                }
            }
            console.log(`[Server] Found ${servers.length} MCP servers total`);
            return servers;
        }
        catch (error) {
            console.error('[Server] Error detecting MCP servers:', error);
            return [];
        }
    }
    getNestedProperty(obj, path) {
        const keys = path.split('.');
        let current = obj;
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            }
            else {
                return undefined;
            }
        }
        return current;
    }
    /**
     * Fetch tools from an MCP server using the MCP protocol
     */
    async fetchMCPTools(server) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                mcpProcess.kill();
                reject(new Error('MCP server timeout'));
            }, 10000); // 10 second timeout
            let stdout = '';
            let stderr = '';
            let initialized = false;
            // Spawn the MCP server process
            const mcpProcess = (0, child_process_1.spawn)(server.command, server.args, {
                env: { ...process.env, ...server.env },
                stdio: ['pipe', 'pipe', 'pipe']
            });
            mcpProcess.stdout?.on('data', (data) => {
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
                                const formattedTools = tools.map((tool) => ({
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
                        }
                        catch (e) {
                            // Not valid JSON, continue collecting output
                        }
                    }
                }
                // Keep the last incomplete line
                stdout = lines[lines.length - 1];
            });
            mcpProcess.stderr?.on('data', (data) => {
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
    // ============== Element Change Application ==============
    /**
     * Handle applying element changes to source code files
     * This method finds the source file based on the URL and selector,
     * then modifies the styles/text in the source code
     */
    async handleApplyElementChanges(ws, message) {
        const { selector, changes, url } = message.payload;
        console.log(`[Server] Applying element changes:`, { selector, changes, url });
        try {
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
            let newContent = null;
            if (ext === '.tsx' || ext === '.jsx') {
                newContent = await this.applyChangesToReactFile(content, selector, changes);
            }
            else if (ext === '.css' || ext === '.scss' || ext === '.sass') {
                newContent = await this.applyChangesToCssFile(content, selector, changes);
            }
            else if (ext === '.html') {
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
            }
            else {
                // Send a response indicating the element/styles couldn't be found
                this.sendToClient(ws, {
                    type: 'elementChangesError',
                    payload: {
                        error: 'Could not find element in source file to modify',
                        selector,
                        file: sourceFile
                    }
                });
            }
        }
        catch (error) {
            console.error(`[Server] Error applying element changes:`, error);
            this.sendToClient(ws, {
                type: 'elementChangesError',
                payload: { error: String(error), selector }
            });
        }
    }
    /**
     * Find the source file based on the preview URL
     */
    async findSourceFileFromUrl(url) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder)
            return null;
        const rootPath = workspaceFolder.uri.fsPath;
        try {
            // Parse the URL to get the route and port
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const port = urlObj.port;
            console.log(`[Server] Finding source for path: ${pathname}, port: ${port}`);
            // First, try to find the project by matching the port with running Next.js projects
            let projectRoot = null;
            for (const [projectPath, project] of this.nextJsProjects) {
                if (project.port?.toString() === port) {
                    projectRoot = projectPath;
                    console.log(`[Server] Found project by port: ${projectRoot}`);
                    break;
                }
            }
            // If not found by port, search for Next.js projects in workspace
            if (!projectRoot) {
                const nextJsProjects = await this.findNextJsProjectsInWorkspace(rootPath);
                if (nextJsProjects.length === 1) {
                    projectRoot = nextJsProjects[0];
                }
                else if (nextJsProjects.length > 1) {
                    // Try to find the one running on this port
                    // For now, use the first one that has an app/page.tsx
                    for (const proj of nextJsProjects) {
                        const appPage = path.join(proj, 'app', 'page.tsx');
                        if (fs.existsSync(appPage)) {
                            projectRoot = proj;
                            break;
                        }
                    }
                    if (!projectRoot)
                        projectRoot = nextJsProjects[0];
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
            ].filter(Boolean);
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
            ].filter(Boolean);
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
                const mainPage = sourceFiles.find(f => f.includes('page.tsx') || f.includes('page.jsx') || f.includes('index.tsx'));
                return mainPage || sourceFiles[0];
            }
        }
        catch (error) {
            console.error(`[Server] Error finding source file:`, error);
        }
        return null;
    }
    /**
     * Find all Next.js projects in the workspace
     */
    async findNextJsProjectsInWorkspace(rootPath) {
        const projects = [];
        const scanDir = (dirPath, depth = 0) => {
            if (depth > 3)
                return;
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
                    }
                    catch (e) {
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
            }
            catch (e) {
                // Ignore errors
            }
        };
        scanDir(rootPath);
        return projects;
    }
    /**
     * Find all source files in the project
     */
    async findAllSourceFiles(dirPath, files = [], depth = 0) {
        if (depth > 5)
            return files;
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    if (!['node_modules', '.next', 'dist', 'build', '.git'].includes(entry.name)) {
                        await this.findAllSourceFiles(fullPath, files, depth + 1);
                    }
                }
                else if (entry.isFile()) {
                    const ext = path.extname(entry.name).toLowerCase();
                    if (['.tsx', '.jsx', '.css', '.scss'].includes(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        }
        catch (error) {
            console.error(`[Server] Error scanning ${dirPath}:`, error);
        }
        return files;
    }
    /**
     * Validate TSX/JSX content is syntactically correct
     */
    validateJsxSyntax(content) {
        try {
            babelParser.parse(content, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript']
            });
            return true;
        }
        catch (e) {
            console.error('[Server] JSX validation failed:', e);
            return false;
        }
    }
    /**
     * Apply style changes to a React/TSX file using Babel AST (safe approach)
     */
    async applyChangesToReactFile(content, selector, changes) {
        // Extract element info from selector
        const tagMatch = selector.match(/^(\w+)/);
        const idMatch = selector.match(/#([\w-]+)/);
        const classMatch = selector.match(/\.(\w[\w-]*)/g);
        const targetTag = tagMatch?.[1]?.toLowerCase();
        const targetId = idMatch?.[1];
        const targetClasses = classMatch?.map(c => c.slice(1)) || [];
        console.log(`[Server] AST: Parsed selector:`, { targetTag, targetId, targetClasses });
        let hasChanges = false;
        let elementFound = false;
        try {
            // Parse the JSX content into an AST
            const ast = babelParser.parse(content, {
                sourceType: 'module',
                plugins: ['jsx', 'typescript']
            });
            // Traverse the AST to find and modify the target element
            // Use JSXElement instead of JSXOpeningElement to have access to children
            (0, traverse_1.default)(ast, {
                JSXElement: (path) => {
                    // Only modify the first matching element
                    if (elementFound)
                        return;
                    const openingElement = path.node.openingElement;
                    const elementName = t.isJSXIdentifier(openingElement.name) ? openingElement.name.name : null;
                    if (!elementName)
                        return;
                    // Check if this element matches our selector
                    let isMatch = false;
                    // Get element attributes
                    const attributes = openingElement.attributes.filter((attr) => t.isJSXAttribute(attr));
                    // Check for ID match
                    if (targetId) {
                        const idAttr = attributes.find((attr) => t.isJSXIdentifier(attr.name) && attr.name.name === 'id');
                        if (idAttr && t.isStringLiteral(idAttr.value) && idAttr.value.value === targetId) {
                            isMatch = true;
                        }
                    }
                    // Check for className match
                    if (!isMatch && targetClasses.length > 0) {
                        const classAttr = attributes.find((attr) => t.isJSXIdentifier(attr.name) && attr.name.name === 'className');
                        if (classAttr && t.isStringLiteral(classAttr.value)) {
                            const classNames = classAttr.value.value.split(/\s+/);
                            if (targetClasses.some(tc => classNames.includes(tc))) {
                                isMatch = true;
                            }
                        }
                    }
                    // Check for tag match (if no id or class specified, or as fallback)
                    if (!isMatch && targetTag && elementName.toLowerCase() === targetTag && !targetId && targetClasses.length === 0) {
                        isMatch = true;
                    }
                    if (!isMatch)
                        return;
                    // Mark as found to stop after first match
                    elementFound = true;
                    console.log(`[Server] AST: Found matching element: ${elementName}`);
                    // Apply style changes
                    if (changes.styles && Object.keys(changes.styles).length > 0) {
                        // Find existing style attribute
                        const styleAttrIndex = attributes.findIndex((attr) => t.isJSXIdentifier(attr.name) && attr.name.name === 'style');
                        // Create new style object properties
                        const styleProperties = Object.entries(changes.styles).map(([key, value]) => t.objectProperty(t.identifier(key), t.stringLiteral(value)));
                        const newStyleExpr = t.jsxExpressionContainer(t.objectExpression(styleProperties));
                        if (styleAttrIndex >= 0) {
                            // Update existing style attribute
                            const existingStyleAttr = openingElement.attributes[styleAttrIndex];
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
                            }
                            else {
                                // Replace with new style
                                existingStyleAttr.value = newStyleExpr;
                            }
                        }
                        else {
                            // Add new style attribute
                            const styleAttr = t.jsxAttribute(t.jsxIdentifier('style'), newStyleExpr);
                            openingElement.attributes.push(styleAttr);
                        }
                        hasChanges = true;
                    }
                    // Apply text content changes - only modify direct text children, not nested elements
                    if (changes.textContent !== undefined) {
                        const jsxElement = path.node;
                        // Only modify if the element has simple text content (no nested JSX elements)
                        const hasOnlyTextChildren = jsxElement.children.every(child => t.isJSXText(child) ||
                            (t.isJSXExpressionContainer(child) && t.isStringLiteral(child.expression)));
                        if (hasOnlyTextChildren || jsxElement.children.length === 0) {
                            // Safe to replace - element only contains text
                            jsxElement.children = [t.jsxText(changes.textContent)];
                            hasChanges = true;
                        }
                        else {
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
            const output = (0, generator_1.default)(ast, {
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
        }
        catch (error) {
            console.error(`[Server] AST: Error parsing/modifying JSX:`, error);
            // Fallback: return null to indicate failure (don't corrupt the file)
            return null;
        }
    }
    /**
     * Apply style changes to a CSS file
     */
    async applyChangesToCssFile(content, selector, changes) {
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
        const selectorRegex = new RegExp(`(${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s*\\{([^}]*)\\}`, 'g');
        if (selectorRegex.test(content)) {
            // Update existing selector
            modified = content.replace(selectorRegex, (match, sel, props) => {
                // Merge properties
                return `${sel} {\n${cssProperties}\n}`;
            });
        }
        else {
            // Add new selector block at the end
            modified = content + `\n\n${selector} {\n${cssProperties}\n}\n`;
        }
        return modified;
    }
    /**
     * Apply changes to an HTML file
     */
    async applyChangesToHtmlFile(content, selector, changes) {
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
    async start() {
        return new Promise((resolve, reject) => {
            this.server.listen(this.port, '127.0.0.1', () => {
                const url = `http://127.0.0.1:${this.port}`;
                console.log(`[Server] AI App Builder server running at ${url}`);
                resolve(url);
            });
            this.server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    reject(new Error(`Port ${this.port} is already in use`));
                }
                else {
                    reject(error);
                }
            });
        });
    }
    stop() {
        // Stop all Next.js processes
        for (const [projectPath, child] of this.nextJsProcesses) {
            console.log(`[Server] Stopping Next.js project at ${projectPath}`);
            child.kill('SIGTERM');
        }
        this.nextJsProcesses.clear();
        this.clients.forEach(client => client.close());
        this.clients.clear();
        this.wss.close();
        this.server.close();
        console.log('[Server] Server stopped');
    }
    getPort() {
        return this.port;
    }
}
exports.AppBuilderServer = AppBuilderServer;
//# sourceMappingURL=server.js.map