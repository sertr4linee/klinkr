"use client";

import { useEffect, useState } from "react";
import { CheckCircle2Icon, RefreshCwIcon, XCircleIcon } from "lucide-react";

type DetectedProject = {
  type: string;
  name: string;
  version?: string;
  description: string;
  files: string[];
  path: string;
};

export const ProjectDetector = () => {
  const [projects, setProjects] = useState<DetectedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/detect-projects");
        if (!response.ok) {
          throw new Error(`Failed to detect projects: ${response.status}`);
        }
        const data = await response.json();
        if (data.success) {
          setProjects(data.projects || []);
          setError(null);
        } else {
          throw new Error(data.error || "Failed to detect projects");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        console.error("Error detecting projects:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchProjects, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCwIcon className="size-8 animate-spin text-zinc-400" />
          <p className="text-sm text-zinc-400">Detecting projects...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <XCircleIcon className="size-8 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center">
          <p className="text-zinc-400">
            No apps detected yet. Wuunu will list apps here once it recognises a
            project in your workspace.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      {projects.map((project, index) => (
        <div
          key={index}
          className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 transition-colors hover:bg-zinc-900"
        >
          <div className="mb-2 flex items-start justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2Icon className="size-5 text-green-500" />
              <h3 className="font-semibold text-zinc-100">{project.type}</h3>
            </div>
            <div className="flex items-center gap-2">
              {project.path && (
                <span className="rounded bg-blue-900/30 px-2 py-1 font-mono text-xs text-blue-300">
                  {project.path}
                </span>
              )}
              {project.version && (
                <span className="rounded bg-zinc-800 px-2 py-1 font-mono text-xs text-zinc-300">
                  {project.version}
                </span>
              )}
            </div>
          </div>
          <p className="mb-3 text-sm text-zinc-400">{project.description}</p>
          <div className="flex flex-wrap gap-2">
            {project.files.map((file, idx) => (
              <span
                key={idx}
                className="rounded bg-zinc-800/70 px-2 py-1 font-mono text-xs text-zinc-400"
              >
                {file}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
