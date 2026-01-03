'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ModelsByVendor, WebSocketMessage, ChangeModelPayload, ChatMessage, WorkspaceInfo, NextJsProject, MCPServer, Activity, ActivityType } from '@/types';

interface UseVSCodeBridgeReturn {
  models: ModelsByVendor;
  isConnected: boolean;
  error: string | null;
  selectedModel: ChangeModelPayload | null;
  changeModel: (model: ChangeModelPayload) => Promise<boolean>;
  refreshModels: () => void;
  sendMessage: (message: string) => void;
  sendToCopilot: (prompt: string) => void;
  messages: ChatMessage[];
  isStreaming: boolean;
  isCopilotStreaming: boolean;
  copilotResponse: string;
  copilotChatOpened: boolean;
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
  // MCP server management
  mcpServers: MCPServer[];
  detectMCPServers: () => void;
  isDetectingMCP: boolean;
  // @builder - TRUE Copilot Chat UI capture
  sendToBuilder: (prompt: string) => void;
  builderResponse: string;
  isBuilderStreaming: boolean;
  builderMessages: ChatMessage[];
  // Activity tracking - real-time events
  activities: Activity[];
  clearActivities: () => void;
  // Element editing
  applyElementChanges: (selector: string, changes: Record<string, unknown>, url: string) => void;
}

