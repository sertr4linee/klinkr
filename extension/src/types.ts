// Types partagés entre l'extension et le panel web

export interface ModelInfo {
  id: string;
  name: string;
  vendor: string;
  family: string;
  version: string;
  maxInputTokens: number;
  isAgentCompatible: boolean;
}

export interface ModelsByVendor {
  [vendor: string]: ModelInfo[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
}

export interface FileTreeItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: string[];
}

export interface WorkspaceInfo {
  path: string;
  fileTree: Record<string, FileTreeItem>;
}

export interface WebSocketMessage {
  type: 
    // Model management
    | 'listModels' | 'changeModel' | 'modelsUpdated' | 'modelChanged' 
    // Basic
    | 'error' | 'ping' | 'pong' 
    // Chat messages (legacy vscode.lm)
    | 'sendMessage' | 'messageChunk' | 'messageComplete' | 'messageError'
    // Workspace
    | 'getWorkspace' | 'workspaceInfo'
    // Copilot (legacy - via vscode.lm API)
    | 'sendToCopilot' | 'copilotWord' | 'copilotComplete' | 'copilotError' | 'copilotChatOpened'
    // @builder Chat Participant - TRUE Copilot Chat UI capture
    | 'sendToBuilder' | 'builderPromptReceived' | 'builderResponseChunk' | 'builderResponseComplete' | 'builderResponseError'
    // Activity tracking - real-time events (file read/write, terminal, etc.)
    | 'activity' | 'startTracking' | 'stopTracking'
    // Next.js projects
    | 'detectNextJsProjects' | 'nextJsProjectsDetected' | 'startNextJsProject' | 'stopNextJsProject' | 'nextJsProjectStatus'
    // DOM Bridge setup
    | 'setupDOMBridge' | 'domBridgeSetupComplete' | 'domBridgeSetupError'
    // MCP servers
    | 'detectMCPServers' | 'mcpServersDetected'
    // Element editing - apply changes to source code
    | 'applyElementChanges' | 'elementChangesApplied' | 'elementChangesError' | 'fileModified'
    // REALM Protocol
    | 'realm_event';
  payload?: any;
  requestId?: string;
}

export interface NextJsProject {
  path: string;
  name: string;
  packageJsonPath: string;
  hasNextConfig: boolean;
  port: number;
  status: 'stopped' | 'starting' | 'running' | 'error';
  error?: string;
}

export interface MCPServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  status: 'active' | 'inactive' | 'error';
  description?: string;
}

export interface ChangeModelPayload {
  vendor: string;
  id: string;
  family: string;
}

export interface SendMessagePayload {
  message: string;
  conversationHistory?: ChatMessage[];
}

export interface ServerConfig {
  httpPort: number;
  wsPort: number;
}
