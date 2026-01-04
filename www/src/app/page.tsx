"use client";

import { StardustButton } from "@/components/ui/stardust-button";
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
import { ToastProvider } from "@/components/ui/toast";
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
  ChevronDown,
  CommandIcon,
  SettingsIcon,
  LogOutIcon
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";

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
      <ToastProvider>
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
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="flex h-screen bg-zinc-950 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-64 flex flex-col border-r border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          {/* Logo Area */}
          <div className="h-16 flex items-center gap-3 px-6 border-b border-zinc-800/50">
            <div className="relative flex items-center justify-center size-8 rounded-xl bg-blue-black text-white">
              <Image src="/Layer.svg" alt="Klinkr Logo" width={32} height={32}/>
            </div>
            <div>
              <h1 className="font-bold text-lg text-zinc-100 tracking-tight leading-none">
                klinkr.
              </h1>
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                Local AI Studio
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
            {/* Primary Actions */}
            <div className="space-y-2 flex justify-center">
               <StardustButton 
                onClick={() => {
                  setActiveTab("chat");
                }}
              >
                <span className="default-icon">✧</span>
                <span className="hover-icon">✦</span>
                <MessageSquare className="size-4" />
                New Chat
              </StardustButton>
            </div>

            {/* Main Nav */}
            <div className="space-y-1">
              <div className="px-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Platform
              </div>
              
              {[
                { id: 'chat', label: 'Chat & Build', icon: MessageSquare },
                { id: 'projects', label: 'Projects', icon: LayoutDashboard },
                { id: 'files', label: 'Files', icon: FileCodeIcon },
                { id: 'mcp', label: 'MCP Servers', icon: ServerIcon },
                { id: 'activity', label: 'Activity', icon: ActivityIcon },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group",
                    activeTab === item.id
                      ? "bg-zinc-800 text-zinc-100 shadow-sm ring-1 ring-white/5"
                      : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                  )}
                >
                  <item.icon className={cn(
                    "size-4 transition-colors",
                    activeTab === item.id ? "text-white" : "text-zinc-500 group-hover:text-zinc-400"
                  )} />
                  {item.label}
                  {item.id === 'activity' && activities.length > 0 && (
                    <span className="ml-auto size-1.5 rounded-full bg-white animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  )}
                </button>
              ))}
            </div>
          </nav>

          {/* Bottom Status Area */}
          <div className="p-4 border-t border-zinc-800/50 bg-zinc-900/30 space-y-3">
            {/* Workspace Card */}
            {workspacePath && (
              <div className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border border-zinc-800/50 bg-zinc-950/50 hover:bg-zinc-950 hover:border-zinc-700 transition-all cursor-default">
                <div className="flex items-center justify-center size-8 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-zinc-300 group-hover:border-zinc-700 transition-colors">
                  <FolderIcon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-300 truncate">
                    {workspacePath.split('/').pop()}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={cn(
                      "size-1.5 rounded-full",
                      isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-red-500"
                    )} />
                    <p className="text-[10px] text-zinc-500 truncate">
                      {isConnected ? "Connected" : "Offline"}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Settings / User */}
            <div className="flex items-center justify-between px-1">
               <button className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors">
                  <SettingsIcon className="size-4" />
               </button>
               <div className="text-[10px] text-zinc-600 font-mono">v0.1.0</div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-zinc-950">
          {/* Top Header */}
          <header className="h-16 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-zinc-100">
                {activeTab === 'chat' && 'AI Builder'}
                {activeTab === 'projects' && 'Project Manager'}
                {activeTab === 'files' && 'File Explorer'}
                {activeTab === 'mcp' && 'MCP Servers'}
                {activeTab === 'activity' && 'System Activity'}
              </h2>
            </div>

            <div className="flex items-center gap-4">
              {/* Model Count Badge */}
              {isConnected && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-400">
                  <SparklesIcon className="size-3.5 text-blue-400" />
                  <span>{totalModels} models available</span>
                </div>
              )}

              {/* Context Usage */}
              {isConnected && (() => {
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
                    <ContextTrigger className="h-8 px-3 rounded-md border border-zinc-700/50 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 text-xs" />
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

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6">
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

            <div className="mx-auto w-full max-w-5xl">
              
              {/* CHAT TAB */}
              {activeTab === "chat" && (
                <div className="flex flex-col items-center">
                  <div className="mb-10 text-center space-y-2">
                    <h2 className="font-bold text-4xl text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                      What will you build today?
                    </h2>
                    <p className="text-zinc-500">
                      Describe your app idea and let klinkr handle the rest.
                    </p>
                  </div>
                  
                  {/* Selected Model Display */}
                  {selectedModel && (
                    <div className="mb-8 flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-500">
                      <span>Running on</span>
                      <span className="font-semibold text-zinc-300">{selectedModel.id}</span>
                    </div>
                  )}

                  <div className="w-full max-w-3xl">
                    {/* Chat Messages */}
                    {messages.length > 0 && (
                      <div className="mb-6 space-y-6">
                        {messages.map((msg) => (
                          <div key={msg.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {msg.role === "user" ? (
                              <div className="flex justify-end">
                                <div className="max-w-[80%] rounded-2xl bg-blue-600 p-4 text-white shadow-lg shadow-blue-900/20">
                                  {msg.content}
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-4">
                                <div className="shrink-0 size-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-900/20">
                                  <Bot className="size-4 text-white" />
                                </div>
                                <div className="flex-1 rounded-2xl bg-zinc-900 border border-zinc-800 p-6 text-zinc-300 shadow-sm">
                                  {msg.content ? (
                                    <div className="prose prose-invert prose-sm max-w-none">
                                      {msg.content}
                                      {isBuilderStreaming && msg.id === messages[messages.length - 1]?.id && (
                                        <span className="inline-block w-1.5 h-4 ml-1 bg-blue-500 animate-pulse" />
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 text-zinc-500">
                                      <div className="flex gap-1">
                                        <span className="size-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.3s]" />
                                        <span className="size-1.5 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.15s]" />
                                        <span className="size-1.5 rounded-full bg-zinc-500 animate-bounce" />
                                      </div>
                                      <span className="text-xs font-medium">Thinking...</span>
                                    </div>
                                  )}
                                </div>
                              </div>
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
                            className="gap-2 h-8 text-xs"
                          >
                            <StopCircleIcon className="size-3.5" />
                            Stop Generation
                          </Button>
                        )}
                        <Button
                          onClick={clearMessages}
                          size="sm"
                          variant="outline"
                          className="gap-2 h-8 text-xs bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
                          disabled={isStreaming}
                        >
                          <TrashIcon className="size-3.5" />
                          Clear Chat
                        </Button>
                      </div>
                    )}

                    <PromptInputProvider>
                      <PromptInput 
                        globalDrop 
                        multiple 
                        onSubmit={handleSubmit}
                        className="mb-6 shadow-2xl shadow-black/50 rounded-xl border border-zinc-800 bg-zinc-900/80 backdrop-blur-xl"
                      >
                        <PromptInputAttachments>
                          {(attachment: any) => <PromptInputAttachment data={attachment} />}
                        </PromptInputAttachments>
                        <PromptInputBody>
                          <PromptInputTextarea 
                            ref={textareaRef}
                            placeholder="Describe the app you want to build..."
                            className="min-h-[120px] text-base px-4 py-3"
                          />
                        </PromptInputBody>
                        <PromptInputFooter className="px-4 pb-3 pt-2">
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
                                  className="w-auto justify-start h-8 px-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50"
                                  size="sm"
                                >
                                  {loading ? (
                                    <RefreshCwIcon className="size-3.5 animate-spin" />
                                  ) : selectedModel ? (
                                    <>
                                      <ModelSelectorLogo
                                        provider={selectedModel.vendor}
                                      />
                                      <ModelSelectorName className="flex-1 text-left text-xs">
                                        {selectedModel.id}
                                      </ModelSelectorName>
                                      <ChevronDown className="ml-2 size-3.5 text-muted-foreground" />
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-xs">Select Model</span>
                                      <ChevronDown className="ml-2 size-3.5 text-muted-foreground" />
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
                            className="bg-blue-600 hover:bg-blue-500 text-white"
                          />
                        </PromptInputFooter>
                      </PromptInput>

                      {/* Quick Templates */}
                      <div className="mt-12 text-center">
                        <p className="mb-4 text-zinc-500 text-xs uppercase tracking-wider font-medium">
                          Start from a template
                        </p>
                        <div className="flex flex-wrap justify-center gap-3">
                          {['Next.js', 'React (Vite)', 'Vue', 'Svelte', 'Angular', 'Vanilla JS'].map((tech) => (
                            <Button 
                              key={tech}
                              variant="outline" 
                              size="sm"
                              className="bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all"
                            >
                              {tech} app
                            </Button>
                          ))}
                        </div>
                      </div>
                    </PromptInputProvider>
                  </div>
                </div>
              )}

              {/* PROJECTS TAB */}
              {activeTab === "projects" && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="mb-8">
                    <h2 className="font-bold text-2xl text-zinc-100">Next.js Projects</h2>
                    <p className="text-zinc-500">Manage and deploy your local applications</p>
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
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="mb-8">
                    <h2 className="font-bold text-2xl text-zinc-100">File Explorer</h2>
                    <p className="text-zinc-500">Browse and manage your workspace files</p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden shadow-sm">
                    <div className="p-6">
                      {Object.keys(fileTree).length > 0 ? (
                        <FileTree fileTree={fileTree} rootPath={workspacePath} />
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                          <FolderIcon className="size-12 mb-4 opacity-20" />
                          <p className="text-sm">
                            {isConnected ? 'Loading workspace...' : 'Not connected to VS Code'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* MCP TAB */}
              {activeTab === "mcp" && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="mb-8">
                    <h2 className="font-bold text-2xl text-zinc-100">MCP Servers</h2>
                    <p className="text-zinc-500">Manage Model Context Protocol connections</p>
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
                <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="mb-8">
                    <h2 className="font-bold text-2xl text-zinc-100">Activity Feed</h2>
                    <p className="text-zinc-500">Real-time tracking of system events</p>
                  </div>
                  <div className="flex-1 border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/50 shadow-sm">
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
    </ToastProvider>
  );
};

export default Example;
