"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  PlayIcon,
  StopCircleIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  FolderIcon,
  CheckCircle2Icon,
  XCircleIcon,
  Loader2Icon,
  RocketIcon,
  SparklesIcon,
  TerminalIcon,
  CheckIcon,
  ArrowRightIcon,
  LockIcon,
} from "lucide-react";

export interface NextJsProject {
  path: string;
  name: string;
  packageJsonPath: string;
  hasNextConfig: boolean;
  port: number;
  status: "stopped" | "starting" | "installing" | "running" | "error";
  error?: string;
  domBridgeSetup?: boolean;
}

interface SetupLog {
  id: string;
  type: "info" | "success" | "error" | "warning" | "command";
  message: string;
  timestamp: Date;
}

interface NextJsProjectManagerProps {
  projects: NextJsProject[];
  onStartProject: (projectPath: string) => void;
  onStopProject: (projectPath: string) => void;
  onOpenPreview: (projectPath: string, port: number) => void;
  onRefreshProjects: () => void;
  onSetupDOMBridge?: (projectPath: string) => void;
  sendToCopilot?: (prompt: string) => void;
  isLoading?: boolean;
  className?: string;
  // DOM Bridge setup logs from WebSocket
  domBridgeLogs?: SetupLog[];
  isDOMBridgeSetupInProgress?: boolean;
  domBridgeSetupComplete?: boolean;
  domBridgeSetupError?: string | null;
}

// Steps for the Get Started flow
const SETUP_STEPS = [
  {
    id: "start",
    title: "Start Dev Server",
    description: "Launch the Next.js development server",
    icon: PlayIcon,
  },
  {
    id: "dom",
    title: "Setup DOM Bridge",
    description: "Install the visual editing capabilities",
    icon: SparklesIcon,
  },
  {
    id: "ready",
    title: "Ready to Edit",
    description: "Open the live preview and start building",
    icon: RocketIcon,
  },
];

