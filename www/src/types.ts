// Types partagés avec l'extension VS Code

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
    // Element editing - apply changes to code
    | 'applyElementChanges' | 'elementChangesApplied' | 'elementChangesError'
    // Next.js projects
    | 'detectNextJsProjects' | 'nextJsProjectsDetected' | 'startNextJsProject' | 'stopNextJsProject' | 'nextJsProjectStatus'
    // DOM Bridge setup
    | 'setupDOMBridge' | 'domBridgeSetupComplete' | 'domBridgeSetupError'
    // MCP servers
    | 'detectMCPServers' | 'mcpServersDetected';
  payload?: any;
  requestId?: string;
}

// Activity types for real-time tracking
export type ActivityType = 
  | 'file_read'
  | 'file_create'
  | 'file_modify'
  | 'file_delete'
  | 'file_rename'
  | 'terminal_command'
  | 'terminal_output'
  | 'thinking'
  | 'tool_call'
  | 'search'
  | 'diagnostic';

export interface Activity {
  id: string;
  type: ActivityType;
  timestamp: number;
  data: {
    path?: string;
    oldPath?: string;
    content?: string;
    command?: string;
    output?: string;
    tool?: string;
    args?: any;
    message?: string;
    severity?: 'info' | 'warning' | 'error';
  };
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
  tools?: Array<{
    name: string;
    description?: string;
    inputSchema?: any;
  }>;
}

export interface SupabaseMCPServer {
  id: string;
  created_at: string;
  owner_id: string;
  name: string;
  link: string;
  description: string;
  logo: string | null;
  company_id: string | null;
  slug: string;
  active: boolean;
  plan: string;
  order: number;
  fts: string;
  config: any | null;
  mcp_link: string | null;
}

export interface ChangeModelPayload {
  vendor: string;
  id: string;
  family: string;
}
