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
  TrashIcon
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CopilotModel = {
  id: string;
  name: string;
  family: string;
  version: string;
  vendor: string;
  maxInputTokens: number;
};

type WSConnectionStatus = "connected" | "connecting" | "disconnected";

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
  const [wsStatus, setWsStatus] = useState<WSConnectionStatus>("connecting");
  const [currentPath, setCurrentPath] = useState<string>("");
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

  // Fetch current working directory
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
        }
      } catch (err) {
        console.error("Failed to fetch path:", err);
        setCurrentPath("Not connected");
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
            setModel(sortedModels[0].id);
          }
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

  // Group models by vendor
  const groupedModels = models.reduce((acc, model) => {
    const vendor = model.vendor || "Other";
    if (!acc[vendor]) {
      acc[vendor] = [];
    }
    acc[vendor].push(model);
    return acc;
  }, {} as Record<string, CopilotModel[]>);

  const handleSubmit = async (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments)) {
      return;
    }

    if (!model) {
      console.error("No model selected");
      return;
    }

    setStatus("submitted");

    // Handle attachments in the future
    let fullMessage = message.text || "";
    if (hasAttachments && message.files) {
      const fileNames = message.files.map((f: any) => f.name || f.fileName || "file").join(", ");
      fullMessage += `\n\n[Attachments: ${fileNames}]`;
    }

    setTimeout(() => {
      setStatus("streaming");
    }, SUBMITTING_TIMEOUT);

    // Send message to chat
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
          {/* Connection Status */}
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
            {wsStatus === "connected" ? (
              <>
                <WifiIcon className="size-4 text-green-500" />
                <span className="text-sm text-zinc-300">Connected</span>
              </>
            ) : wsStatus === "connecting" ? (
              <>
                <RefreshCwIcon className="size-4 animate-spin text-yellow-500" />
                <span className="text-sm text-zinc-300">Connecting...</span>
              </>
            ) : (
              <>
                <WifiOffIcon className="size-4 text-red-500" />
                <span className="text-sm text-zinc-300">Disconnected</span>
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
        {wsStatus === "disconnected" && (
          <div className="mx-auto mb-6 flex w-full max-w-4xl items-center gap-3 rounded-lg border border-red-900/50 bg-red-950/20 p-4 text-red-200">
            <AlertCircleIcon className="size-5" />
            <div>
              <p className="font-medium">NOT CONNECTED</p>
              <p className="text-sm">
                Check your IDE and click on the extension button to restart
              </p>
            </div>
          </div>
        )}

        <div className="mx-auto w-full max-w-4xl text-center">
          <h2 className="mb-8 font-bold text-4xl text-white">
            What will you build today?
          </h2>

          {/* Chat Messages */}
          {messages.length > 0 && (
            <div className="mb-6 max-h-96 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-left">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`mb-4 flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-800 text-zinc-100"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2 text-xs opacity-70">
                      <span>{msg.role === "user" ? "You" : "Assistant"}</span>
                      {msg.modelId && (
                        <span className="rounded bg-black/20 px-1">
                          {models.find((m) => m.id === msg.modelId)?.name || msg.modelId}
                        </span>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                  </div>
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
                        {Object.keys(groupedModels).sort().map((vendor) => (
                          <ModelSelectorGroup heading={vendor} key={vendor}>
                            {groupedModels[vendor].map((m) => (
                              <ModelSelectorItem
                                key={m.id}
                                onSelect={() => {
                                  setModel(m.id);
                                  setModelSelectorOpen(false);
                                }}
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
                        ))}
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
