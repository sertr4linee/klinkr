import * as vscode from 'vscode';
import express from 'express';
import * as http from 'http';
import * as path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import { CopilotChatManager } from './copilotChat';

export class WebServer {
    private app: express.Application;
    private server: http.Server | undefined;
    private wss: WebSocketServer | undefined;
    private port: number;
    private clients: Set<WebSocket> = new Set();
    public readonly onDidReceiveConnection = new vscode.EventEmitter<string>();

    constructor(private context: vscode.ExtensionContext, port?: number) {
        const config = vscode.workspace.getConfiguration('copilotModelsViewer');
        this.port = port || config.get('port', 60885);
        this.app = express();
        this.setupRoutes();
    }

    private setupRoutes() {
        // Middleware pour parser JSON
        this.app.use(express.json());
        
        // Middleware pour logger les connexions
        this.app.use((req, res, next) => {
            const ip = req.ip || req.socket.remoteAddress;
            // Ignorer les requêtes de fichiers statiques pour ne pas spammer les logs
            if (!req.url.match(/\.(js|css|png|jpg|ico|svg|woff|woff2)$/)) {
                this.onDidReceiveConnection.fire(`Request: ${req.method} ${req.url}`);
            }
            next();
        });

        // Servir tous les fichiers statiques depuis le dossier out
        const staticPath = path.join(this.context.extensionPath, 'www', 'out');
        this.app.use(express.static(staticPath));

        // Route pour la page principale
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(staticPath, 'index.html'));
        });

        // API: Récupérer les modèles Copilot disponibles
        this.app.get('/api/models', async (req, res) => {
            try {
                const models = await this.getCopilotModels();
                
                // Marquer les modèles qui sont des "agents" (peuvent être utilisés dans le chat)
                const modelsWithTypes = models.map(model => {
                    const modelId = model.id.toLowerCase();
                    const modelName = model.name?.toLowerCase() || '';
                    
                    // Détecter les modèles agents (ceux qui peuvent faire du chat)
                    const isAgent = 
                        modelId.includes('gpt') || 
                        modelId.includes('claude') || 
                        modelId.includes('o1') ||
                        modelId.includes('o3') ||
                        modelName.includes('copilot') ||
                        modelName.includes('agent') ||
                        model.family?.toLowerCase().includes('agent');
                    
                    return {
                        ...model,
                        isAgent,
                        capabilities: {
                            chat: true,
                            code: isAgent,
                            streaming: true
                        }
                    };
                });
                
                res.json({
                    success: true,
                    models: modelsWithTypes,
                    timestamp: new Date().toISOString(),
                    totalCount: modelsWithTypes.length,
                    agentCount: modelsWithTypes.filter(m => m.isAgent).length
                });
            } catch (error: any) {
                res.status(500).json({
                    success: false,
                    error: error.message || 'Erreur lors de la récupération des modèles'
                });
            }
        });

        // API: Status de la connexion
        this.app.get('/api/status', (req, res) => {
            // Récupérer le workspace actif
            const workspaceFolders = vscode.workspace.workspaceFolders;
            const currentPath = workspaceFolders && workspaceFolders.length > 0
                ? workspaceFolders[0].uri.fsPath
                : process.cwd();

            res.json({
                success: true,
                status: 'connected',
                port: this.port,
                clients: this.clients.size,
                currentPath: currentPath,
                timestamp: new Date().toISOString()
            });
        });

        // API: Health check
        this.app.get('/api/health', (req, res) => {
            res.json({ status: 'ok' });
        });

        // API: File tree
        this.app.get('/api/file-tree', async (req, res) => {
            try {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders || workspaceFolders.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'No workspace folder found'
                    });
                }

                const workspacePath = workspaceFolders[0].uri.fsPath;
                const tree = await this.buildFileTree(workspacePath);

                res.json({
                    success: true,
                    tree: tree,
                    workspacePath: workspacePath
                });
            } catch (error: any) {
                console.error('Error building file tree:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error building file tree'
                });
            }
        });

        // API: Detect projects
        this.app.get('/api/detect-projects', async (req, res) => {
            try {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders || workspaceFolders.length === 0) {
                    return res.json({
                        success: true,
                        projects: [],
                        workspacePath: null
                    });
                }

                const workspacePath = workspaceFolders[0].uri.fsPath;
                const projects = await this.detectProjects(workspacePath);

                res.json({
                    success: true,
                    projects: projects,
                    workspacePath: workspacePath
                });
            } catch (error: any) {
                console.error('Error detecting projects:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error detecting projects'
                });
            }
        });

        // API: Envoyer un prompt au Copilot (workflow amélioré)
        this.app.post('/api/copilot/send', async (req, res) => {
            try {
                const { message, modelId } = req.body;

                if (!message) {
                    return res.status(400).json({
                        success: false,
                        error: 'No message provided'
                    });
                }

                const copilotManager = CopilotChatManager.getInstance();
                
                // Vérifier si Copilot est disponible
                const isAvailable = await copilotManager.isCopilotAvailable();
                if (!isAvailable) {
                    return res.status(503).json({
                        success: false,
                        error: 'Copilot is not installed or not available'
                    });
                }

                // Envoyer le prompt via le nouveau workflow
                const result = await copilotManager.sendPromptToCopilot(message, modelId);

                res.json({
                    success: result.success,
                    status: result.status,
                    message: result.message,
                    error: result.error,
                    modelId: result.modelId
                });
            } catch (error: any) {
                console.error('Error sending to Copilot:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error sending to Copilot'
                });
            }
        });

        // API: Ouvrir le message dans le vrai panel Copilot de VS Code (legacy)
        this.app.post('/api/copilot/open', async (req, res) => {
            try {
                const { message, modelId } = req.body;

                if (!message) {
                    return res.status(400).json({
                        success: false,
                        error: 'No message provided'
                    });
                }

                const copilotManager = CopilotChatManager.getInstance();
                
                // Vérifier si Copilot est disponible
                const isAvailable = await copilotManager.isCopilotAvailable();
                if (!isAvailable) {
                    return res.status(503).json({
                        success: false,
                        error: 'Copilot is not installed or not available'
                    });
                }

                // Utiliser le nouveau workflow
                const result = await copilotManager.sendPromptToCopilot(message, modelId);

                res.json({
                    success: result.success,
                    status: result.status,
                    message: result.message || 'Copilot panel opened with message'
                });
            } catch (error: any) {
                console.error('Error opening Copilot:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error opening Copilot'
                });
            }
        });

        // API: Créer une nouvelle conversation Copilot et envoyer un prompt
        this.app.post('/api/copilot/new', async (req, res) => {
            try {
                const { message, modelId } = req.body;
                const copilotManager = CopilotChatManager.getInstance();
                
                // Créer un nouveau chat
                await copilotManager.createNewChat();

                // Si un message est fourni, l'envoyer via le nouveau workflow
                if (message) {
                    // Attendre que le nouveau chat soit prêt
                    await new Promise(resolve => setTimeout(resolve, 300));
                    const result = await copilotManager.sendPromptToCopilot(message, modelId);
                    
                    return res.json({
                        success: result.success,
                        status: result.status,
                        message: 'New chat created' + (result.success ? ' and prompt sent' : ''),
                        error: result.error,
                        modelId: result.modelId
                    });
                }

                res.json({
                    success: true,
                    status: 'done',
                    message: 'New Copilot chat created'
                });
            } catch (error: any) {
                console.error('Error creating new chat:', error);
                res.status(500).json({
                    success: false,
                    status: 'error',
                    error: error.message || 'Error creating new chat'
                });
            }
        });

        // API: Obtenir le statut du traitement en cours
        this.app.get('/api/copilot/processing-status', async (req, res) => {
            try {
                const copilotManager = CopilotChatManager.getInstance();
                const status = copilotManager.getStatus();

                res.json({
                    success: true,
                    ...status,
                    timestamp: new Date().toISOString()
                });
            } catch (error: any) {
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error getting processing status'
                });
            }
        });

        // API: Changer le modèle Copilot
        // Note: VS Code n'a pas d'API pour changer le modèle dans le panel Copilot UI
        // Cette API vérifie juste que le modèle est disponible pour utilisation via vscode.lm
        this.app.post('/api/copilot/set-model', async (req, res) => {
            try {
                const { modelId } = req.body;

                if (!modelId) {
                    return res.status(400).json({
                        success: false,
                        error: 'No model ID provided'
                    });
                }

                const copilotManager = CopilotChatManager.getInstance();
                
                // Vérifier si Copilot est disponible
                const isAvailable = await copilotManager.isCopilotAvailable();
                if (!isAvailable) {
                    return res.status(503).json({
                        success: false,
                        error: 'Copilot is not installed or not available'
                    });
                }

                // Vérifier que le modèle est disponible
                const success = await copilotManager.setCopilotModel(modelId);

                res.json({
                    success: success,
                    modelId: modelId,
                    message: success 
                        ? `Model ${modelId} is available and will be used for chat requests` 
                        : `Model ${modelId} is not available`,
                    note: 'The model is used via the vscode.lm API directly. The Copilot Chat panel uses its own model selector.',
                    timestamp: new Date().toISOString()
                });
            } catch (error: any) {
                console.error('Error setting Copilot model:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error setting Copilot model'
                });
            }
        });

        // API: Vérifier le statut de Copilot
        this.app.get('/api/copilot/status', async (req, res) => {
            try {
                const copilotManager = CopilotChatManager.getInstance();
                const isAvailable = await copilotManager.isCopilotAvailable();
                const processingStatus = copilotManager.getStatus();

                res.json({
                    success: true,
                    copilotAvailable: isAvailable,
                    isProcessing: processingStatus.isProcessing,
                    timestamp: new Date().toISOString()
                });
            } catch (error: any) {
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error checking Copilot status'
                });
            }
        });

        // API: Chat with Copilot (avec métadonnées complètes)
        this.app.post('/api/chat', async (req, res) => {
            try {
                const { messages, modelId, stream = true } = req.body;

                if (!messages || messages.length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'No messages provided'
                    });
                }

                if (!modelId) {
                    return res.status(400).json({
                        success: false,
                        error: 'No model ID provided'
                    });
                }

                // Import le chat participant depuis extension.ts
                const { getChatParticipant } = await import('./extension');
                const chatParticipant = getChatParticipant();

                // Convertir l'historique en messages du modèle
                const history: vscode.LanguageModelChatMessage[] = messages.slice(0, -1).map((msg: any) => {
                    if (msg.role === 'user') {
                        return vscode.LanguageModelChatMessage.User(msg.content);
                    } else {
                        return vscode.LanguageModelChatMessage.Assistant(msg.content);
                    }
                });

                // Le dernier message est le prompt actuel
                const currentMessage = messages[messages.length - 1];
                const prompt = currentMessage.content;

                if (stream) {
                    // Set headers for SSE
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.setHeader('Connection', 'keep-alive');

                    try {
                        // Envoyer la requête via le chat participant
                        const response = await chatParticipant.sendRequest(prompt, modelId, history);

                        // Streamer le contenu mot par mot
                        const words = response.content.split(' ');
                        
                        for (const word of words) {
                            res.write(`data: ${JSON.stringify({ 
                                content: word + ' ',
                                done: false 
                            })}\n\n`);
                            
                            // Petit délai pour simuler le streaming naturel
                            await new Promise(resolve => setTimeout(resolve, 10));
                        }

                        // Envoyer les métadonnées à la fin
                        res.write(`data: ${JSON.stringify({ 
                            content: '',
                            done: true,
                            metadata: response.metadata
                        })}\n\n`);
                        
                        res.end();
                    } catch (error: any) {
                        res.write(`data: ${JSON.stringify({ error: error.message, done: true })}\n\n`);
                        res.end();
                    }
                } else {
                    // Non-streaming response avec métadonnées
                    try {
                        const response = await chatParticipant.sendRequest(prompt, modelId, history);

                        res.json({
                            success: true,
                            message: {
                                role: 'assistant',
                                content: response.content
                            },
                            metadata: response.metadata,
                            modelId: modelId,
                            timestamp: new Date().toISOString()
                        });
                    } catch (error: any) {
                        res.status(500).json({
                            success: false,
                            error: error.message || 'Error generating response'
                        });
                    }
                }
            } catch (error: any) {
                console.error('Error in chat API:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error in chat API'
                });
            }
        });
    }

    private async getCopilotModels(): Promise<any[]> {
        try {
            // Récupérer les modèles via l'API VS Code Language Model
            const models = await vscode.lm.selectChatModels();
            
            return models.map(model => ({
                id: model.id,
                name: model.name,
                family: model.family,
                version: model.version,
                vendor: model.vendor,
                maxInputTokens: model.maxInputTokens,
                // Informations supplémentaires disponibles
                details: {
                    id: model.id,
                    family: model.family,
                    version: model.version
                }
            }));
        } catch (error: any) {
            console.error('Erreur lors de la récupération des modèles:', error);
            // Retourner des modèles par défaut en cas d'erreur
            return [
                {
                    id: 'copilot-gpt-4',
                    name: 'GPT-4',
                    family: 'gpt-4',
                    version: '0613',
                    vendor: 'OpenAI',
                    maxInputTokens: 8192,
                    details: {
                        id: 'copilot-gpt-4',
                        family: 'gpt-4',
                        version: '0613'
                    }
                },
                {
                    id: 'copilot-gpt-3.5-turbo',
                    name: 'GPT-3.5 Turbo',
                    family: 'gpt-3.5-turbo',
                    version: '0125',
                    vendor: 'OpenAI',
                    maxInputTokens: 16385,
                    details: {
                        id: 'copilot-gpt-3.5-turbo',
                        family: 'gpt-3.5-turbo',
                        version: '0125'
                    }
                }
            ];
        }
    }

    private async buildFileTree(dirPath: string, basePath: string = ''): Promise<any> {
        const fs = require('fs');
        const path = require('path');

        const IGNORE_LIST = [
            'node_modules', '.git', '.next', 'dist', 'build', 
            '.vscode', '.idea', 'coverage', '.DS_Store', 'out'
        ];

        const shouldIgnore = (name: string): boolean => {
            return IGNORE_LIST.includes(name) || name.startsWith('.');
        };

        try {
            const stats = fs.statSync(dirPath);
            const name = path.basename(dirPath);
            const relativePath = basePath ? `${basePath}/${name}` : name;

            if (shouldIgnore(name)) {
                return null;
            }

            if (stats.isDirectory()) {
                const children: any[] = [];
                try {
                    const items = fs.readdirSync(dirPath);
                    for (const item of items) {
                        const childPath = path.join(dirPath, item);
                        const childNode = await this.buildFileTree(childPath, relativePath);
                        if (childNode) {
                            children.push(childNode);
                        }
                    }
                } catch (err) {
                    console.error(`Error reading directory ${dirPath}:`, err);
                }

                children.sort((a, b) => {
                    if (a.type === b.type) {
                        return a.name.localeCompare(b.name);
                    }
                    return a.type === 'directory' ? -1 : 1;
                });

                return {
                    name,
                    type: 'directory',
                    path: relativePath,
                    children
                };
            } else {
                return {
                    name,
                    type: 'file',
                    path: relativePath
                };
            }
        } catch (err) {
            console.error(`Error accessing ${dirPath}:`, err);
            return null;
        }
    }

    private async detectProjectsInDir(basePath: string, relativePath: string = '.'): Promise<any[]> {
        const fs = require('fs');
        const path = require('path');
        const projects: any[] = [];

        const checkFileExists = (fileName: string): boolean => {
            try {
                return fs.existsSync(path.join(basePath, fileName));
            } catch {
                return false;
            }
        };

        const readPackageJson = (): any => {
            try {
                const packagePath = path.join(basePath, 'package.json');
                if (fs.existsSync(packagePath)) {
                    const content = fs.readFileSync(packagePath, 'utf-8');
                    return JSON.parse(content);
                }
            } catch (err) {
                console.error('Error reading package.json:', err);
            }
            return null;
        };

        const packageJson = readPackageJson();

        if (packageJson) {
            const deps = {
                ...packageJson.dependencies,
                ...packageJson.devDependencies
            };

            // Detect Next.js
            if (deps['next']) {
                projects.push({
                    type: 'Next.js',
                    name: packageJson.name || 'Next.js Project',
                    version: deps['next'],
                    description: 'React framework for production-grade applications',
                    files: ['next.config.js', 'next.config.ts', 'app/', 'pages/'].filter(f => checkFileExists(f)),
                    path: relativePath
                });
            }

            // Detect React (Vite)
            if (deps['react'] && deps['vite']) {
                projects.push({
                    type: 'React (Vite)',
                    name: packageJson.name || 'React Project',
                    version: deps['react'],
                    description: 'Fast and modern React development with Vite',
                    files: ['vite.config.js', 'vite.config.ts', 'index.html'].filter(f => checkFileExists(f)),
                    path: relativePath
                });
            }

            // Detect Vue
            if (deps['vue']) {
                projects.push({
                    type: 'Vue.js',
                    name: packageJson.name || 'Vue Project',
                    version: deps['vue'],
                    description: 'Progressive JavaScript framework',
                    files: ['vue.config.js', 'vite.config.js', 'src/App.vue'].filter(f => checkFileExists(f)),
                    path: relativePath
                });
            }

            // Detect Angular
            if (deps['@angular/core']) {
                projects.push({
                    type: 'Angular',
                    name: packageJson.name || 'Angular Project',
                    version: deps['@angular/core'],
                    description: 'Platform for building web applications',
                    files: ['angular.json', 'src/app/'].filter(f => checkFileExists(f)),
                    path: relativePath
                });
            }

            // Detect Svelte
            if (deps['svelte']) {
                projects.push({
                    type: 'Svelte',
                    name: packageJson.name || 'Svelte Project',
                    version: deps['svelte'],
                    description: 'Cybernetically enhanced web apps',
                    files: ['svelte.config.js', 'vite.config.js'].filter(f => checkFileExists(f)),
                    path: relativePath
                });
            }

            // Detect Express
            if (deps['express']) {
                projects.push({
                    type: 'Express.js',
                    name: packageJson.name || 'Express Server',
                    version: deps['express'],
                    description: 'Fast, unopinionated web framework for Node.js',
                    files: ['server.js', 'app.js', 'index.js'].filter(f => checkFileExists(f)),
                    path: relativePath
                });
            }

            // Generic Node.js project
            if (Object.keys(deps).length > 0 && projects.length === 0 && packageJson.name) {
                projects.push({
                    type: 'Node.js',
                    name: packageJson.name,
                    version: packageJson.version,
                    description: packageJson.description || 'Node.js project',
                    files: ['package.json'],
                    path: relativePath
                });
            }
        }

        // Detect Python projects
        if (checkFileExists('requirements.txt') || checkFileExists('setup.py') || checkFileExists('pyproject.toml')) {
            projects.push({
                type: 'Python',
                name: 'Python Project',
                description: 'Python application or package',
                files: ['requirements.txt', 'setup.py', 'pyproject.toml'].filter(f => checkFileExists(f)),
                path: relativePath
            });
        }

        // Detect Rust projects
        if (checkFileExists('Cargo.toml')) {
            projects.push({
                type: 'Rust',
                name: 'Rust Project',
                description: 'Rust application or library',
                files: ['Cargo.toml', 'Cargo.lock'].filter(f => checkFileExists(f)),
                path: relativePath
            });
        }

        // Detect Go projects
        if (checkFileExists('go.mod')) {
            projects.push({
                type: 'Go',
                name: 'Go Project',
                description: 'Go application or package',
                files: ['go.mod', 'go.sum', 'main.go'].filter(f => checkFileExists(f)),
                path: relativePath
            });
        }

        return projects;
    }

    private async detectProjects(workspacePath: string): Promise<any[]> {
        const fs = require('fs');
        const path = require('path');
        const allProjects: any[] = [];
        const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage'];

        // Scan root directory
        allProjects.push(...await this.detectProjectsInDir(workspacePath, '.'));

        // Scan subdirectories (1 level deep)
        try {
            const entries = fs.readdirSync(workspacePath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && !ignoreDirs.includes(entry.name) && !entry.name.startsWith('.')) {
                    const subPath = path.join(workspacePath, entry.name);
                    const subProjects = await this.detectProjectsInDir(subPath, entry.name);
                    allProjects.push(...subProjects);
                }
            }
        } catch (err) {
            console.error('Error scanning subdirectories:', err);
        }

        return allProjects;
    }

    async start(): Promise<void> {
        if (this.server) {
            console.log('Le serveur est déjà en cours d\'exécution');
            return;
        }

        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.port, '127.0.0.1', () => {
                    console.log(`Serveur démarré sur http://127.0.0.1:${this.port}`);
                    
                    // Initialiser WebSocket pour la connexion en temps réel
                    this.setupWebSocket();
                    
                    resolve();
                });

                this.server.on('error', (error: any) => {
                    if (error.code === 'EADDRINUSE') {
                        vscode.window.showErrorMessage(`Le port ${this.port} est déjà utilisé. Choisissez un autre port.`);
                    } else {
                        vscode.window.showErrorMessage(`Erreur serveur: ${error.message}`);
                    }
                    this.server = undefined;
                    reject(error);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    getPort(): number {
        return this.port;
    }

    isRunning(): boolean {
        return this.server !== undefined;
    }

    private setupWebSocket() {
        if (!this.server) return;

        this.wss = new WebSocketServer({ server: this.server, path: '/ws' });

        this.wss.on('connection', (ws: WebSocket) => {
            console.log('Nouveau client WebSocket connecté');
            this.clients.add(ws);

            // Envoyer un message de bienvenue
            ws.send(JSON.stringify({
                type: 'connected',
                message: 'Connexion établie avec VS Code',
                timestamp: new Date().toISOString()
            }));

            // Heartbeat pour vérifier la connexion
            const heartbeatInterval = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'heartbeat',
                        timestamp: new Date().toISOString()
                    }));
                }
            }, 5000);

            ws.on('message', async (message: string) => {
                try {
                    const data = JSON.parse(message.toString());
                    
                    if (data.type === 'getModels') {
                        const models = await this.getCopilotModels();
                        ws.send(JSON.stringify({
                            type: 'models',
                            data: models,
                            timestamp: new Date().toISOString()
                        }));
                    } else if (data.type === 'ping') {
                        ws.send(JSON.stringify({
                            type: 'pong',
                            timestamp: new Date().toISOString()
                        }));
                    }
                } catch (error) {
                    console.error('Erreur lors du traitement du message WebSocket:', error);
                }
            });

            ws.on('close', () => {
                console.log('Client WebSocket déconnecté');
                this.clients.delete(ws);
                clearInterval(heartbeatInterval);
            });

            ws.on('error', (error) => {
                console.error('Erreur WebSocket:', error);
                this.clients.delete(ws);
                clearInterval(heartbeatInterval);
            });
        });
    }

    stop() {
        // Fermer toutes les connexions WebSocket
        this.clients.forEach(client => {
            client.close();
        });
        this.clients.clear();

        if (this.wss) {
            this.wss.close();
        }

        if (this.server) {
            this.server.close();
            this.server = undefined;
            console.log('Serveur arrêté');
        }
    }
}
