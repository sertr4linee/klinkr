"use client";

import { Button } from "@/components/ui/button";
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
} from "lucide-react";

export interface NextJsProject {
  path: string;
  name: string;
  packageJsonPath: string;
  hasNextConfig: boolean;
  port: number;
  status: "stopped" | "starting" | "running" | "error";
  error?: string;
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
}

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
}: NextJsProjectManagerProps) {
  const getStatusIcon = (status: NextJsProject["status"]) => {
    switch (status) {
      case "running":
        return <CheckCircle2Icon className="size-4 text-green-500" />;
      case "starting":
        return <Loader2Icon className="size-4 text-yellow-500 animate-spin" />;
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
      case "error":
        return "Error";
      default:
        return "Stopped";
    }
  };

  return (
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
          {projects.map((project) => (
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
                    <h3 className="font-semibold text-zinc-100">{project.name}</h3>
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
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => onStartProject(project.path)}
                        className="gap-2 bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white border-0 shadow-lg shadow-green-900/30 transition-all"
                      >
                        <PlayIcon className="size-4" />
                        Start Dev
                      </Button>
                    ) : project.status === "starting" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="gap-2 border-zinc-700 bg-zinc-800/50"
                      >
                        <Loader2Icon className="size-4 animate-spin" />
                        Starting...
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => onStopProject(project.path)}
                          className="gap-2 bg-linear-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 border-0 shadow-lg shadow-red-900/30 transition-all"
                        >
                          <StopCircleIcon className="size-4" />
                          Stop
                        </Button>
                        {onSetupDOMBridge && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onSetupDOMBridge(project.path)}
                            className="gap-2 text-xs border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all"
                          >
                            🔧 Setup DOM
                          </Button>
                        )}
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => onOpenPreview(project.path, project.port)}
                          className="gap-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white border-0 shadow-lg shadow-blue-900/30 transition-all"
                        >
                          <ExternalLinkIcon className="size-4" />
                          Preview
                        </Button>
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
          ))}
        </div>
      )}
    </div>
  );
}
