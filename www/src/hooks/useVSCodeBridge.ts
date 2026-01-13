'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ModelsByVendor, WebSocketMessage, ChangeModelPayload, ChatMessage, WorkspaceInfo, NextJsProject, MCPServer, Activity, ActivityType } from '@/types';
import { RealmClient, ConnectionState } from '@/realm/RealmClient';
import type { RealmID, RealmEvent, ElementStyles as RealmElementStyles } from '@/realm/types';

// Types Copilot History
interface CopilotMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

interface CopilotConversation {
  id: string;
  title: string;
  timestamp: number;
  messages: CopilotMessage[];
  filePath: string;
}

interface CopilotHistoryConfig {
  version: 'stable' | 'insiders';
  maxConversations: number;
}

interface AvailableCopilotVersions {
  stable: boolean;
  insiders: boolean;
}

// Types Project Creation
interface ProjectConfig {
  name: string;
  framework: string;
  features: string[];
  styling: string;
  database: string | null;
  auth: string | null;
  packageManager: string;
}

interface ProjectCreationLog {
  id: string;
  type: 'info' | 'success' | 'error' | 'warning' | 'command';
  message: string;
  timestamp: Date;
}

// ============================================================================
// REALM Integration
// ============================================================================

/** Singleton RealmClient instance */
let realmClientInstance: RealmClient | null = null;

function getOrCreateRealmClient(): RealmClient {
  if (!realmClientInstance) {
    realmClientInstance = new RealmClient({
      wsUrl: 'ws://localhost:57129',
      autoReconnect: true,
    });
  }
  return realmClientInstance;
}

// ============================================================================
// Types
// ============================================================================

interface UseVSCodeBridgeReturn {
  models: ModelsByVendor;
  isConnected: boolean;
  error: string | null;
  selectedModel: ChangeModelPayload | null;
  changeModel: (model: ChangeModelPayload) => Promise<boolean>;
  refreshModels: () => void;
  sendToCopilot: (prompt: string) => void;
  messages: ChatMessage[];
  isStreaming: boolean;
  isBuilderStreaming: boolean;
  workspacePath: string;
  fileTree: WorkspaceInfo['fileTree'];
  // Next.js project management
  nextJsProjects: NextJsProject[];
  detectNextJsProjects: () => void;
  startNextJsProject: (projectPath: string, port?: number) => void;
  stopNextJsProject: (projectPath: string) => void;
  isDetectingProjects: boolean;
  // DOM Bridge setup
  setupDOMBridge: (projectPath: string) => void;
  isDOMBridgeSetupInProgress: boolean;
  domBridgeSetupComplete: boolean;
  domBridgeSetupError: string | null;
  resetDOMBridgeSetup: () => void;
  // MCP server management
  mcpServers: MCPServer[];
  detectMCPServers: () => void;
  isDetectingMCP: boolean;
  // Activity tracking - real-time events
  activities: Activity[];
  clearActivities: () => void;
  // Element editing
  applyElementChanges: (selector: string, changes: Record<string, unknown>, url: string) => void;
  // ============================================================================
  // REALM Protocol API
  // ============================================================================
  /** REALM connection state */
  realmConnectionState: ConnectionState;
  /** Is REALM connected */
  isRealmConnected: boolean;
  /** Currently selected REALM element */
  selectedRealmElement: RealmID | null;
  /** Send style change via REALM (preview mode for live preview, false for persisted) */
  sendRealmStyleChange: (realmId: RealmID, styles: Partial<RealmElementStyles>, preview?: boolean) => void;
  /** Send text change via REALM */
  sendRealmTextChange: (realmId: RealmID, text: string, preview?: boolean) => void;
  /** Commit all pending REALM changes */
  commitRealmChanges: (realmId: RealmID) => void;
  /** Rollback pending REALM changes */
  rollbackRealmChanges: (realmId: RealmID) => void;
  /** Get REALM client instance for advanced usage */
  getRealmClient: () => RealmClient;
  // ============================================================================
  // Copilot History
  // ============================================================================
  copilotConversations: CopilotConversation[];
  copilotHistoryConfig: CopilotHistoryConfig | null;
  availableCopilotVersions: AvailableCopilotVersions | null;
  getCopilotHistory: () => void;
  getCopilotHistoryConfig: () => void;
  updateCopilotHistoryConfig: (config: Partial<CopilotHistoryConfig>) => void;
  getAvailableCopilotVersions: () => void;
  // ============================================================================
  // Project Creation
  // ============================================================================
  createProject: (config: ProjectConfig) => void;
  projectCreationLogs: ProjectCreationLog[];
  isCreatingProject: boolean;
  projectCreationComplete: boolean;
  projectCreationError: string | null;
  resetProjectCreation: () => void;
}

