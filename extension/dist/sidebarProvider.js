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
exports.SidebarProvider = void 0;
const vscode = __importStar(require("vscode"));
/**
 * WebviewViewProvider for the AI App Builder sidebar panel
 * Embeds the Next.js panel directly in VS Code's sidebar
 */
class SidebarProvider {
    _extensionUri;
    _context;
    static viewType = 'aiAppBuilder.panel';
    _view;
    _panelManager;
    constructor(_extensionUri, _context) {
        this._extensionUri = _extensionUri;
        this._context = _context;
    }
    setPanelManager(panelManager) {
        this._panelManager = panelManager;
        // Listen for state changes to refresh the view
        panelManager.setCallbacks({
            onStateChange: (state) => {
                if (this._view) {
                    this._view.webview.html = this._getHtmlForWebview(this._view.webview);
                }
            },
            onOutput: () => { }
        });
    }
    getPanelPort() {
        const config = vscode.workspace.getConfiguration('aiAppBuilder');
        return this._panelManager?.getPort() || config.get('panelPort', 3001);
    }
    getPanelState() {
        return this._panelManager?.getState() || 'stopped';
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'openExternal':
                    vscode.env.openExternal(vscode.Uri.parse(`http://127.0.0.1:${this.getPanelPort()}`));
                    break;
                case 'refresh':
                    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
                    break;
                case 'startPanel':
                    vscode.commands.executeCommand('aiAppBuilder.startPanel');
                    break;
                case 'stopPanel':
                    vscode.commands.executeCommand('aiAppBuilder.stopPanel');
                    break;
                case 'showLogs':
                    vscode.commands.executeCommand('aiAppBuilder.showPanelLogs');
                    break;
            }
        });
    }
    refresh() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }
    _getHtmlForWebview(webview) {
        const panelPort = this.getPanelPort();
        const panelUrl = `http://127.0.0.1:${panelPort}`;
        const panelState = this.getPanelState();
        // Show different UI based on panel state
        if (panelState === 'stopped' || panelState === 'error') {
            return this._getStoppedHtml(panelState);
        }
        else if (panelState === 'starting' || panelState === 'stopping') {
            return this._getLoadingHtml(panelState);
        }
        // Panel is running - show iframe
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI App Builder</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 100%;
      height: 100vh;
      overflow: hidden;
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
    }
    .container { display: flex; flex-direction: column; height: 100vh; }
    .toolbar {
      display: flex;
      gap: 8px;
      padding: 8px;
      background: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-sideBar-border);
    }
    .toolbar button {
      padding: 4px 12px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    .toolbar button:hover { background: var(--vscode-button-hoverBackground); }
    .toolbar button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .toolbar button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .status {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: auto;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--vscode-charts-green);
    }
    .status-dot.disconnected { background: var(--vscode-charts-red); }
    iframe { flex: 1; width: 100%; border: none; background: var(--vscode-editor-background); }
  </style>
</head>
<body>
  <div class="container">
    <div class="toolbar">
      <button onclick="refresh()">↻ Refresh</button>
      <button onclick="openExternal()">↗ Browser</button>
      <button class="secondary" onclick="stopPanel()">◼ Stop</button>
      <div class="status">
        <span class="status-dot" id="statusDot"></span>
        <span id="statusText">Connected</span>
      </div>
    </div>
    <iframe id="panel" src="${panelUrl}" onload="onFrameLoad()" onerror="onFrameError()"></iframe>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const iframe = document.getElementById('panel');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    function refresh() { vscode.postMessage({ type: 'refresh' }); }
    function openExternal() { vscode.postMessage({ type: 'openExternal' }); }
    function stopPanel() { vscode.postMessage({ type: 'stopPanel' }); }
    function onFrameLoad() { statusDot.classList.remove('disconnected'); statusText.textContent = 'Connected'; }
    function onFrameError() { statusDot.classList.add('disconnected'); statusText.textContent = 'Error'; }
  </script>
</body>
</html>`;
    }
    _getStoppedHtml(state) {
        const isError = state === 'error';
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI App Builder</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 100%;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
    }
    .container {
      text-align: center;
      padding: 32px;
    }
    .icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    h2 {
      color: var(--vscode-foreground);
      font-size: 16px;
      font-weight: 500;
      margin-bottom: 8px;
    }
    p {
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
      margin-bottom: 24px;
    }
    .error { color: var(--vscode-errorForeground); }
    button {
      padding: 8px 20px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      margin: 4px;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${isError ? '⚠️' : '○'}</div>
    <h2>${isError ? 'Panel Error' : 'Panel Stopped'}</h2>
    <p class="${isError ? 'error' : ''}">${isError ? 'An error occurred. Check the logs for details.' : 'The Next.js panel is not running.'}</p>
    <button onclick="startPanel()">▶ Start Panel</button>
    <button class="secondary" onclick="showLogs()">📋 View Logs</button>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    function startPanel() { vscode.postMessage({ type: 'startPanel' }); }
    function showLogs() { vscode.postMessage({ type: 'showLogs' }); }
  </script>
</body>
</html>`;
    }
    _getLoadingHtml(state) {
        const isStarting = state === 'starting';
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI App Builder</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 100%;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
    }
    .container { text-align: center; padding: 32px; }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--vscode-progressBar-background);
      border-top-color: var(--vscode-button-background);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h2 {
      color: var(--vscode-foreground);
      font-size: 16px;
      font-weight: 500;
      margin-bottom: 8px;
    }
    p {
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
      margin-bottom: 16px;
    }
    button {
      padding: 6px 16px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    button:hover { background: var(--vscode-button-secondaryHoverBackground); }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h2>${isStarting ? 'Starting Panel...' : 'Stopping Panel...'}</h2>
    <p>${isStarting ? 'Installing dependencies and starting Next.js' : 'Gracefully shutting down'}</p>
    <button onclick="showLogs()">📋 View Logs</button>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    function showLogs() { vscode.postMessage({ type: 'showLogs' }); }
  </script>
</body>
</html>`;
    }
}
exports.SidebarProvider = SidebarProvider;
//# sourceMappingURL=sidebarProvider.js.map