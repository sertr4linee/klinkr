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
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import {
  Context,
  ContextTrigger,
  ContextContent,
  ContextContentHeader,
  ContextContentBody,
  ContextContentFooter,
  ContextInputUsage,
  ContextOutputUsage,
} from "@/components/ai-elements/context";
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
} from "@/components/ai-elements/prompt-input";
import {
  Message,
  MessageContent,
} from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { FileTree } from "@/components/FileTree";
import { NextJsProjectManager } from "@/components/NextJsProjectManager";
import { MCPServerManager } from "@/components/MCPServerManager";
import { LivePreviewWithSelector } from "@/components/LivePreviewWithSelector";
import { ActivityFeed } from "@/components/ActivityFeed";
import { useVSCodeBridge } from "@/hooks/useVSCodeBridge";
import { 
  CheckIcon, 
  RefreshCwIcon, 
  FolderIcon, 
  AlertCircleIcon,
  WifiIcon,
  WifiOffIcon,
  StopCircleIcon,
  TrashIcon,
  Bot,
  User,
  SparklesIcon,
  LayoutDashboard,
  MessageSquare,
  ServerIcon,
  FileCodeIcon,
  ActivityIcon,
  ChevronDown
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

const Example = () => {
  const { 
    models, 
    isConnected, 
    error,
    selectedModel, 
    changeModel,
    sendToCopilot,
    messages,
    isStreaming,
    isBuilderStreaming, // Utiliser isBuilderStreaming au lieu de isCopilotStreaming
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
    // Activity tracking - real-time events
    activities,
    clearActivities
  } = useVSCodeBridge();

  const [activeTab, setActiveTab] = useState<"chat" | "projects" | "files" | "mcp" | "activity">("chat");
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [status, setStatus] = useState<"submitted" | "streaming" | "ready" | "error">("ready");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [activeProjectPath, setActiveProjectPath] = useState<string | null>(null);

  // Calculate port for a project based on its index (starting from 3002)
  const getProjectPort = useCallback((projectPath: string) => {
    const projectIndex = nextJsProjects.findIndex(p => p.path === projectPath);
    return 3002 + Math.max(0, projectIndex);
  }, [nextJsProjects]);

  // Auto-update preview when a project starts running
  useEffect(() => {
    const runningProject = nextJsProjects.find(p => p.status === 'running');
    if (runningProject && runningProject.port) {
      setActiveProjectPath(runningProject.path);
      if (previewOpen) {
        setPreviewUrl(`http://localhost:${runningProject.port}`);
      }
    }
  }, [nextJsProjects, previewOpen]);

  // Detect Next.js projects on initial load (only once when connected)
  const hasDetectedProjects = useRef(false);
  useEffect(() => {
    if (isConnected && !hasDetectedProjects.current) {
      hasDetectedProjects.current = true;
      detectNextJsProjects();
    }
    // Reset flag when disconnected
    if (!isConnected) {
      hasDetectedProjects.current = false;
    }
  }, [isConnected, detectNextJsProjects]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, copilotResponse]);

  // Update status based on builder streaming (TRUE Copilot response)
  useEffect(() => {
    if (isBuilderStreaming) {
      setStatus("streaming");
    } else if (status === "streaming") {
      setStatus("ready");
    }
  }, [isBuilderStreaming, status]);

  // Group models by vendor
  const groupedModels = Object.entries(models || {}).reduce((acc, [vendor, vendorModels]) => {
    if (!acc[vendor]) {
      acc[vendor] = [];
    }
    acc[vendor] = vendorModels;
    return acc;
  }, {} as Record<string, any[]>);

  const handleModelChange = useCallback((model: any) => {
    console.log('[Model Change] Changing model to:', model);
    changeModel({
      vendor: model.vendor,
      id: model.id,
      family: model.family
    });
    setModelSelectorOpen(false);
  }, [changeModel]);

  const handleSubmit = async (message: PromptInputMessage) => {
    console.log('[handleSubmit] Called with message:', message);
    console.log('[handleSubmit] message.text:', message.text);
    console.log('[handleSubmit] message.files:', message.files);
    
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);

    console.log('[handleSubmit] hasText:', hasText, 'hasAttachments:', hasAttachments);

    if (!(hasText || hasAttachments)) {
      console.log('[handleSubmit] No text or attachments, returning early');
      return;
    }

    let fullMessage = message.text || "";
    if (hasAttachments && message.files) {
      const fileNames = message.files.map((f: any) => f.name || f.filename || "file").join(", ");
      fullMessage += `\n\n[Attachments: ${fileNames}]`;
    }

    console.log('[handleSubmit] Full message to send:', fullMessage);
    console.log('[handleSubmit] Message length:', fullMessage.length);

    setStatus("submitted");
    
    // Envoyer vers Copilot Chat
    console.log('[handleSubmit] Calling sendToCopilot...');
    sendToCopilot(fullMessage);
    console.log('[handleSubmit] sendToCopilot called');
  };

  const clearMessages = () => {
    // TODO: Implement clear messages in useVSCodeBridge
    window.location.reload();
  };

  const handleStartNextJsProject = (projectPath: string) => {
    // Use dynamic port based on project index
    const port = getProjectPort(projectPath);
    console.log('[Projects] Starting project:', projectPath, 'on port:', port);
    startNextJsProject(projectPath, port);
    setActiveProjectPath(projectPath);
  };

  const handleStopNextJsProject = (projectPath: string) => {
    stopNextJsProject(projectPath);
    if (activeProjectPath === projectPath) {
      setActiveProjectPath(null);
      setPreviewUrl("");
    }
  };

  const handleOpenPreview = (projectPath: string, port: number) => {
    console.log('[Preview] Opening preview for', projectPath, 'on port', port);
    setActiveProjectPath(projectPath);
    setPreviewUrl(`http://localhost:${port}`);
    setPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    setPreviewUrl("");
  };

  const totalModels = Object.values(models || {}).flat().length;
  const loading = totalModels === 0 && isConnected;

  // Show fullscreen preview if open
  if (previewOpen && previewUrl) {
    return (
      <LivePreviewWithSelector
        url={previewUrl}
        onClose={handleClosePreview}
        onRefresh={() => {
          // Force refresh by toggling the URL
          const currentUrl = previewUrl;
          setPreviewUrl("");
          setTimeout(() => setPreviewUrl(currentUrl), 100);
        }}
      />
    );
  }

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
          {workspacePath && (
            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
              <FolderIcon className="size-3" />
              <code className="rounded bg-zinc-900 px-2 py-1 font-mono">{workspacePath}</code>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
            {isConnected ? (
              <>
                <WifiIcon className="size-4 text-green-500" />
                <span className="text-sm text-zinc-300">Connected</span>
              </>
            ) : (
              <>
                <WifiOffIcon className="size-4 text-red-500" />
                <span className="text-sm text-zinc-300">Disconnected</span>
              </>
            )}
          </div>

          {/* Model Count */}
          {isConnected && (
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
              <SparklesIcon className="size-4 text-blue-500" />
              <span className="text-sm text-zinc-300">{totalModels} models</span>
            </div>
          )}

          {/* Context Usage */}
          {isConnected && (() => {
            // Estimation approximative des tokens (1 token ≈ 4 caractères)
            const inputTokens = messages
              .filter(m => m.role === 'user')
              .reduce((acc, m) => acc + Math.ceil((m.content?.length || 0) / 4), 0);
            const outputTokens = messages
              .filter(m => m.role === 'assistant')
              .reduce((acc, m) => acc + Math.ceil((m.content?.length || 0) / 4), 0);
            const totalTokens = inputTokens + outputTokens;
            
            return (
              <Context
                usedTokens={totalTokens}
                maxTokens={128000}
                modelId={selectedModel?.id}
                usage={{
                  inputTokens: inputTokens,
                  outputTokens: outputTokens,
                  totalTokens: totalTokens,
                  inputTokenDetails: { noCacheTokens: undefined, cacheReadTokens: undefined, cacheWriteTokens: undefined },
                  outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
                }}
              >
                <ContextTrigger className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-300 hover:bg-zinc-800" />
                <ContextContent className="border-zinc-800 bg-zinc-900">
                  <ContextContentHeader />
                  <ContextContentBody className="space-y-2">
                    <ContextInputUsage />
                    <ContextOutputUsage />
                  </ContextContentBody>
                  <ContextContentFooter />
                </ContextContent>
              </Context>
            );
          })()}
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("chat")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "chat"
                ? "border-blue-500 text-blue-500"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            )}
          >
            <MessageSquare className="size-4" />
            Chat & Build
          </button>
          <button
            onClick={() => setActiveTab("projects")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "projects"
                ? "border-blue-500 text-blue-500"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            )}
          >
            <LayoutDashboard className="size-4" />
            Projects
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "files"
                ? "border-blue-500 text-blue-500"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            )}
          >
            <FileCodeIcon className="size-4" />
            Files
          </button>
          <button
            onClick={() => setActiveTab("mcp")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "mcp"
                ? "border-blue-500 text-blue-500"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            )}
          >
            <ServerIcon className="size-4" />
            MCP Servers
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              activeTab === "activity"
                ? "border-blue-500 text-blue-500"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            )}
          >
            <ActivityIcon className="size-4" />
            Activity
            {activities.length > 0 && (
              <span className="size-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </button>
        </div>
      </div>
      
      <main className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-y-auto p-6">
        {/* Error Alert */}
        {error && (
          <div className="mx-auto mb-6 flex w-full max-w-4xl items-center gap-3 rounded-lg border border-red-900/50 bg-red-950/20 p-4 text-red-200">
            <AlertCircleIcon className="size-5" />
            <div>
              <p className="font-medium">Connection Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {!isConnected && (
          <div className="mx-auto mb-6 flex w-full max-w-4xl items-center gap-3 rounded-lg border border-yellow-900/50 bg-yellow-950/20 p-4 text-yellow-200">
            <AlertCircleIcon className="size-5" />
            <div>
              <p className="font-medium">Not Connected</p>
              <p className="text-sm">
                Make sure the VS Code extension is running and the WebSocket server is active.
              </p>
            </div>
          </div>
        )}

        <div className="mx-auto w-full max-w-4xl">
          
          {/* CHAT TAB */}
          {activeTab === "chat" && (
            <div className="text-center">
              <h2 className="mb-2 font-bold text-4xl text-white">
                What will you build today?
              </h2>
              
              {/* Selected Model Display */}
              {selectedModel && (
                <p className="mb-6 text-sm text-zinc-500">
                  Using <span className="font-semibold text-zinc-300">{selectedModel.id}</span>
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
                            <div className="flex items-start gap-3">
                              <div className="flex-1 rounded-xl bg-blue-600 p-4 text-white">
                                {msg.content}
                              </div>
                              <div className="shrink-0 size-8 rounded-lg bg-zinc-700 flex items-center justify-center">
                                <User className="size-4 text-zinc-300" />
                              </div>
                            </div>
                          </MessageContent>
                        </Message>
                      ) : (
                        <Message from="assistant">
                          <MessageContent>
                            <div className="flex items-start gap-3">
                              <div className="shrink-0 size-8 rounded-lg bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <Bot className="size-4 text-white" />
                              </div>
                              <div className="flex-1 rounded-xl bg-zinc-800 p-4 text-zinc-100">
                                {msg.content ? (
                                  <span>
                                    {msg.content}
                                    {/* Curseur clignotant pendant le streaming */}
                                    {isBuilderStreaming && msg.id === messages[messages.length - 1]?.id && (
                                      <span className="inline-block w-2 h-4 ml-0.5 bg-blue-500 animate-pulse" />
                                    )}
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-2 text-zinc-400">
                                    <div className="size-2 rounded-full bg-blue-500 animate-pulse" />
                                    <span className="text-sm">Thinking...</span>
                                  </div>
                                )}
                              </div>
                            </div>
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
                  {isStreaming && (
                    <Button
                      onClick={() => console.log("Stop not implemented")}
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
                    disabled={isStreaming}
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
                            className="w-auto justify-start"
                            size="sm"
                          >
                            {loading ? (
                              <RefreshCwIcon className="size-4 animate-spin" />
                            ) : selectedModel ? (
                              <>
                                <ModelSelectorLogo
                                  provider={selectedModel.vendor}
                                />
                                <ModelSelectorName className="flex-1 text-left">
                                  {selectedModel.id}
                                </ModelSelectorName>
                                <ChevronDown className="ml-2 size-4 text-muted-foreground" />
                              </>
                            ) : (
                              <>
                                <span>Select Model</span>
                                <ChevronDown className="ml-2 size-4 text-muted-foreground" />
                              </>
                            )}
                          </PromptInputButton>
                        </ModelSelectorTrigger>
                        <ModelSelectorContent title="Select Model">
                          <ModelSelectorInput placeholder="Search models..." />
                          <ModelSelectorList>
                            <ModelSelectorEmpty>
                              {error ? `Error: ${error}` : "No models found."}
                            </ModelSelectorEmpty>
                            
                            {Object.keys(groupedModels).sort().map((vendor) => {
                              const vendorModels = groupedModels[vendor];
                              if (!vendorModels || vendorModels.length === 0) return null;
                              
                              return (
                                <ModelSelectorGroup heading={vendor.toUpperCase()} key={vendor}>
                                  {vendorModels.map((m: any) => (
                                    <ModelSelectorItem
                                      key={m.id}
                                      onSelect={() => handleModelChange(m)}
                                      value={m.id}
                                    >
                                      <ModelSelectorLogo provider={m.vendor} />
                                      <div className="flex flex-1 flex-col items-start">
                                        <ModelSelectorName>{m.name}</ModelSelectorName>
                                        <span className="text-muted-foreground text-xs">
                                          {m.family}
                                        </span>
                                      </div>
                                      {selectedModel?.id === m.id && (
                                        <CheckIcon className="ml-2 size-4 text-green-500" />
                                      )}
                                    </ModelSelectorItem>
                                  ))}
                                </ModelSelectorGroup>
                              );
                            })}
                          </ModelSelectorList>
                        </ModelSelectorContent>
                      </ModelSelector>
                    </PromptInputTools>
                    <PromptInputSubmit 
                      status={isStreaming ? "streaming" : status} 
                      disabled={isStreaming || !selectedModel}
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
          )}

          {/* PROJECTS TAB */}
          {activeTab === "projects" && (
            <div>
              <div className="mb-6">
                <h2 className="font-bold text-2xl text-zinc-100">Next.js Projects</h2>
                <p className="text-zinc-500">Manage your Next.js applications</p>
              </div>
              <NextJsProjectManager
                projects={nextJsProjects}
                onStartProject={handleStartNextJsProject}
                onStopProject={handleStopNextJsProject}
                onOpenPreview={handleOpenPreview}
                onRefreshProjects={detectNextJsProjects}
                onSetupDOMBridge={setupDOMBridge}
                sendToCopilot={sendToCopilot}
                isLoading={isDetectingProjects}
              />
            </div>
          )}

          {/* FILES TAB */}
          {activeTab === "files" && (
            <div>
              <div className="mb-6">
                <h2 className="font-bold text-2xl text-zinc-100">File Explorer</h2>
                <p className="text-zinc-500">Browse your workspace files</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
                  {Object.keys(fileTree).length > 0 ? (
                    <FileTree fileTree={fileTree} rootPath={workspacePath} />
                  ) : (
                    <div className="text-sm text-zinc-500">
                      {isConnected ? 'Loading workspace...' : 'Not connected'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MCP TAB */}
          {activeTab === "mcp" && (
            <div>
              <div className="mb-6">
                <h2 className="font-bold text-2xl text-zinc-100">MCP Servers</h2>
                <p className="text-zinc-500">Manage Model Context Protocol servers</p>
              </div>
              <MCPServerManager
                mcpServers={mcpServers}
                detectMCPServers={detectMCPServers}
                isDetectingMCP={isDetectingMCP}
              />
            </div>
          )}

          {/* ACTIVITY TAB */}
          {activeTab === "activity" && (
            <div className="h-full flex flex-col">
              <div className="mb-6">
                <h2 className="font-bold text-2xl text-zinc-100">Activity Feed</h2>
                <p className="text-zinc-500">Real-time tracking of file operations, commands, and more</p>
              </div>
              <div className="flex-1 border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/50">
                <ActivityFeed 
                  activities={activities} 
                  onClear={clearActivities}
                />
              </div>
            </div>
          )}

        </div>
        </div>
      </main>
    </div>
  );
};

export default Example;