export function useVSCodeBridge(): UseVSCodeBridgeReturn {
  const [models, setModels] = useState<ModelsByVendor>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ChangeModelPayload | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isBuilderStreaming, setIsBuilderStreaming] = useState(false);
  const [workspacePath, setWorkspacePath] = useState<string>('');
  const [fileTree, setFileTree] = useState<WorkspaceInfo['fileTree']>({});
  const [nextJsProjects, setNextJsProjects] = useState<NextJsProject[]>([]);
  const [isDetectingProjects, setIsDetectingProjects] = useState(false);
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [isDetectingMCP, setIsDetectingMCP] = useState(false);

  // DOM Bridge setup state
  const [isDOMBridgeSetupInProgress, setIsDOMBridgeSetupInProgress] = useState(false);
  const [domBridgeSetupComplete, setDOMBridgeSetupComplete] = useState(false);
  const [domBridgeSetupError, setDOMBridgeSetupError] = useState<string | null>(null);

  // Activity tracking - real-time events
  const [activities, setActivities] = useState<Activity[]>([]);
  const activityCounterRef = useRef(0);
  
  // Limite maximale d'activités pour éviter les problèmes de performance et de mémoire
  const MAX_ACTIVITIES = 50;
  
  // ============================================================================
  // REALM Protocol State
  // ============================================================================
  const [realmConnectionState, setRealmConnectionState] = useState<ConnectionState>('disconnected');
  const [selectedRealmElement, setSelectedRealmElement] = useState<RealmID | null>(null);
  const realmClientRef = useRef<RealmClient | null>(null);
  
  // ============================================================================
  // Copilot History State
  // ============================================================================
  const [copilotConversations, setCopilotConversations] = useState<CopilotConversation[]>([]);
  const [copilotHistoryConfig, setCopilotHistoryConfig] = useState<CopilotHistoryConfig | null>(null);
  const [availableCopilotVersions, setAvailableCopilotVersions] = useState<AvailableCopilotVersions | null>(null);

  // ============================================================================
  // Project Creation State
  // ============================================================================
  const [projectCreationLogs, setProjectCreationLogs] = useState<ProjectCreationLog[]>([]);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectCreationComplete, setProjectCreationComplete] = useState(false);
  const [projectCreationError, setProjectCreationError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRequestsRef = useRef<Map<string, (success: boolean) => void>>(new Map());
  const currentStreamRef = useRef<string>('');
  const isConnectingRef = useRef(false);
  
  // Helper pour ajouter une activité avec ID unique et limite de taille
  const addActivity = useCallback((type: ActivityType, data: Activity['data']) => {
    setActivities(prev => {
      activityCounterRef.current += 1;
      const newActivity: Activity = {
        id: `activity_${activityCounterRef.current}_${Date.now()}`,
        type,
        timestamp: Date.now(),
        data
      };
      const updated = [...prev, newActivity];
      // Garder seulement les 50 dernières activités
      return updated.slice(-MAX_ACTIVITIES);
    });
  }, []);

  // ============================================================================
  // REALM Protocol Setup
  // ============================================================================
  useEffect(() => {
    // Initialize REALM client
    const client = getOrCreateRealmClient();
    realmClientRef.current = client;
    
    // Listen to connection state changes
    const unsubscribeState = client.onStateChange((state) => {
      setRealmConnectionState(state);
      console.log('[Bridge/REALM] Connection state:', state);
    });
    
    // Listen to REALM events
    const unsubscribeStyleChange = client.on('STYLE_CHANGED', (event) => {
      console.log('[Bridge/REALM] Style changed:', event);
      addActivity('file_modify', {
        path: 'realmId' in event ? event.realmId.sourceFile : 'unknown',
        message: `REALM style change (preview: ${'preview' in event ? event.preview : false})`
      });
    });
    
    const unsubscribeTextChange = client.on('TEXT_CHANGED', (event) => {
      console.log('[Bridge/REALM] Text changed:', event);
      addActivity('file_modify', {
        path: 'realmId' in event ? event.realmId.sourceFile : 'unknown',
        message: 'REALM text change'
      });
    });
    
    const unsubscribeElementSelected = client.on('ELEMENT_SELECTED', (event) => {
      console.log('[Bridge/REALM] Element selected:', event);
      if ('realmId' in event) {
        setSelectedRealmElement(event.realmId);
      }
    });
    
    const unsubscribeCommit = client.on('COMMIT_COMPLETED', (event) => {
      console.log('[Bridge/REALM] Commit completed:', event);
      addActivity('file_modify', {
        path: 'realmId' in event ? event.realmId.sourceFile : 'file',
        message: 'Changes committed successfully'
      });
    });
    
    const unsubscribeRollback = client.on('ROLLBACK_COMPLETED', (event) => {
      console.log('[Bridge/REALM] Rollback completed:', event);
      addActivity('diagnostic', {
        message: 'Changes rolled back',
        severity: 'warning' as const
      });
    });
    
    // Connect if disconnected
    if (client.getState() === 'disconnected') {
      // Auto-connect REALM client
      console.log('[Bridge/REALM] Auto-connecting REALM client...');
      client.connect();
    }
    
    return () => {
      unsubscribeState();
      unsubscribeStyleChange();
      unsubscribeTextChange();
      unsubscribeElementSelected();
      unsubscribeCommit();
      unsubscribeRollback();
    };
  }, []);

  const connect = useCallback(() => {
    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) {
      console.log('[Bridge] Already connected or connecting, skipping...');
      return;
    }
    
    // Close any existing connection that's not open
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    isConnectingRef.current = true;
    
    try {
      // Connexion WebSocket au serveur de l'extension
      // Use localhost instead of 127.0.0.1 for better browser compatibility
      const ws = new WebSocket('ws://localhost:57129');
      
      ws.onopen = () => {
        console.log('[Bridge] Connected to VS Code extension');
        isConnectingRef.current = false;
        setIsConnected(true);
        setError(null);
        
        // Demander la liste des modèles et les infos du workspace
        console.log('[Bridge] Requesting models list...');
        ws.send(JSON.stringify({ type: 'listModels' }));
        console.log('[Bridge] Requesting workspace info...');
        ws.send(JSON.stringify({ type: 'getWorkspace' }));
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('[Bridge] Received:', message.type);
          
          switch (message.type) {
            case 'modelsUpdated':
              console.log('[Bridge] Models updated:', Object.keys(message.payload || {}).length, 'vendors');
              setModels(message.payload as ModelsByVendor);
              break;
              
            case 'modelChanged':
              if (message.payload?.success) {
                setSelectedModel(message.payload.model);
              }
              // Résoudre la promesse si on attend une réponse
              if (message.requestId) {
                const resolver = pendingRequestsRef.current.get(message.requestId);
                if (resolver) {
                  resolver(message.payload?.success ?? false);
                  pendingRequestsRef.current.delete(message.requestId);
                }
              }
              break;
              
            case 'messageChunk':
              currentStreamRef.current += message.payload.chunk;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant' && last.id === message.requestId) {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, content: currentStreamRef.current }
                  ];
                }
                return prev;
              });
              break;
              
            case 'messageComplete':
              setIsStreaming(false);
              currentStreamRef.current = '';
              break;
              
            case 'messageError':
              setIsStreaming(false);
              setError(message.payload.error);
              currentStreamRef.current = '';
              break;
              
            case 'workspaceInfo':
              const workspaceInfo = message.payload as WorkspaceInfo;
              console.log('[Bridge] Received workspaceInfo:', workspaceInfo);
              console.log('[Bridge] Path:', workspaceInfo.path);
              console.log('[Bridge] FileTree keys:', Object.keys(workspaceInfo.fileTree));
              setWorkspacePath(workspaceInfo.path);
              setFileTree(workspaceInfo.fileTree);
              break;
              
            case 'copilotChatOpened':
              console.log('[Bridge] Copilot Chat opened');
              break;
              
            case 'copilotWord':
              // Recevoir chaque mot individuellement
              const word = message.payload.word;
              console.log('[Bridge] Received word:', JSON.stringify(word));
              // Mettre à jour le dernier message assistant
              setMessages(prev => {
                const last = prev[prev.length - 1];
                console.log('[Bridge] Last message:', last);
                if (last && last.role === 'assistant') {
                  const updated = { ...last, content: (last.content || '') + word };
                  console.log('[Bridge] Updating assistant message:', updated);
                  return [
                    ...prev.slice(0, -1),
                    updated
                  ];
                }
                console.log('[Bridge] No assistant message to update');
                return prev;
              });
              break;
              
            case 'copilotComplete':
              console.log('[Bridge] Copilot response complete');
              break;
              
            case 'copilotError':
              console.error('[Bridge] Copilot error:', message.payload.error);
              setIsBuilderStreaming(false);
              setError(message.payload.error);
              break;

            // ============== @builder - TRUE Copilot Chat UI capture ==============
            case 'builderPromptReceived':
              console.log('[Bridge] @builder received prompt:', message.payload.prompt);
              setIsBuilderStreaming(true);
              break;

            case 'builderResponseChunk':
              // Streaming chunk depuis @builder (vraie réponse Copilot!)
              const builderChunk = message.payload.chunk;
              console.log('[Bridge] @builder chunk:', builderChunk.length, 'chars');
              
              // Mettre à jour le dernier message dans messages[] pour l'affichage
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant') {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, content: (last.content || '') + builderChunk }
                  ];
                }
                return prev;
              });
              break;

            case 'builderResponseComplete':
              console.log('[Bridge] @builder complete');
              setIsBuilderStreaming(false);
              break;

            case 'builderResponseError':
              console.error('[Bridge] @builder error:', message.payload.error);
              setIsBuilderStreaming(false);
              setError(message.payload.error);
              break;
            // ============== End @builder ==============

            case 'nextJsProjectsDetected':
              console.log('[Bridge] Next.js projects detected:', message.payload.projects);
              setNextJsProjects(message.payload.projects);
              setIsDetectingProjects(false);
              break;

            case 'nextJsProjectStatus':
              console.log('[Bridge] Next.js project status update:', message.payload);
              setNextJsProjects(prev => prev.map(project =>
                project.path === message.payload.path
                  ? {
                      ...project,
                      status: message.payload.status,
                      port: message.payload.port ?? project.port,
                      error: message.payload.error
                    }
                  : project
              ));
              break;

            // ============== Project Creation ==============
            case 'projectCreationLog':
              console.log('[Bridge] Project creation log:', message.payload);
              setProjectCreationLogs(prev => [...prev, {
                id: `${Date.now()}-${Math.random()}`,
                type: message.payload.type,
                message: message.payload.message,
                timestamp: new Date(message.payload.timestamp)
              }]);
              break;

            case 'projectCreationComplete':
              console.log('[Bridge] Project creation complete:', message.payload);
              setIsCreatingProject(false);
              setProjectCreationComplete(true);
              // Refresh project list
              wsRef.current?.send(JSON.stringify({ type: 'detectNextJsProjects' }));
              break;

            case 'projectCreationError':
              console.error('[Bridge] Project creation error:', message.payload.error);
              setIsCreatingProject(false);
              setProjectCreationError(message.payload.error);
              break;

            case 'mcpServersDetected':
              console.log('[Bridge] MCP servers detected:', message.payload.servers);
              setMcpServers(message.payload.servers);
              setIsDetectingMCP(false);
              break;

            // ============== Copilot History ==============
            case 'copilotHistory':
              console.log('[Bridge] Copilot history received:', message.payload.conversations.length, 'conversations');
              setCopilotConversations(message.payload.conversations);
              break;

            case 'copilotHistoryConfig':
              console.log('[Bridge] Copilot history config:', message.payload);
              setCopilotHistoryConfig(message.payload);
              break;

            case 'availableCopilotVersions':
              console.log('[Bridge] Available Copilot versions:', message.payload);
              setAvailableCopilotVersions(message.payload);
              break;

            case 'domBridgeSetupComplete':
              console.log('[Bridge] DOM Bridge setup complete:', message.payload);
              setIsDOMBridgeSetupInProgress(false);
              setDOMBridgeSetupComplete(true);
              setDOMBridgeSetupError(null);
              // Refresh projects to update DOM selector status
              wsRef.current?.send(JSON.stringify({ type: 'detectNextJsProjects' }));
              break;

            case 'domBridgeSetupError':
              console.error('[Bridge] DOM Bridge setup error:', message.payload.error);
              setIsDOMBridgeSetupInProgress(false);
              setDOMBridgeSetupComplete(false);
              setDOMBridgeSetupError(message.payload.error);
              setError(message.payload.error);
              break;

            // ============== Activity Tracking - Real-time events ==============
            case 'activity':
              const activity = message.payload as Activity;
              console.log('[Bridge] Activity:', activity.type, activity.data.message || activity.data.path);
              // Utiliser la fonction addActivity pour garantir des IDs uniques
              setActivities(prev => {
                activityCounterRef.current += 1;
                const activityWithUniqueId = {
                  ...activity,
                  id: `activity_${activityCounterRef.current}_${Date.now()}`
                };
                const updated = [...prev, activityWithUniqueId];
                return updated.slice(-MAX_ACTIVITIES);
              });
              break;
            // ============== End Activity Tracking ==============
            
            case 'elementChangesApplied':
              console.log('[Bridge] Element changes applied successfully:', message.payload);
              addActivity('file_modify', {
                path: message.payload?.file || 'source file',
                message: 'Changes saved successfully'
              });
              break;
              
            case 'elementChangesError':
              const errorMsg = message.payload?.error ?? 'Failed to apply changes';
              const errorDetails = message.payload?.selector ? ` (selector: ${message.payload.selector})` : '';
              console.error('[Bridge] Element changes error:', {
                error: errorMsg,
                selector: message.payload?.selector,
                file: message.payload?.file,
                fullPayload: message.payload
              });
              setError(`${errorMsg}${errorDetails}`);
              addActivity('diagnostic', {
                message: errorMsg + errorDetails,
                severity: 'error' as const
              });
              break;
              
            case 'error':
              setError(message.payload?.message ?? 'Unknown error');
              break;
              
            case 'pong':
              // Keep-alive response
              break;
          }
        } catch (e) {
          console.error('[Bridge] Error parsing message:', e);
        }
      };

      ws.onclose = () => {
        console.log('[Bridge] Disconnected from VS Code extension');
        isConnectingRef.current = false;
        setIsConnected(false);
        wsRef.current = null;
        
        // Tentative de reconnexion après 3 secondes (increased from 2)
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[Bridge] Attempting to reconnect...');
          connect();
        }, 3000);
      };

      ws.onerror = () => {
        console.error('[Bridge] WebSocket error: Unable to connect to ws://127.0.0.1:57129');
        isConnectingRef.current = false;
        setError('Connection error - is the VS Code extension running?');
      };

      wsRef.current = ws;
    } catch (e) {
      console.error('[Bridge] Failed to connect:', e);
      isConnectingRef.current = false;
      setError('Failed to connect to VS Code extension');
    }
  }, []);

  // Connexion initiale
  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Connection uniquement au montage du composant

  // Keep-alive ping
  useEffect(() => {
    if (!isConnected) return;
    
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isConnected]);

  const changeModel = useCallback(async (model: ChangeModelPayload): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setError('Not connected to VS Code extension');
        resolve(false);
        return;
      }

      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Stocker le resolver pour la réponse
      pendingRequestsRef.current.set(requestId, resolve);
      
      // Timeout après 10 secondes
      setTimeout(() => {
        if (pendingRequestsRef.current.has(requestId)) {
          pendingRequestsRef.current.delete(requestId);
          resolve(false);
        }
      }, 10000);

      wsRef.current.send(JSON.stringify({
        type: 'changeModel',
        payload: model,
        requestId
      }));
    });
  }, []);

  const refreshModels = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'listModels' }));
    }
  }, []);

  const sendToCopilot = useCallback((prompt: string) => {
    console.log('[sendToCopilot] Called with prompt:', prompt);
    
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('[sendToCopilot] WebSocket not connected');
      setError('Not connected to VS Code extension');
      return;
    }

    const requestId = `builder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('[sendToCopilot] Generated requestId:', requestId);
    
    // Utiliser les états de builder pour afficher dans messages[]
    setIsBuilderStreaming(true);
    setError(null);

    // Ajouter le message utilisateur
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMessage]);

    // Préparer le message assistant vide pour le streaming
    const assistantMessage: ChatMessage = {
      id: requestId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, assistantMessage]);

    const messageToSend = {
      type: 'sendToBuilder',
      payload: { prompt, requestId },
      requestId
    };
    
    console.log('[sendToCopilot] Sending via @builder to capture TRUE Copilot response');
    wsRef.current.send(JSON.stringify(messageToSend));
  }, []);

  const detectNextJsProjects = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected to VS Code extension');
      return;
    }

    console.log('[detectNextJsProjects] Requesting Next.js projects detection');
    setIsDetectingProjects(true);
    wsRef.current.send(JSON.stringify({ type: 'detectNextJsProjects' }));
  }, []);

  const startNextJsProject = useCallback((projectPath: string, port: number = 3000) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected to VS Code extension');
      return;
    }

    console.log('[startNextJsProject] Starting project:', projectPath, 'on port:', port);
    wsRef.current.send(JSON.stringify({
      type: 'startNextJsProject',
      payload: { path: projectPath, port }
    }));
  }, []);

  const stopNextJsProject = useCallback((projectPath: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected to VS Code extension');
      return;
    }

    console.log('[stopNextJsProject] Stopping project:', projectPath);
    wsRef.current.send(JSON.stringify({
      type: 'stopNextJsProject',
      payload: { path: projectPath }
    }));
  }, []);

  const setupDOMBridge = useCallback((projectPath: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected to VS Code extension');
      return;
    }

    console.log('[setupDOMBridge] Setting up DOM Bridge for:', projectPath);

    // Reset state before starting
    setIsDOMBridgeSetupInProgress(true);
    setDOMBridgeSetupComplete(false);
    setDOMBridgeSetupError(null);

    wsRef.current.send(JSON.stringify({
      type: 'setupDOMBridge',
      payload: { projectPath }
    }));
  }, []);

  const resetDOMBridgeSetup = useCallback(() => {
    setIsDOMBridgeSetupInProgress(false);
    setDOMBridgeSetupComplete(false);
    setDOMBridgeSetupError(null);
  }, []);

  const detectMCPServers = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected to VS Code extension');
      return;
    }

    console.log('[detectMCPServers] Requesting MCP servers detection');
    setIsDetectingMCP(true);
    wsRef.current.send(JSON.stringify({ type: 'detectMCPServers' }));
  }, []);

  /**
   * Clear activities
   */
  const clearActivities = useCallback(() => {
    setActivities([]);
  }, []);

  /**
   * Apply element changes to source code files
   * Sends the changes to VS Code extension which will find and modify the source files
   */
  const applyElementChanges = useCallback((selector: string, changes: Record<string, unknown>, url: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('[applyElementChanges] WebSocket not connected');
      setError('Not connected to VS Code extension');
      return;
    }

    const message = {
      type: 'applyElementChanges',
      payload: { selector, changes, url }
    };

    console.log('[applyElementChanges] ========================================');
    console.log('[applyElementChanges] Sending message:', JSON.stringify(message, null, 2));
    console.log('[applyElementChanges] Changes keys:', Object.keys(changes));
    console.log('[applyElementChanges] ========================================');
    
    wsRef.current.send(JSON.stringify(message));
  }, []);

  // ============================================================================
  // REALM Protocol Callbacks
  // ============================================================================
  
  /**
   * Send style change via REALM protocol
   * @param realmId - The unique REALM identifier for the element
   * @param styles - Styles to apply
   * @param preview - If true, only preview (don't persist). Default: true
   */
  const sendRealmStyleChange = useCallback((realmId: RealmID, styles: Partial<RealmElementStyles>, preview: boolean = true) => {
    const client = realmClientRef.current;
    if (!client) {
      console.error('[REALM] Client not initialized');
      return;
    }
    
    console.log('[REALM] Sending style change:', { realmId: realmId.hash, styles, preview });
    client.sendStyleChange(realmId, styles, preview);
  }, []);
  
  /**
   * Send text change via REALM protocol
   * @param realmId - The unique REALM identifier for the element
   * @param text - New text content
   * @param preview - If true, only preview (don't persist). Default: true
   */
  const sendRealmTextChange = useCallback((realmId: RealmID, text: string, preview: boolean = true) => {
    const client = realmClientRef.current;
    if (!client) {
      console.error('[REALM] Client not initialized');
      return;
    }
    
    console.log('[REALM] Sending text change:', { realmId: realmId.hash, text, preview });
    client.sendTextChange(realmId, text, preview);
  }, []);
  
  /**
   * Commit all pending REALM changes for an element
   * This persists the changes to the source file
   */
  const commitRealmChanges = useCallback((realmId: RealmID) => {
    const client = realmClientRef.current;
    if (!client) {
      console.error('[REALM] Client not initialized');
      return;
    }
    
    console.log('[REALM] Committing changes for:', realmId.hash);
    client.sendCommit(realmId);
  }, []);
  
  /**
   * Rollback pending REALM changes for an element
   * This reverts any preview changes
   */
  const rollbackRealmChanges = useCallback((realmId: RealmID) => {
    const client = realmClientRef.current;
    if (!client) {
      console.error('[REALM] Client not initialized');
      return;
    }
    
    console.log('[REALM] Rolling back changes for:', realmId.hash);
    client.sendRollback(realmId);
  }, []);
  
  /**
   * Get the REALM client instance for advanced usage
   */
  const getRealmClientInstance = useCallback(() => {
    if (!realmClientRef.current) {
      realmClientRef.current = getOrCreateRealmClient();
    }
    return realmClientRef.current;
  }, []);

  // ============================================================================
  // Copilot History Methods
  // ============================================================================
  const getCopilotHistory = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected to VS Code extension');
      return;
    }
    wsRef.current.send(JSON.stringify({ type: 'getCopilotHistory' }));
  }, []);

  const getCopilotHistoryConfigFn = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected to VS Code extension');
      return;
    }
    wsRef.current.send(JSON.stringify({ type: 'getCopilotHistoryConfig' }));
  }, []);

  const updateCopilotHistoryConfig = useCallback((config: Partial<CopilotHistoryConfig>) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected to VS Code extension');
      return;
    }
    wsRef.current.send(JSON.stringify({ type: 'updateCopilotHistoryConfig', payload: config }));
  }, []);

  const getAvailableCopilotVersionsFn = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected to VS Code extension');
      return;
    }
    wsRef.current.send(JSON.stringify({ type: 'getAvailableCopilotVersions' }));
  }, []);

  // ============================================================================
  // Project Creation Methods
  // ============================================================================

  /**
   * Create a new project with the given configuration
   * Sends WebSocket message to the extension which runs the creation commands
   */
  const createProject = useCallback((config: ProjectConfig) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected to VS Code extension');
      return;
    }

    console.log('[createProject] Starting project creation:', config);

    // Reset state before starting
    setProjectCreationLogs([]);
    setProjectCreationComplete(false);
    setProjectCreationError(null);
    setIsCreatingProject(true);

    wsRef.current.send(JSON.stringify({
      type: 'createProject',
      payload: config
    }));
  }, []);

  /**
   * Reset project creation state
   * Call this when user wants to start over or dismiss the creation wizard
   */
  const resetProjectCreation = useCallback(() => {
    setProjectCreationLogs([]);
    setIsCreatingProject(false);
    setProjectCreationComplete(false);
    setProjectCreationError(null);
  }, []);

  return {
    models,
    isConnected,
    error,
    selectedModel,
    changeModel,
    refreshModels,
    sendToCopilot,
    messages,
    isStreaming,
    isBuilderStreaming,
    workspacePath,
    fileTree,
    // Next.js project management
    nextJsProjects,
    detectNextJsProjects,
    startNextJsProject,
    stopNextJsProject,
    isDetectingProjects,
    // DOM Bridge setup
    setupDOMBridge,
    isDOMBridgeSetupInProgress,
    domBridgeSetupComplete,
    domBridgeSetupError,
    resetDOMBridgeSetup,
    // MCP server management
    mcpServers,
    detectMCPServers,
    isDetectingMCP,
    // Activity tracking - real-time events
    activities,
    clearActivities,
    // Element editing (legacy)
    applyElementChanges,
    // ============================================================================
    // REALM Protocol API
    // ============================================================================
    realmConnectionState,
    isRealmConnected: realmConnectionState === 'connected',
    selectedRealmElement,
    sendRealmStyleChange,
    sendRealmTextChange,
    commitRealmChanges,
    rollbackRealmChanges,
    getRealmClient: getRealmClientInstance,
    // ============================================================================
    // Copilot History
    // ============================================================================
    copilotConversations,
    copilotHistoryConfig,
    availableCopilotVersions,
    getCopilotHistory,
    getCopilotHistoryConfig: getCopilotHistoryConfigFn,
    updateCopilotHistoryConfig,
    getAvailableCopilotVersions: getAvailableCopilotVersionsFn,
    // ============================================================================
    // Project Creation
    // ============================================================================
    createProject,
    projectCreationLogs,
    isCreatingProject,
    projectCreationComplete,
    projectCreationError,
    resetProjectCreation,
  };
}