export function NextJsProjectManager({
  projects,
  onStartProject,
  onStopProject,
  onOpenPreview,
  onRefreshProjects,
  onSetupDOMBridge,
  sendToCopilot,
  isLoading = false,
  className,
  domBridgeLogs = [],
  isDOMBridgeSetupInProgress = false,
  domBridgeSetupComplete = false,
  domBridgeSetupError = null,
}: NextJsProjectManagerProps) {
  // Track which projects have DOM bridge set up (persisted in localStorage + server detection)
  const [setupProjects, setSetupProjects] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("domBridgeSetupProjects");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    }
    return new Set();
  });

  // Sync localStorage with server-detected DOM bridge setup
  useEffect(() => {
    const serverSetupProjects = projects
      .filter(p => p.domBridgeSetup)
      .map(p => p.path);

    if (serverSetupProjects.length > 0) {
      setSetupProjects(prev => {
        const newSet = new Set(prev);
        serverSetupProjects.forEach(path => newSet.add(path));
        return newSet;
      });
    }
  }, [projects]);

  // Sheet state - store path instead of object to always get fresh data
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [localLogs, setLocalLogs] = useState<SetupLog[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const lastLoggedStatusRef = useRef<string | null>(null);

  // Get the current project from the array (always fresh)
  const selectedProject = selectedProjectPath
    ? projects.find(p => p.path === selectedProjectPath) ?? null
    : null;

  // Persist setup state
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("domBridgeSetupProjects", JSON.stringify([...setupProjects]));
    }
  }, [setupProjects]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localLogs, domBridgeLogs]);

  // Update step based on project status and setup state
  useEffect(() => {
    if (!selectedProject || !sheetOpen) return;

    const isSetup = setupProjects.has(selectedProject.path);
    const statusKey = `${selectedProject.path}:${selectedProject.status}`;

    if (selectedProject.status === "stopped" || selectedProject.status === "error") {
      setCurrentStep(0);
      lastLoggedStatusRef.current = null;
    } else if (selectedProject.status === "starting" || selectedProject.status === "installing") {
      // Keep on step 0 but show loading state
      setCurrentStep(0);
    } else if (selectedProject.status === "running" && !isSetup) {
      setCurrentStep(1);
      // Only log once per status change
      if (lastLoggedStatusRef.current !== statusKey) {
        lastLoggedStatusRef.current = statusKey;
        setLocalLogs(prev => [...prev, {
          id: `${Date.now()}-${Math.random()}`,
          type: "success",
          message: `Server running on port ${selectedProject.port}`,
          timestamp: new Date(),
        }]);
      }
    } else if (selectedProject.status === "running" && isSetup) {
      setCurrentStep(2);
    }
  }, [selectedProject?.status, selectedProject?.path, selectedProject?.port, setupProjects, sheetOpen]);

  // Handle DOM bridge setup completion
  useEffect(() => {
    if (domBridgeSetupComplete && selectedProjectPath) {
      setSetupProjects(prev => new Set([...prev, selectedProjectPath]));
      addLocalLog("success", "DOM Bridge installed successfully!");
      setCurrentStep(2);
    }
  }, [domBridgeSetupComplete, selectedProjectPath]);

  // Handle DOM bridge setup error
  useEffect(() => {
    if (domBridgeSetupError) {
      addLocalLog("error", `Setup failed: ${domBridgeSetupError}`);
    }
  }, [domBridgeSetupError]);

  const addLocalLog = useCallback((type: SetupLog["type"], message: string) => {
    setLocalLogs(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      type,
      message,
      timestamp: new Date(),
    }]);
  }, []);

  const handleOpenGetStarted = (project: NextJsProject) => {
    setSelectedProjectPath(project.path);
    setLocalLogs([]);
    setSheetOpen(true);

    // Determine initial step
    const isSetup = setupProjects.has(project.path);
    if (project.status === "running" && isSetup) {
      setCurrentStep(2);
    } else if (project.status === "running") {
      setCurrentStep(1);
    } else {
      setCurrentStep(0);
    }
  };

  const handleStartServer = () => {
    if (!selectedProject) return;
    addLocalLog("info", `Starting ${selectedProject.name} dev server...`);
    addLocalLog("command", `$ npm run dev --port ${selectedProject.port}`);
    onStartProject(selectedProject.path);
  };

  const handleSetupDOMBridge = () => {
    if (!selectedProject || !onSetupDOMBridge) return;
    addLocalLog("info", "Installing DOM Bridge for visual editing...");
    addLocalLog("command", "$ Installing @klinkr/dom-bridge...");
    onSetupDOMBridge(selectedProject.path);
  };

  const handleOpenPreviewFromSheet = () => {
    if (!selectedProject) return;
    setSheetOpen(false);
    onOpenPreview(selectedProject.path, selectedProject.port);
  };

  const getStatusIcon = (status: NextJsProject["status"]) => {
    switch (status) {
      case "running":
        return <CheckCircle2Icon className="size-4 text-green-500" />;
      case "starting":
        return <Loader2Icon className="size-4 text-yellow-500 animate-spin" />;
      case "installing":
        return <Loader2Icon className="size-4 text-blue-500 animate-spin" />;
      case "error":
        return <XCircleIcon className="size-4 text-red-500" />;
      default:
        return <StopCircleIcon className="size-4 text-zinc-500" />;
    }
  };

  const getStatusText = (status: NextJsProject["status"]) => {
    switch (status) {
      case "running":
        return "Running";
      case "starting":
        return "Starting...";
      case "installing":
        return "Installing dependencies...";
      case "error":
        return "Error";
      default:
        return "Stopped";
    }
  };

  const isProjectReady = (project: NextJsProject) => {
    return project.status === "running" && setupProjects.has(project.path);
  };

  // Combine local logs with WebSocket logs
  const allLogs = [...localLogs, ...domBridgeLogs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <>
      <div
        className={cn(
          "rounded-xl border border-zinc-800 bg-zinc-950 p-6",
          className
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-xl text-zinc-100 flex items-center gap-2">
              <svg
                className="size-6"
                viewBox="0 0 180 180"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <mask
                  id="mask0_408_139"
                  style={{ maskType: "alpha" }}
                  maskUnits="userSpaceOnUse"
                  x="0"
                  y="0"
                  width="180"
                  height="180"
                >
                  <circle cx="90" cy="90" r="90" fill="black" />
                </mask>
                <g mask="url(#mask0_408_139)">
                  <circle cx="90" cy="90" r="90" fill="black" />
                  <path
                    d="M149.508 157.52L69.142 54H54V125.97H66.1136V69.3836L139.999 164.845C143.333 162.614 146.509 160.165 149.508 157.52Z"
                    fill="url(#paint0_linear_408_139)"
                  />
                  <rect
                    x="115"
                    y="54"
                    width="12"
                    height="72"
                    fill="url(#paint1_linear_408_139)"
                  />
                </g>
                <defs>
                  <linearGradient
                    id="paint0_linear_408_139"
                    x1="109"
                    y1="116.5"
                    x2="144.5"
                    y2="160.5"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="white" />
                    <stop offset="1" stopColor="white" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient
                    id="paint1_linear_408_139"
                    x1="121"
                    y1="54"
                    x2="120.799"
                    y2="106.875"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="white" />
                    <stop offset="1" stopColor="white" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
              Next.js Projects
            </h2>
            <p className="text-sm text-zinc-500">
              Detected Next.js projects in your workspace
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshProjects}
            disabled={isLoading}
            className="gap-2 border-zinc-700 hover:bg-zinc-800"
          >
            <RefreshCwIcon
              className={cn("size-4", isLoading && "animate-spin")}
            />
            Refresh
          </Button>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-8 text-center">
            <FolderIcon className="mx-auto size-12 text-zinc-600 mb-3" />
            <p className="text-zinc-300 font-medium">No Next.js projects found</p>
            <p className="text-zinc-500 text-sm mt-1">
              Add a Next.js project to your workspace to get started
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const isReady = isProjectReady(project);
              const isSetup = setupProjects.has(project.path);

              return (
                <div
                  key={project.path}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-zinc-800">
                        <svg
                          className="size-5"
                          viewBox="0 0 180 180"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle cx="90" cy="90" r="90" fill="white" />
                          <path
                            d="M149.508 157.52L69.142 54H54V125.97H66.1136V69.3836L139.999 164.845C143.333 162.614 146.509 160.165 149.508 157.52Z"
                            fill="black"
                          />
                          <rect x="115" y="54" width="12" height="72" fill="black" />
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-zinc-100">{project.name}</h3>
                          {isSetup && (
                            <span className="flex items-center gap-1 text-xs text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                              <CheckIcon className="size-3" />
                              Ready
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 font-mono">
                          {project.path}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Status Badge */}
                      <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1">
                        {getStatusIcon(project.status)}
                        <span className="text-sm text-zinc-300">
                          {getStatusText(project.status)}
                        </span>
                        {project.status === "running" && (
                          <span className="text-xs text-zinc-500">
                            :{project.port}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {project.status === "stopped" || project.status === "error" ? (
                          // Project is stopped - show either "Get Started" or "Start Dev" based on setup state
                          isSetup ? (
                            <Button
                              onClick={() => onStartProject(project.path)}
                              className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white border-0 shadow-lg shadow-green-900/30"
                            >
                              <PlayIcon className="size-4" />
                              Start Dev
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleOpenGetStarted(project)}
                              className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-purple-900/30"
                            >
                              <RocketIcon className="size-4" />
                              Get Started
                            </Button>
                          )
                        ) : project.status === "starting" || project.status === "installing" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled
                            className="gap-2 border-zinc-700 bg-zinc-800/50"
                          >
                            <Loader2Icon className="size-4 animate-spin" />
                            {project.status === "installing" ? "Installing..." : "Starting..."}
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => onStopProject(project.path)}
                              className="gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 border-0 shadow-lg shadow-red-900/30"
                            >
                              <StopCircleIcon className="size-4" />
                              Stop
                            </Button>

                            {/* Preview Button - locked if not setup */}
                            {isReady ? (
                              <Button
                                size="sm"
                                onClick={() => onOpenPreview(project.path, project.port)}
                                className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-0 shadow-lg shadow-blue-900/30"
                              >
                                <ExternalLinkIcon className="size-4" />
                                Preview
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleOpenGetStarted(project)}
                                variant="outline"
                                className="gap-2 border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
                              >
                                <LockIcon className="size-4" />
                                Setup Required
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Error message */}
                  {project.error && (
                    <div className="mt-3 rounded-md border border-red-900/50 bg-red-950/20 p-3 text-sm text-red-300">
                      {project.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Get Started Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <RocketIcon className="size-5 text-blue-500" />
              Get Started with {selectedProject?.name}
            </SheetTitle>
            <SheetDescription>
              Follow these steps to enable visual editing
            </SheetDescription>
          </SheetHeader>

          {/* Steps Progress */}
          <div className="mt-6 mb-4">
            <div className="flex items-center justify-between relative">
              {/* Progress Line */}
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-zinc-800">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${(currentStep / (SETUP_STEPS.length - 1)) * 100}%` }}
                />
              </div>

              {SETUP_STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const isComplete = index < currentStep;
                const isCurrent = index === currentStep;

                return (
                  <div key={step.id} className="relative z-10 flex flex-col items-center">
                    <div className={cn(
                      "size-10 rounded-full flex items-center justify-center transition-all duration-300",
                      isComplete && "bg-green-500 text-white",
                      isCurrent && "bg-gradient-to-r from-blue-500 to-purple-500 text-white ring-4 ring-blue-500/20",
                      !isComplete && !isCurrent && "bg-zinc-800 text-zinc-500"
                    )}>
                      {isComplete ? (
                        <CheckIcon className="size-5" />
                      ) : (
                        <StepIcon className="size-5" />
                      )}
                    </div>
                    <span className={cn(
                      "mt-2 text-xs font-medium",
                      isCurrent ? "text-zinc-100" : "text-zinc-500"
                    )}>
                      {step.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current Step Content */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Step 0: Start Server */}
            {currentStep === 0 && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
                  <h4 className="font-medium text-zinc-100 mb-2">Start the Development Server</h4>
                  <p className="text-sm text-zinc-400 mb-4">
                    Launch the Next.js dev server to preview your application.
                  </p>
                  <Button
                    onClick={handleStartServer}
                    disabled={selectedProject?.status === "starting"}
                    className="w-full gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
                  >
                    {selectedProject?.status === "starting" ? (
                      <>
                        <Loader2Icon className="size-4 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <PlayIcon className="size-4" />
                        Start Dev Server
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 1: Setup DOM Bridge */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
                  <h4 className="font-medium text-zinc-100 mb-2">Install DOM Bridge</h4>
                  <p className="text-sm text-zinc-400 mb-4">
                    The DOM Bridge enables visual editing capabilities, allowing you to select and modify elements directly in the preview.
                  </p>
                  <Button
                    onClick={handleSetupDOMBridge}
                    disabled={isDOMBridgeSetupInProgress}
                    className="w-full gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
                  >
                    {isDOMBridgeSetupInProgress ? (
                      <>
                        <Loader2Icon className="size-4 animate-spin" />
                        Installing...
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="size-4" />
                        Setup DOM Bridge
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Ready */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="size-10 rounded-full bg-green-500 flex items-center justify-center">
                      <CheckIcon className="size-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-medium text-zinc-100">All Set!</h4>
                      <p className="text-sm text-zinc-400">Your project is ready for visual editing</p>
                    </div>
                  </div>
                  <Button
                    onClick={handleOpenPreviewFromSheet}
                    className="w-full gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500"
                  >
                    <ExternalLinkIcon className="size-4" />
                    Open Preview
                    <ArrowRightIcon className="size-4 ml-auto" />
                  </Button>
                </div>
              </div>
            )}

            {/* Logs Section */}
            {allLogs.length > 0 && (
              <div className="mt-4 flex-1 flex flex-col min-h-0">
                <div className="flex items-center gap-2 mb-2">
                  <TerminalIcon className="size-4 text-zinc-500" />
                  <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Setup Logs</span>
                </div>
                <ScrollArea className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950">
                  <div className="p-3 font-mono text-xs space-y-1">
                    {allLogs.map((log) => (
                      <div
                        key={log.id}
                        className={cn(
                          "flex items-start gap-2 py-0.5",
                          log.type === "error" && "text-red-400",
                          log.type === "success" && "text-green-400",
                          log.type === "warning" && "text-yellow-400",
                          log.type === "command" && "text-blue-400",
                          log.type === "info" && "text-zinc-400"
                        )}
                      >
                        <span className="text-zinc-600 shrink-0">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                        <span>{log.message}</span>
                      </div>
                    ))}
                    {isDOMBridgeSetupInProgress && (
                      <div className="flex items-center gap-2 text-zinc-500 py-0.5">
                        <Loader2Icon className="size-3 animate-spin" />
                        <span>Processing...</span>
                      </div>
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
