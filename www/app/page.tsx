"use client";

import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputProvider,
  PromptInputSpeechButton,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
import {
  Task,
  TaskTrigger,
  TaskContent,
  TaskItem,
  TaskItemFile,
} from "@/components/ai-elements/task";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { FileTree } from "@/components/file-tree";
import { ProjectDetector } from "@/components/project-detector";
import { useChat } from "@/hooks/use-chat";
import { 
  CheckIcon, 
  RefreshCwIcon, 
  FolderIcon, 
  AlertCircleIcon,
  WifiIcon,
  WifiOffIcon,
  StopCircleIcon,
  TrashIcon,
  ClipboardCopyIcon,
  SendIcon,
  Loader2Icon,
  SparklesIcon,
  RocketIcon,
  CopyIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  RotateCwIcon
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";

type CopilotModel = {
  id: string;
  name: string;
  family: string;
  version: string;
  vendor: string;
  maxInputTokens: number;
  isAgent?: boolean;
  capabilities?: {
    chat: boolean;
    code: boolean;
    streaming: boolean;
  };
};

type WSConnectionStatus = "connected" | "connecting" | "disconnected";
type PromptStatus = "idle" | "copying" | "pasting" | "waiting" | "done" | "error";

const SUBMITTING_TIMEOUT = 200;
const STREAMING_TIMEOUT = 2000;

const HeaderControls = () => {
  const controller = usePromptInputController();

  return (
    <header className="mt-8 flex items-center justify-between">
      <p className="text-sm text-zinc-400">
        Header Controls via{" "}
        <code className="rounded-md bg-zinc-800 p-1 font-bold text-white">
          PromptInputProvider
        </code>
      </p>
      <ButtonGroup>
        <Button
          onClick={() => {
            controller.textInput.clear();
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          Clear input
        </Button>
        <Button
          onClick={() => {
            controller.textInput.setInput("Inserted via PromptInputProvider");
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          Set input
        </Button>

        <Button
          onClick={() => {
            controller.attachments.clear();
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          Clear attachments
        </Button>
      </ButtonGroup>
    </header>
  );
};

const Example = () => {
  const [models, setModels] = useState<CopilotModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string>("");
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [status, setStatus] = useState<
    "submitted" | "streaming" | "ready" | "error"
  >("ready");
  const [promptStatus, setPromptStatus] = useState<PromptStatus>("idle");
  const [lastPromptMessage, setLastPromptMessage] = useState<string>("");
  const [wsStatus, setWsStatus] = useState<WSConnectionStatus>("connecting");
  const [currentPath, setCurrentPath] = useState<string>("");
  const [isDevMode, setIsDevMode] = useState<boolean>(false);
  const [copilotAvailable, setCopilotAvailable] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Chat hook
  const { messages, isLoading: isChatLoading, sendMessage, stopGeneration, clearMessages } = useChat({
    onError: (error) => {
      console.error("Chat error:", error);
      setStatus("error");
    },
    onFinish: () => {
      setStatus("ready");
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // WebSocket connection for real-time status - disabled in dev mode
  useEffect(() => {
    // Skip WebSocket in Next.js dev mode
    setWsStatus("connected");
    return () => {};
  }, []);

  // Fetch current working directory and Copilot status
  useEffect(() => {
    const fetchPath = async () => {
      try {
        const response = await fetch("/api/status");
        if (response.ok) {
          const data = await response.json();
          // Get path from backend
          if (data.currentPath) {
            setCurrentPath(data.currentPath);
          }
          // Check if we're in development mode
          setIsDevMode(data.isDevelopmentMode || false);
          
          // Update WS status based on API response
          if (data.status === "standalone") {
            setWsStatus("disconnected");
          } else if (data.status === "connected") {
            setWsStatus("connected");
          }
        }
        
        // Check Copilot availability
        const copilotResponse = await fetch("/api/copilot/status");
        if (copilotResponse.ok) {
          const copilotData = await copilotResponse.json();
          setCopilotAvailable(copilotData.copilotAvailable || false);
        }
      } catch (err) {
        console.error("Failed to fetch path:", err);
        setCurrentPath("Not connected");
        setWsStatus("disconnected");
      }
    };

    fetchPath();
    
    // Refresh path every 5 seconds
    const interval = setInterval(fetchPath, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Copilot models from API
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/models");
        if (!response.ok) {
          throw new Error("Failed to fetch models");
        }
        const data = await response.json();
        if (data.success && data.models) {
          // Sort models by vendor and name
          const sortedModels = data.models.sort((a: CopilotModel, b: CopilotModel) => {
            if (a.vendor !== b.vendor) {
              return a.vendor.localeCompare(b.vendor);
            }
            return a.name.localeCompare(b.name);
          });
          setModels(sortedModels);
          if (sortedModels.length > 0) {
            const firstModelId = sortedModels[0].id;
            console.log('[Models] Setting default model:', firstModelId);
            setModel(firstModelId);
          } else {
            console.warn('[Models] No models available');
          }
          // Check if we're in dev mode based on API response
          setIsDevMode(data.isDevelopmentMode || false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        console.error("Error fetching models:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, []);

  const selectedModelData = models.find((m) => m.id === model);

  // Filter only agent models for selection
  const agentModels = models.filter((m) => m.isAgent);

  // Group models by vendor
  const groupedModels = models.reduce((acc, model) => {
    const vendor = model.vendor || "Other";
    if (!acc[vendor]) {
      acc[vendor] = [];
    }
    acc[vendor].push(model);
    return acc;
  }, {} as Record<string, CopilotModel[]>);

  // Handler pour le changement de modèle
  const handleModelChange = useCallback((newModelId: string) => {
    console.log('[Model Change] Changing model to:', newModelId);
    setModel(newModelId);
    setModelSelectorOpen(false);
  }, []);

  const handleSubmit = async (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    console.log('[handleSubmit] Called with:', {
      hasText,
      hasAttachments,
      model,
      messageLength: message.text?.length || 0
    });

    if (!(hasText || hasAttachments)) {
      console.warn('[handleSubmit] No text or attachments');
      return;
    }

    if (!model) {
      console.error('[handleSubmit] No model selected. Available models:', models.length);
      alert('Please select a model first. Refresh the page if no models are available.');
      return;
    }

    // Build full message
    let fullMessage = message.text || "";
    if (hasAttachments && message.files) {
      const fileNames = message.files.map((f: any) => f.name || f.fileName || "file").join(", ");
      fullMessage += `\n\n[Attachments: ${fileNames}]`;
    }

    setStatus("submitted");
    setLastPromptMessage(fullMessage);

    // Si Copilot est disponible et on est connecté, envoyer aussi au panel Copilot natif
    if (copilotAvailable && wsStatus === "connected") {
      try {
        setPromptStatus("copying");
        
        // Envoyer au panel Copilot natif de VS Code
        const copilotResponse = await fetch("/api/copilot/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: fullMessage, modelId: model }),
        });
        
        if (copilotResponse.ok) {
          const result = await copilotResponse.json();
          console.log("[Copilot] Prompt envoyé au panel Copilot:", result);
          setPromptStatus(result.status || "done");
          
          // Reset status after 3 seconds
          setTimeout(() => setPromptStatus("idle"), 3000);
        } else {
          console.error("[Copilot] Failed to send to Copilot panel");
          setPromptStatus("error");
          setTimeout(() => setPromptStatus("idle"), 3000);
        }
      } catch (error) {
        console.error("Failed to send to Copilot:", error);
        setPromptStatus("error");
        setTimeout(() => setPromptStatus("idle"), 3000);
      }
    }

    // Envoyer aussi via notre API de chat pour afficher dans notre interface
    setTimeout(() => {
      setStatus("streaming");
    }, SUBMITTING_TIMEOUT);

    await sendMessage(fullMessage, model);
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <div>
          <h1 className="font-bold text-2xl text-zinc-100 tracking-tight">
            HATAY STUDIO
          </h1>
          <p className="text-muted-foreground text-sm">
            Create and manage AI-powered projects
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Copilot Status */}
          {copilotAvailable && (
            <div className="flex items-center gap-2 rounded-lg border border-green-800 bg-green-950/30 px-3 py-2">
              <SparklesIcon className="size-4 text-green-500" />
              <span className="text-sm text-green-300">Copilot Ready</span>
            </div>
          )}
          
          {/* Dev Mode Badge */}
          {isDevMode && (
            <div className="flex items-center gap-2 rounded-lg border border-yellow-800 bg-yellow-950/30 px-3 py-2">
              <AlertCircleIcon className="size-4 text-yellow-500" />
              <span className="text-sm text-yellow-300">Mode Dev</span>
            </div>
          )}
          
          {/* Connection Status */}
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
            {wsStatus === "connected" ? (
              <>
                <WifiIcon className="size-4 text-green-500" />
                <span className="text-sm text-zinc-300">
                  {isDevMode ? "Simulé" : "Connecté"}
                </span>
              </>
            ) : wsStatus === "connecting" ? (
              <>
                <RefreshCwIcon className="size-4 animate-spin text-yellow-500" />
                <span className="text-sm text-zinc-300">Connexion...</span>
              </>
            ) : (
              <>
                <WifiOffIcon className="size-4 text-red-500" />
                <span className="text-sm text-zinc-300">Déconnecté</span>
              </>
            )}
          </div>

          {/* Current Path Badge */}
          {currentPath && (
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
              <FolderIcon className="size-4 text-blue-500" />
              <span className="max-w-xs truncate font-mono text-sm text-zinc-300">
                {currentPath || "/"}
              </span>
            </div>
          )}
        </div>
      </header>
      
      <main className="flex flex-1 flex-col p-6">
        {/* Prompt Status Indicator */}
        {promptStatus !== "idle" && (
          <div className={`mx-auto mb-6 flex w-full max-w-4xl items-center gap-3 rounded-lg border p-4 transition-all duration-300 ${
            promptStatus === "copying" ? "border-blue-800 bg-blue-950/30 text-blue-200" :
            promptStatus === "pasting" ? "border-purple-800 bg-purple-950/30 text-purple-200" :
            promptStatus === "waiting" ? "border-yellow-800 bg-yellow-950/30 text-yellow-200" :
            promptStatus === "done" ? "border-green-800 bg-green-950/30 text-green-200" :
            "border-red-800 bg-red-950/30 text-red-200"
          }`}>
            {promptStatus === "copying" && (
              <>
                <ClipboardCopyIcon className="size-5 animate-pulse" />
                <div>
                  <p className="font-medium">📋 Copie dans le presse-papier...</p>
                  <p className="text-sm opacity-70">Préparation du prompt</p>
                </div>
              </>
            )}
            {promptStatus === "pasting" && (
              <>
                <SendIcon className="size-5 animate-pulse" />
                <div>
                  <p className="font-medium">🚀 Envoi au Copilot...</p>
                  <p className="text-sm opacity-70">Collage dans le chat VS Code</p>
                </div>
              </>
            )}
            {promptStatus === "waiting" && (
              <>
                <Loader2Icon className="size-5 animate-spin" />
                <div>
                  <p className="font-medium">⏳ En attente de réponse...</p>
                  <p className="text-sm opacity-70">Copilot traite votre demande</p>
                </div>
              </>
            )}
            {promptStatus === "done" && (
              <>
                <CheckIcon className="size-5" />
                <div>
                  <p className="font-medium">✅ Prompt envoyé avec succès!</p>
                  <p className="text-sm opacity-70">Vérifiez le chat Copilot dans VS Code</p>
                </div>
              </>
            )}
            {promptStatus === "error" && (
              <>
                <AlertCircleIcon className="size-5" />
                <div>
                  <p className="font-medium">❌ Erreur d'envoi</p>
                  <p className="text-sm opacity-70">Impossible d'envoyer au Copilot</p>
                </div>
              </>
            )}
          </div>
        )}

        {wsStatus === "disconnected" && (
          <div className="mx-auto mb-6 flex w-full max-w-4xl items-center gap-3 rounded-lg border border-red-900/50 bg-red-950/20 p-4 text-red-200">
            <AlertCircleIcon className="size-5" />
            <div>
              <p className="font-medium">MODE DÉVELOPPEMENT</p>
              <p className="text-sm">
                {isDevMode 
                  ? "Les réponses sont simulées. Lancez l'extension VS Code pour utiliser les vrais modèles Copilot."
                  : "Non connecté. Cliquez sur le bouton de l'extension dans votre IDE pour redémarrer."}
              </p>
            </div>
          </div>
        )}

        <div className="mx-auto w-full max-w-4xl text-center">
          <h2 className="mb-2 font-bold text-4xl text-white">
            What will you build today?
          </h2>
          
          {/* Selected Model Display */}
          {selectedModelData && (
            <p className="mb-6 text-sm text-zinc-500">
              Using <span className="font-semibold text-zinc-300">{selectedModelData.name}</span> 
              {selectedModelData.isAgent && <span className="ml-1 text-green-500">• Agent Mode</span>}
            </p>
          )}

          {/* Chat Messages */}
          {messages.length > 0 && (
            <div className="mb-6 space-y-4 max-h-150 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-left">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === "user" ? (
                    <Message from="user">
                      <MessageContent>
                        <MessageResponse>{msg.content}</MessageResponse>
                      </MessageContent>
                    </Message>
                  ) : (
                    <Message from="assistant">
                      <MessageContent>
                        {/* Show reasoning if available */}
                        {msg.reasoning && (
                          <Reasoning isStreaming={msg.isStreaming || false}>
                            <ReasoningTrigger />
                            <ReasoningContent>
                              {msg.reasoning}
                            </ReasoningContent>
                          </Reasoning>
                        )}
                        
                        {/* Show tasks if available */}
                        {msg.tasks && msg.tasks.length > 0 && msg.tasks.map((task, idx) => (
                          <Task key={idx}>
                            <TaskTrigger title={task.title} />
                            <TaskContent>
                              {task.files && task.files.map((file, fileIdx) => (
                                <TaskItemFile key={fileIdx}>
                                  {file.name}
                                </TaskItemFile>
                              ))}
                            </TaskContent>
                          </Task>
                        ))}
                        
                        {/* Main response content */}
                        <MessageResponse>{msg.content}</MessageResponse>
                        
                        {/* Action buttons */}
                        {!msg.isStreaming && msg.content && (
                          <MessageActions>
                            <MessageAction
                              label="Copy"
                              tooltip="Copy to clipboard"
                              onClick={() => navigator.clipboard.writeText(msg.content)}
                            >
                              <CopyIcon className="size-4" />
                            </MessageAction>
                            <MessageAction
                              label="Like"
                              tooltip="Good response"
                              onClick={() => console.log("Liked:", msg.id)}
                            >
                              <ThumbsUpIcon className="size-4" />
                            </MessageAction>
                            <MessageAction
                              label="Dislike"
                              tooltip="Bad response"
                              onClick={() => console.log("Disliked:", msg.id)}
                            >
                              <ThumbsDownIcon className="size-4" />
                            </MessageAction>
                            <MessageAction
                              label="Retry"
                              tooltip="Regenerate response"
                              onClick={() => console.log("Retry:", msg.id)}
                            >
                              <RotateCwIcon className="size-4" />
                            </MessageAction>
                          </MessageActions>
                        )}
                      </MessageContent>
                    </Message>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Control buttons */}
          {messages.length > 0 && (
            <div className="mb-4 flex justify-center gap-2">
              {isChatLoading && (
                <Button
                  onClick={stopGeneration}
                  size="sm"
                  variant="destructive"
                  className="gap-2"
                >
                  <StopCircleIcon className="size-4" />
                  Stop Generation
                </Button>
              )}
              <Button
                onClick={clearMessages}
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={isChatLoading}
              >
                <TrashIcon className="size-4" />
                Clear Chat
              </Button>
            </div>
          )}

          <PromptInputProvider>
            <PromptInput 
              globalDrop 
              multiple 
              onSubmit={handleSubmit}
              className="mb-6"
            >
              <PromptInputAttachments>
                {(attachment: any) => <PromptInputAttachment data={attachment} />}
              </PromptInputAttachments>
              <PromptInputBody>
                <PromptInputTextarea 
                  ref={textareaRef}
                  placeholder="Your prompt here..."
                  className="min-h-30"
                />
              </PromptInputBody>
              <PromptInputFooter>
                <PromptInputTools>
                  <PromptInputActionMenu>
                    <PromptInputActionMenuTrigger />
                    <PromptInputActionMenuContent>
                      <PromptInputActionAddAttachments />
                    </PromptInputActionMenuContent>
                  </PromptInputActionMenu>
                  <PromptInputSpeechButton textareaRef={textareaRef} />
                  <ModelSelector
                    onOpenChange={setModelSelectorOpen}
                    open={modelSelectorOpen}
                  >
                    <ModelSelectorTrigger asChild>
                      <PromptInputButton 
                        disabled={loading}
                        className="min-w-45 justify-start"
                      >
                        {loading ? (
                          <RefreshCwIcon className="size-4 animate-spin" />
                        ) : selectedModelData ? (
                          <>
                            <ModelSelectorLogo
                              provider={selectedModelData.vendor.toLowerCase()}
                            />
                            <ModelSelectorName className="flex-1 text-left">
                              {selectedModelData.name}
                            </ModelSelectorName>
                          </>
                        ) : (
                          <span>Select Model</span>
                        )}
                      </PromptInputButton>
                    </ModelSelectorTrigger>
                    <ModelSelectorContent title="Select Copilot Model">
                      <ModelSelectorInput placeholder="Search models..." />
                      <ModelSelectorList>
                        <ModelSelectorEmpty>
                          {error ? `Error: ${error}` : "No models found."}
                        </ModelSelectorEmpty>
                        
                        {/* Modèles Agents (pour le chat) */}
                        {Object.keys(groupedModels).some(vendor => 
                          groupedModels[vendor].some(m => m.isAgent)
                        ) && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-zinc-400">
                              🤖 CHAT AGENTS
                            </div>
                            {Object.keys(groupedModels).sort().map((vendor) => {
                              const agentModels = groupedModels[vendor].filter(m => m.isAgent);
                              if (agentModels.length === 0) return null;
                              
                              return (
                                <ModelSelectorGroup heading={vendor} key={`agent-${vendor}`}>
                                  {agentModels.map((m) => (
                                    <ModelSelectorItem
                                      key={m.id}
                                      onSelect={() => handleModelChange(m.id)}
                                      value={m.id}
                                    >
                                      <ModelSelectorLogo
                                        provider={m.vendor.toLowerCase()}
                                      />
                                      <div className="flex flex-1 flex-col items-start">
                                        <ModelSelectorName>{m.name}</ModelSelectorName>
                                        <span className="text-muted-foreground text-xs">
                                          {m.family} • {m.version} • 💬 Chat Agent
                                        </span>
                                      </div>
                                      {model === m.id && (
                                        <CheckIcon className="ml-2 size-4 text-green-500" />
                                      )}
                                    </ModelSelectorItem>
                                  ))}
                                </ModelSelectorGroup>
                              );
                            })}
                          </>
                        )}
                        
                        {/* Autres modèles */}
                        {Object.keys(groupedModels).some(vendor => 
                          groupedModels[vendor].some(m => !m.isAgent)
                        ) && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-zinc-400 mt-2">
                              📦 OTHER MODELS
                            </div>
                            {Object.keys(groupedModels).sort().map((vendor) => {
                              const nonAgentModels = groupedModels[vendor].filter(m => !m.isAgent);
                              if (nonAgentModels.length === 0) return null;
                              
                              return (
                                <ModelSelectorGroup heading={vendor} key={`other-${vendor}`}>
                                  {nonAgentModels.map((m) => (
                                    <ModelSelectorItem
                                      key={m.id}
                                      onSelect={() => handleModelChange(m.id)}
                                      value={m.id}
                                    >
                                      <ModelSelectorLogo
                                        provider={m.vendor.toLowerCase()}
                                      />
                                      <div className="flex flex-1 flex-col items-start">
                                        <ModelSelectorName>{m.name}</ModelSelectorName>
                                        <span className="text-muted-foreground text-xs">
                                          {m.family} • {m.version}
                                        </span>
                                      </div>
                                      {model === m.id && (
                                        <CheckIcon className="ml-2 size-4 text-green-500" />
                                      )}
                                    </ModelSelectorItem>
                                  ))}
                                </ModelSelectorGroup>
                              );
                            })}
                          </>
                        )}
                      </ModelSelectorList>
                    </ModelSelectorContent>
                  </ModelSelector>
                </PromptInputTools>
                <PromptInputSubmit 
                  status={isChatLoading ? "streaming" : status} 
                  disabled={isChatLoading || !model}
                />
              </PromptInputFooter>
            </PromptInput>

            {/* Quick Templates */}
            <div className="mt-8">
              <p className="mb-4 text-muted-foreground text-sm">
                Or 1-click new app from a template
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button variant="outline" size="sm">Next.js app</Button>
                <Button variant="outline" size="sm">React (Vite) app</Button>
                <Button variant="outline" size="sm">Vue app</Button>
                <Button variant="outline" size="sm">Svelte app</Button>
                <Button variant="outline" size="sm">Angular app</Button>
                <Button variant="outline" size="sm">Vanilla JS app</Button>
              </div>
            </div>
          </PromptInputProvider>
        </div>

        {/* File Tree and Project Detector Section */}
        <div className="mx-auto mt-12 grid w-full max-w-7xl grid-cols-1 gap-6 lg:grid-cols-2">
          {/* File Tree */}
          <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h3 className="font-semibold text-zinc-100 tracking-tight">
                FILE EXPLORER
              </h3>
              <p className="text-muted-foreground text-xs">
                Current workspace structure
              </p>
            </div>
            <div className="flex-1 overflow-auto p-2" style={{ maxHeight: "500px" }}>
              <FileTree />
            </div>
          </div>

          {/* Project Detector */}
          <div className="flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/50">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h3 className="font-semibold text-zinc-100 tracking-tight">
                DETECTED APPS
              </h3>
              <p className="text-muted-foreground text-xs">
                Recognized projects in workspace
              </p>
            </div>
            <div className="flex-1 overflow-auto" style={{ maxHeight: "500px" }}>
              <ProjectDetector />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Example;
