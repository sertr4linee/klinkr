import * as vscode from 'vscode';
import { WebServer } from './server';
import { ServerStatusProvider } from './treeView';
import { CopilotChatParticipant } from './chatParticipant';

let webServer: WebServer | undefined;
let treeDataProvider: ServerStatusProvider;
let extensionContext: vscode.ExtensionContext;
let chatParticipant: CopilotChatParticipant;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Copilot Models Viewer est maintenant actif!');

    // Sauvegarder le context
    extensionContext = context;
    
    // Initialiser le Chat Participant pour intercepter Copilot
    chatParticipant = CopilotChatParticipant.getInstance();
    chatParticipant.activate(context);
    
    // Créer le provider pour la vue
    treeDataProvider = new ServerStatusProvider();
    const treeView = vscode.window.createTreeView('copilotModelsView', {
        treeDataProvider: treeDataProvider,
        showCollapseAll: false
    });
    context.subscriptions.push(treeView);

    // Démarrer automatiquement si configuré
    const config = vscode.workspace.getConfiguration('copilotModelsViewer');
    const autoStart = config.get('autoStart', false);
    
    if (autoStart) {
        await startServer();
    }

    // Commande pour ouvrir l'interface web
    let openWebViewCommand = vscode.commands.registerCommand('copilot-models-viewer.openWebView', () => {
        if (webServer && webServer.isRunning()) {
            const port = webServer.getPort();
            vscode.env.openExternal(vscode.Uri.parse(`http://127.0.0.1:${port}`));
        } else {
            vscode.window.showWarningMessage('Le serveur n\'est pas démarré. Démarrez-le d\'abord.');
        }
    });

    // Commande pour démarrer le serveur
    let startServerCommand = vscode.commands.registerCommand('copilot-models-viewer.startServer', async () => {
        await startServer();
    });

    // Commande pour arrêter le serveur
    let stopServerCommand = vscode.commands.registerCommand('copilot-models-viewer.stopServer', () => {
        if (webServer) {
            webServer.stop();
            webServer = undefined;
            treeDataProvider.setServerStatus(false);
            vscode.window.showInformationMessage('Serveur arrêté');
        }
    });

    // Commande pour changer le port
    let changePortCommand = vscode.commands.registerCommand('copilot-models-viewer.changePort', async () => {
        const config = vscode.workspace.getConfiguration('copilotModelsViewer');
        const currentPort = config.get('port', 60885);
        
        const newPort = await vscode.window.showInputBox({
            prompt: 'Entrez le nouveau port (1024-65535)',
            value: currentPort.toString(),
            validateInput: (value) => {
                const port = parseInt(value);
                if (isNaN(port) || port < 1024 || port > 65535) {
                    return 'Le port doit être un nombre entre 1024 et 65535';
                }
                return null;
            }
        });

        if (newPort) {
            const port = parseInt(newPort);
            await config.update('port', port, vscode.ConfigurationTarget.Global);
            
            // Redémarrer le serveur si il est en cours d'exécution
            if (webServer && webServer.isRunning()) {
                webServer.stop();
                webServer = undefined;
                await startServer();
            } else {
                treeDataProvider.setServerStatus(false, port);
            }
            
            vscode.window.showInformationMessage(`Port changé à ${port}`);
        }
    });

    // Commande pour rafraîchir la vue
    let refreshViewCommand = vscode.commands.registerCommand('copilot-models-viewer.refreshView', () => {
        treeDataProvider.refresh();
    });

    context.subscriptions.push(
        openWebViewCommand,
        startServerCommand,
        stopServerCommand,
        changePortCommand,
        refreshViewCommand
    );
}

async function startServer() {
    if (webServer && webServer.isRunning()) {
        vscode.window.showInformationMessage('Le serveur est déjà en cours d\'exécution');
        return;
    }

    try {
        const config = vscode.workspace.getConfiguration('copilotModelsViewer');
        const port = config.get('port', 60885);
        
        webServer = new WebServer(extensionContext, port);
        
        // Subscribe to logs
        webServer.onDidReceiveConnection.event((message) => {
            treeDataProvider.addLog(message);
        });

        await webServer.start();
        
        treeDataProvider.setServerStatus(true, port);
        
        const action = await vscode.window.showInformationMessage(
            `Serveur démarré sur http://127.0.0.1:${port}`,
            'Ouvrir'
        );
        
        if (action === 'Ouvrir') {
            vscode.commands.executeCommand('copilot-models-viewer.openWebView');
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`Erreur lors du démarrage du serveur: ${error.message}`);
        treeDataProvider.setServerStatus(false);
    }
}

/**
 * Exporter le chat participant pour que le serveur puisse y accéder
 */
export function getChatParticipant(): CopilotChatParticipant {
    return chatParticipant;
}

export function deactivate() {
    if (webServer) {
        webServer.stop();
    }
}
