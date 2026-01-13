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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const server_1 = require("./server");
const modelBridge_1 = require("./modelBridge");
const chatParticipant_1 = require("./chatParticipant");
const sidebarProvider_1 = require("./sidebarProvider");
const processManager_1 = require("./processManager");
const panelManager_1 = require("./panelManager");
let server;
let panelManager;
async function activate(context) {
    console.log('[AI App Builder] Extension activating...');
    const config = vscode.workspace.getConfiguration('aiAppBuilder');
    const port = config.get('serverPort', 57129);
    const autoOpen = config.get('autoOpen', true);
    const panelAutoStart = config.get('panelAutoStart', true);
    // Initialiser le ModelBridge
    const modelBridge = modelBridge_1.ModelBridge.getInstance();
    // Initialiser le Chat Participant Bridge (@builder)
    const chatParticipant = chatParticipant_1.ChatParticipantBridge.getInstance();
    chatParticipant.register(context);
    // Initialiser le Panel Manager
    panelManager = panelManager_1.PanelManager.getInstance(context);
    // Enregistrer le Sidebar Provider
    const sidebarProvider = new sidebarProvider_1.SidebarProvider(context.extensionUri, context);
    sidebarProvider.setPanelManager(panelManager);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(sidebarProvider_1.SidebarProvider.viewType, sidebarProvider));
    // Commande: Ouvrir le panel
    const openPanelCmd = vscode.commands.registerCommand('aiAppBuilder.openPanel', async () => {
        // Check if panel is running
        if (panelManager?.getState() !== 'running') {
            const start = await vscode.window.showWarningMessage('Panel is not running. Start it first?', 'Start Panel', 'Cancel');
            if (start === 'Start Panel') {
                await vscode.commands.executeCommand('aiAppBuilder.startPanel');
                // Wait a bit for panel to start
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            else {
                return;
            }
        }
        const panelUrl = panelManager?.getUrl() || `http://127.0.0.1:3001`;
        // Ouvrir dans le navigateur externe ou Simple Browser
        const choice = await vscode.window.showQuickPick(['Open in Simple Browser (inside VS Code)', 'Open in External Browser'], { placeHolder: 'Where would you like to open the AI App Builder?' });
        if (choice?.includes('Simple Browser')) {
            await vscode.commands.executeCommand('simpleBrowser.show', vscode.Uri.parse(panelUrl));
        }
        else if (choice?.includes('External')) {
            await vscode.env.openExternal(vscode.Uri.parse(panelUrl));
        }
    });
    // Commande: Lister les modèles
    const listModelsCmd = vscode.commands.registerCommand('aiAppBuilder.listModels', async () => {
        const modelsByVendor = await modelBridge.getModelsByVendor();
        const items = [];
        for (const [vendor, models] of Object.entries(modelsByVendor)) {
            items.push({
                label: `── ${vendor.toUpperCase()} ──`,
                kind: vscode.QuickPickItemKind.Separator
            });
            for (const model of models) {
                items.push({
                    label: `${model.isAgentCompatible ? '🤖' : '💬'} ${model.name}`,
                    description: model.id,
                    detail: `Family: ${model.family} | Max tokens: ${model.maxInputTokens}`
                });
            }
        }
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Available AI Models',
            matchOnDescription: true,
            matchOnDetail: true
        });
        if (selected && selected.description) {
            // Proposer de changer vers ce modèle
            const change = await vscode.window.showQuickPick(['Yes', 'No'], {
                placeHolder: `Switch to ${selected.label}?`
            });
            if (change === 'Yes') {
                const modelsByVendorAgain = await modelBridge.getModelsByVendor();
                for (const [vendor, models] of Object.entries(modelsByVendorAgain)) {
                    const model = models.find(m => m.id === selected.description);
                    if (model) {
                        await modelBridge.changeModel({
                            vendor: model.vendor,
                            id: model.id,
                            family: model.family
                        });
                        break;
                    }
                }
            }
        }
    });
    // Commande: Changer le modèle (Quick Pick)
    const changeModelCmd = vscode.commands.registerCommand('aiAppBuilder.changeModel', async () => {
        const modelsByVendor = await modelBridge.getModelsByVendor();
        const items = [];
        const modelMap = new Map();
        for (const [vendor, models] of Object.entries(modelsByVendor)) {
            items.push({
                label: vendor.toUpperCase(),
                kind: vscode.QuickPickItemKind.Separator
            });
            for (const model of models) {
                const key = `${model.vendor}:${model.id}`;
                modelMap.set(key, { vendor: model.vendor, id: model.id, family: model.family });
                items.push({
                    label: `${model.isAgentCompatible ? '🤖' : '💬'} ${model.name}`,
                    description: model.id,
                    detail: `${model.isAgentCompatible ? 'Agent Compatible' : 'Chat Only'}`
                });
            }
        }
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a model to activate in Copilot Chat'
        });
        if (selected && selected.description) {
            for (const [key, modelInfo] of modelMap.entries()) {
                if (modelInfo.id === selected.description) {
                    await modelBridge.changeModel(modelInfo);
                    break;
                }
            }
        }
    });
    context.subscriptions.push(openPanelCmd, listModelsCmd, changeModelCmd);
    // Commande: Process Manager Stats
    const processStatsCmd = vscode.commands.registerCommand('aiAppBuilder.processStats', async () => {
        const processManager = processManager_1.ProcessManager.getInstance(context);
        const stats = await processManager.getStats();
        const info = [
            '📊 Process Manager Statistics',
            '',
            `Registered Ports: ${stats.registeredPorts.join(', ') || 'None'}`,
            '',
            'Active Processes:',
            ...stats.usedPorts.map(p => `  - Port ${p.port}: ${p.pids.length} process(es) (PIDs: ${p.pids.join(', ')})`),
            stats.usedPorts.length === 0 ? '  (No active processes)' : ''
        ].join('\n');
        const choice = await vscode.window.showInformationMessage(info, { modal: true }, 'Cleanup All', 'Close');
        if (choice === 'Cleanup All') {
            await processManager.cleanup();
            vscode.window.showInformationMessage('✨ All processes cleaned up!');
        }
    });
    context.subscriptions.push(processStatsCmd);
    // ============== Panel Commands ==============
    const startPanelCmd = vscode.commands.registerCommand('aiAppBuilder.startPanel', async () => {
        try {
            await panelManager?.start();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to start panel: ${error}`);
        }
    });
    const stopPanelCmd = vscode.commands.registerCommand('aiAppBuilder.stopPanel', async () => {
        try {
            await panelManager?.stop();
            vscode.window.showInformationMessage('Panel stopped');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to stop panel: ${error}`);
        }
    });
    const restartPanelCmd = vscode.commands.registerCommand('aiAppBuilder.restartPanel', async () => {
        try {
            await panelManager?.restart();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to restart panel: ${error}`);
        }
    });
    const showPanelLogsCmd = vscode.commands.registerCommand('aiAppBuilder.showPanelLogs', () => {
        panelManager?.showLogs();
    });
    const clearPanelLogsCmd = vscode.commands.registerCommand('aiAppBuilder.clearPanelLogs', () => {
        panelManager?.clearLogs();
    });
    const panelQuickActionsCmd = vscode.commands.registerCommand('aiAppBuilder.panelQuickActions', async () => {
        const state = panelManager?.getState() || 'stopped';
        const items = [];
        if (state === 'stopped' || state === 'error') {
            items.push({ label: '$(play) Start Panel', description: 'Start the Next.js panel' });
        }
        if (state === 'running') {
            items.push({ label: '$(browser) Open Panel', description: `Open at ${panelManager?.getUrl()}` });
            items.push({ label: '$(refresh) Restart Panel', description: 'Restart the panel' });
            items.push({ label: '$(stop) Stop Panel', description: 'Stop the panel' });
        }
        items.push({ label: '$(output) Show Logs', description: 'View panel output' });
        items.push({ label: '$(clear-all) Clear Logs', description: 'Clear panel logs' });
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `Panel Status: ${state} (${panelManager?.getMode()} mode)`
        });
        if (selected) {
            if (selected.label.includes('Start')) {
                vscode.commands.executeCommand('aiAppBuilder.startPanel');
            }
            else if (selected.label.includes('Stop')) {
                vscode.commands.executeCommand('aiAppBuilder.stopPanel');
            }
            else if (selected.label.includes('Restart')) {
                vscode.commands.executeCommand('aiAppBuilder.restartPanel');
            }
            else if (selected.label.includes('Open')) {
                vscode.commands.executeCommand('aiAppBuilder.openPanel');
            }
            else if (selected.label.includes('Show Logs')) {
                vscode.commands.executeCommand('aiAppBuilder.showPanelLogs');
            }
            else if (selected.label.includes('Clear')) {
                vscode.commands.executeCommand('aiAppBuilder.clearPanelLogs');
            }
        }
    });
    context.subscriptions.push(startPanelCmd, stopPanelCmd, restartPanelCmd, showPanelLogsCmd, clearPanelLogsCmd, panelQuickActionsCmd);
    // Démarrer le serveur WebSocket
    try {
        server = new server_1.AppBuilderServer(port, context);
        const serverUrl = await server.start();
        console.log(`[AI App Builder] WebSocket server running at ${serverUrl}`);
        // Auto-start panel si configuré
        if (panelAutoStart) {
            try {
                await panelManager?.start();
                // Auto-open si configuré et panel démarré
                if (autoOpen && panelManager?.getState() === 'running') {
                    setTimeout(() => {
                        const panelUrl = panelManager?.getUrl() || serverUrl;
                        vscode.commands.executeCommand('simpleBrowser.show', vscode.Uri.parse(panelUrl));
                    }, 2000);
                }
            }
            catch (error) {
                console.error('[AI App Builder] Failed to auto-start panel:', error);
                // Continue without panel - server is still running
            }
        }
        else {
            vscode.window.showInformationMessage(`AI App Builder server running at ${serverUrl}`, 'Start Panel').then(selection => {
                if (selection === 'Start Panel') {
                    vscode.commands.executeCommand('aiAppBuilder.startPanel');
                }
            });
        }
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to start AI App Builder server: ${error}`);
    }
    console.log('[AI App Builder] Extension activated');
}
async function deactivate() {
    console.log('[AI App Builder] Deactivating...');
    // Stop panel first
    if (panelManager) {
        await panelManager.stop();
        panelManager.dispose();
    }
    // Stop server
    if (server) {
        server.stop();
    }
    modelBridge_1.ModelBridge.getInstance().dispose();
    // Le ProcessManager sera nettoyé automatiquement via context.subscriptions
    console.log('[AI App Builder] Deactivated');
}
//# sourceMappingURL=extension.js.map