export function useVSCodeBridge(): UseVSCodeBridgeReturn {
  const [models, setModels] = useState<ModelsByVendor>({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ChangeModelPayload | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isCopilotStreaming, setIsCopilotStreaming] = useState(false);
  const [copilotResponse, setCopilotResponse] = useState<string>('');
  const [copilotChatOpened, setCopilotChatOpened] = useState(false);
  const [workspacePath, setWorkspacePath] = useState<string>('');
  const [fileTree, setFileTree] = useState<WorkspaceInfo['fileTree']>({});
  const [nextJsProjects, setNextJsProjects] = useState<NextJsProject[]>([]);
  const [isDetectingProjects, setIsDetectingProjects] = useState(false);
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [isDetectingMCP, setIsDetectingMCP] = useState(false);
  
  // @builder states - TRUE Copilot Chat capture
  const [builderResponse, setBuilderResponse] = useState<string>('');
  const [isBuilderStreaming, setIsBuilderStreaming] = useState(false);
  const [builderMessages, setBuilderMessages] = useState<ChatMessage[]>([]);
  const builderStreamRef = useRef<string>('');
  
  // Activity tracking - real-time events
  const [activities, setActivities] = useState<Activity[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRequestsRef = useRef<Map<string, (success: boolean) => void>>(new Map());
  const currentStreamRef = useRef<string>('');
  const copilotStreamRef = useRef<string>('');
  const isConnectingRef = useRef(false);

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
              setCopilotChatOpened(true);
              break;
              
            case 'copilotWord':
              // Recevoir chaque mot individuellement
              const word = message.payload.word;
              console.log('[Bridge] Received word:', JSON.stringify(word));
              copilotStreamRef.current += word;
              console.log('[Bridge] Current stream:', copilotStreamRef.current);
              setCopilotResponse(copilotStreamRef.current);
              // Mettre à jour aussi le dernier message assistant
              setMessages(prev => {
                const last = prev[prev.length - 1];
                console.log('[Bridge] Last message:', last);
                if (last && last.role === 'assistant') {
                  const updated = { ...last, content: copilotStreamRef.current };
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
              console.log('[Bridge] Final response:', copilotStreamRef.current);
              setIsCopilotStreaming(false);
              break;
              
            case 'copilotError':
              console.error('[Bridge] Copilot error:', message.payload.error);
              setIsCopilotStreaming(false);
              setError(message.payload.error);
              break;

            // ============== @builder - TRUE Copilot Chat UI capture ==============
            case 'builderPromptReceived':
              console.log('[Bridge] @builder received prompt:', message.payload.prompt);
              // Ajouter le message user aux builderMessages
              setBuilderMessages(prev => [
                ...prev,
                {
                  id: message.payload.requestId || `user-${Date.now()}`,
                  role: 'user',
                  content: message.payload.prompt,
                  timestamp: Date.now()
                }
              ]);
              // Préparer un message assistant vide pour le streaming
              setBuilderMessages(prev => [
                ...prev,
                {
                  id: `assistant-${Date.now()}`,
                  role: 'assistant',
                  content: '',
                  timestamp: Date.now()
                }
              ]);
              setIsBuilderStreaming(true);
              builderStreamRef.current = '';
              break;

            case 'builderResponseChunk':
              // Streaming chunk depuis @builder (vraie réponse Copilot!)
              const builderChunk = message.payload.chunk;
              console.log('[Bridge] @builder chunk:', builderChunk.length, 'chars');
              builderStreamRef.current += builderChunk;
              setBuilderResponse(builderStreamRef.current);
              
              // Mettre à jour le dernier message assistant dans builderMessages
              setBuilderMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant') {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, content: builderStreamRef.current }
                  ];
                }
                return prev;
              });
              
              // Mettre à jour AUSSI le dernier message dans messages[] pour l'affichage principal
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant') {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, content: builderStreamRef.current }
                  ];
                }
                return prev;
              });
              break;

            case 'builderResponseComplete':
              console.log('[Bridge] @builder complete:', message.payload.fullResponse?.length || builderStreamRef.current.length, 'chars');
              setIsBuilderStreaming(false);
              // La réponse complète est maintenant visible dans messages[] et builderMessages[]
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

            case 'mcpServersDetected':
              console.log('[Bridge] MCP servers detected:', message.payload.servers);
              setMcpServers(message.payload.servers);
              setIsDetectingMCP(false);
              break;

            case 'domBridgeSetupComplete':
              console.log('[Bridge] DOM Bridge setup complete:', message.payload);
              // Refresh projects to update DOM selector status
              wsRef.current?.send(JSON.stringify({ type: 'detectNextJsProjects' }));
              break;

            case 'domBridgeSetupError':
              console.error('[Bridge] DOM Bridge setup error:', message.payload.error);
              setError(message.payload.error);
              break;

            // ============== Activity Tracking - Real-time events ==============
            case 'activity':
              const activity = message.payload as Activity;
              console.log('[Bridge] Activity:', activity.type, activity.data.message || activity.data.path);
              setActivities(prev => {
                // Garder uniquement les 50 dernières activités pour éviter les problèmes de mémoire
                const newActivities = [...prev, activity];
                if (newActivities.length > 50) {
                  return newActivities.slice(-50);
                }
                return newActivities;
              });
              break;
            // ============== End Activity Tracking ==============
            
            case 'elementChangesApplied':
              console.log('[Bridge] Element changes applied successfully:', message.payload);
              // Could add a toast notification here
              setActivities(prev => [{
                id: `save-${Date.now()}`,
                type: 'file_modify' as ActivityType,
                timestamp: Date.now(),
                data: {
                  path: message.payload?.file || 'source file',
                  message: 'Changes saved successfully'
                }
              }, ...prev].slice(0, 50));
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
              setActivities(prev => [{
                id: `error-${Date.now()}`,
                type: 'diagnostic' as ActivityType,
                timestamp: Date.now(),
                data: {
                  message: errorMsg + errorDetails,
                  severity: 'error' as const
                }
              }, ...prev].slice(0, 50));
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

  const sendMessage = useCallback((message: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected to VS Code extension');
      return;
    }

    const requestId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Ajouter le message utilisateur
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Préparer le message assistant (vide pour l'instant)
    const assistantMessage: ChatMessage = {
      id: requestId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, assistantMessage]);
    setIsStreaming(true);
    currentStreamRef.current = '';

    wsRef.current.send(JSON.stringify({
      type: 'sendMessage',
      payload: { message },
      requestId
    }));
  }, []);

  const sendToCopilot = useCallback((prompt: string) => {
    console.log('[sendToCopilot] Called with prompt:', prompt);
    console.log('[sendToCopilot] Redirecting to @builder for TRUE Copilot response...');
    
    // ⚠️ IMPORTANT: Utiliser sendToBuilder pour capturer la vraie réponse de Copilot!
    // sendToCopilot utilise vscode.lm qui retourne toujours "vscode.lm"
    // @builder capture la réponse réelle du Chat UI de Copilot
    
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
    
    // Ajouter aussi aux builderMessages pour tracking
    setBuilderMessages(prev => [...prev, userMessage]);

    // Préparer le message assistant vide pour le streaming
    const assistantMessage: ChatMessage = {
      id: requestId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, assistantMessage]);
    setBuilderMessages(prev => [...prev, assistantMessage]);
    
    // Réinitialiser le stream
    builderStreamRef.current = '';
    setBuilderResponse('');

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
    wsRef.current.send(JSON.stringify({
      type: 'setupDOMBridge',
      payload: { projectPath }
    }));
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
   * Envoie un prompt au Chat Participant @builder
   * Ceci capture les vraies réponses du Copilot Chat UI!
   */
  const sendToBuilder = useCallback((prompt: string) => {
    console.log('[sendToBuilder] Called with prompt:', prompt);
    
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('[sendToBuilder] WebSocket not connected');
      setError('Not connected to VS Code extension');
      return;
    }

    const requestId = `builder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('[sendToBuilder] Generated requestId:', requestId);
    
    // Réinitialiser l'état Builder
    setBuilderResponse('');
    builderStreamRef.current = '';
    setIsBuilderStreaming(true);
    setError(null);

    const messageToSend = {
      type: 'sendToBuilder',
      payload: { prompt, requestId },
      requestId
    };
    
    console.log('[sendToBuilder] Sending to @builder via WebSocket');
    wsRef.current.send(JSON.stringify(messageToSend));
  }, []);

  // Clear activities
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

  return {
    models,
    isConnected,
    error,
    selectedModel,
    changeModel,
    refreshModels,
    sendMessage,
    sendToCopilot,
    messages,
    isStreaming,
    isCopilotStreaming,
    copilotResponse,
    copilotChatOpened,
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
    // MCP server management
    mcpServers,
    detectMCPServers,
    isDetectingMCP,
    // @builder - TRUE Copilot Chat capture
    sendToBuilder,
    builderResponse,
    isBuilderStreaming,
    builderMessages,
    // Activity tracking - real-time events
    activities,
    clearActivities,
    // Element editing
    applyElementChanges,
  };
}
