"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckIcon,
  ChevronRight,
  ChevronLeft,
  FolderPlus,
  Loader2,
  Sparkles,
  Code2,
  Database,
  Palette,
  Shield,
  Zap,
  Package,
  Terminal,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FolderOpen,
  Rocket,
} from "lucide-react";

// Types
interface ProjectConfig {
  name: string;
  framework: string;
  features: string[];
  styling: string;
  database: string | null;
  auth: string | null;
  packageManager: string;
}

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface LogEntry {
  id: string;
  type: "info" | "success" | "error" | "warning" | "command";
  message: string;
  timestamp: Date;
}

interface ProjectCreationWizardProps {
  projects: any[];
  isDetecting: boolean;
  onCreateProject: (config: ProjectConfig) => void;
  onRefreshProjects: () => void;
  workspacePath?: string;
  // WebSocket-driven state (optional for backwards compatibility)
  wsLogs?: LogEntry[];
  wsIsCreating?: boolean;
  wsCreationComplete?: boolean;
  wsCreationError?: string | null;
  wsResetCreation?: () => void;
}

// Framework options
const FRAMEWORKS = [
  { id: "nextjs", name: "Next.js", icon: "▲", description: "React framework with SSR & API routes", color: "bg-black" },
  { id: "vite-react", name: "React (Vite)", icon: "⚡", description: "Lightning fast React with Vite", color: "bg-cyan-500" },
  { id: "vite-vue", name: "Vue (Vite)", icon: "🟢", description: "Progressive JavaScript framework", color: "bg-emerald-500" },
  { id: "vite-svelte", name: "Svelte (Vite)", icon: "🔥", description: "Cybernetically enhanced web apps", color: "bg-orange-500" },
  { id: "astro", name: "Astro", icon: "🚀", description: "Content-focused static sites", color: "bg-purple-500" },
  { id: "remix", name: "Remix", icon: "💿", description: "Full stack React framework", color: "bg-blue-600" },
];

// Feature options
const FEATURES = [
  { id: "typescript", name: "TypeScript", icon: <Code2 className="size-4" />, description: "Type-safe JavaScript" },
  { id: "tailwind", name: "Tailwind CSS", icon: <Palette className="size-4" />, description: "Utility-first CSS" },
  { id: "eslint", name: "ESLint", icon: <Shield className="size-4" />, description: "Code linting" },
  { id: "prettier", name: "Prettier", icon: <Sparkles className="size-4" />, description: "Code formatting" },
];

// Styling options
const STYLING_OPTIONS = [
  { id: "tailwind", name: "Tailwind CSS", description: "Utility-first CSS framework" },
  { id: "css-modules", name: "CSS Modules", description: "Scoped CSS for components" },
  { id: "styled-components", name: "Styled Components", description: "CSS-in-JS solution" },
  { id: "sass", name: "Sass/SCSS", description: "CSS preprocessor" },
  { id: "none", name: "Plain CSS", description: "No additional styling framework" },
];

// Database options
const DATABASE_OPTIONS = [
  { id: "none", name: "No Database", description: "Skip database setup" },
  { id: "prisma-postgres", name: "Prisma + PostgreSQL", description: "Type-safe ORM with PostgreSQL" },
  { id: "prisma-sqlite", name: "Prisma + SQLite", description: "Local SQLite database" },
  { id: "drizzle-postgres", name: "Drizzle + PostgreSQL", description: "Lightweight TypeScript ORM" },
  { id: "mongoose", name: "Mongoose + MongoDB", description: "MongoDB object modeling" },
  { id: "supabase", name: "Supabase", description: "Open source Firebase alternative" },
];

// Auth options
const AUTH_OPTIONS = [
  { id: "none", name: "No Auth", description: "Skip authentication" },
  { id: "nextauth", name: "NextAuth.js", description: "Authentication for Next.js" },
  { id: "clerk", name: "Clerk", description: "Complete user management" },
  { id: "lucia", name: "Lucia", description: "Simple auth library" },
  { id: "supabase-auth", name: "Supabase Auth", description: "Built-in auth with Supabase" },
];

// Package manager options
const PACKAGE_MANAGERS = [
  { id: "bun", name: "bun", description: "Fast all-in-one toolkit" },
  { id: "pnpm", name: "pnpm", description: "Fast, disk space efficient" },
  { id: "npm", name: "npm", description: "Node package manager" },
  { id: "yarn", name: "yarn", description: "Fast, reliable, secure" },
];

const WIZARD_STEPS: WizardStep[] = [
  { id: "name", title: "Project Name", description: "Choose a name for your project", icon: <FolderPlus className="size-5" /> },
  { id: "framework", title: "Framework", description: "Select your preferred framework", icon: <Zap className="size-5" /> },
  { id: "features", title: "Features", description: "Pick additional features", icon: <Package className="size-5" /> },
  { id: "styling", title: "Styling", description: "Choose a styling solution", icon: <Palette className="size-5" /> },
  { id: "database", title: "Database", description: "Set up your database", icon: <Database className="size-5" /> },
  { id: "auth", title: "Authentication", description: "Add user authentication", icon: <Shield className="size-5" /> },
  { id: "package-manager", title: "Package Manager", description: "Select package manager", icon: <Terminal className="size-5" /> },
  { id: "review", title: "Review", description: "Review and create", icon: <Rocket className="size-5" /> },
];

export function ProjectCreationWizard({
  projects,
  isDetecting,
  onCreateProject,
  onRefreshProjects,
  workspacePath,
  wsLogs,
  wsIsCreating,
  wsCreationComplete,
  wsCreationError,
  wsResetCreation,
}: ProjectCreationWizardProps) {
  const [showWizard, setShowWizard] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Use WebSocket state if available, otherwise use local state (for backwards compatibility)
  const useWebSocket = wsLogs !== undefined;
  const [localLogs, setLocalLogs] = useState<LogEntry[]>([]);
  const [localIsCreating, setLocalIsCreating] = useState(false);
  const [localCreationComplete, setLocalCreationComplete] = useState(false);
  const [localCreationError, setLocalCreationError] = useState<string | null>(null);

  // Resolved state (prefer WebSocket)
  const logs = useWebSocket ? wsLogs : localLogs;
  const isCreating = useWebSocket ? (wsIsCreating ?? false) : localIsCreating;
  const creationComplete = useWebSocket ? (wsCreationComplete ?? false) : localCreationComplete;
  const creationError = useWebSocket ? (wsCreationError ?? null) : localCreationError;

  // Project configuration state
  const [config, setConfig] = useState<ProjectConfig>({
    name: "",
    framework: "",
    features: ["typescript", "tailwind"],
    styling: "tailwind",
    database: null,
    auth: null,
    packageManager: "bun",
  });

  // Validation
  const isStepValid = useCallback(() => {
    switch (WIZARD_STEPS[currentStep].id) {
      case "name":
        return config.name.length >= 2 && /^[a-z0-9-]+$/.test(config.name);
      case "framework":
        return config.framework !== "";
      case "features":
        return true; // Optional
      case "styling":
        return config.styling !== "";
      case "database":
        return true; // Optional
      case "auth":
        return true; // Optional
      case "package-manager":
        return config.packageManager !== "";
      case "review":
        return true;
      default:
        return true;
    }
  }, [currentStep, config]);

  // Add log entry (only used for local simulation mode)
  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    setLocalLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        type,
        message,
        timestamp: new Date(),
      },
    ]);
  }, []);

  // Create project - uses WebSocket when available, otherwise simulates
  const handleCreateProject = async () => {
    if (useWebSocket) {
      // Use real WebSocket-based creation
      onCreateProject(config);
      return;
    }

    // Fallback: simulate project creation with logs (for demo/testing)
    setLocalIsCreating(true);
    setLocalLogs([]);
    setLocalCreationError(null);

    try {
      addLog("info", `Creating project "${config.name}"...`);
      await sleep(500);

      addLog("command", `$ mkdir ${config.name} && cd ${config.name}`);
      await sleep(300);

      const framework = FRAMEWORKS.find((f) => f.id === config.framework);
      addLog("info", `Setting up ${framework?.name} project...`);
      await sleep(400);

      // Simulate package manager commands
      const pmCmd = config.packageManager === "bun" ? "bunx" : config.packageManager === "pnpm" ? "pnpm dlx" : "npx";

      if (config.framework === "nextjs") {
        addLog("command", `$ ${pmCmd} create-next-app@latest ${config.name} --typescript --tailwind --eslint`);
      } else if (config.framework.startsWith("vite")) {
        const template = config.framework.replace("vite-", "");
        addLog("command", `$ ${pmCmd} create-vite ${config.name} --template ${template}-ts`);
      }
      await sleep(1000);

      addLog("success", "Project scaffolded successfully!");
      await sleep(300);

      // Install features
      if (config.features.includes("tailwind") && !config.framework.includes("next")) {
        addLog("info", "Installing Tailwind CSS...");
        addLog("command", `$ ${config.packageManager} add -D tailwindcss postcss autoprefixer`);
        await sleep(600);
        addLog("success", "Tailwind CSS configured!");
      }

      if (config.features.includes("prettier")) {
        addLog("info", "Setting up Prettier...");
        addLog("command", `$ ${config.packageManager} add -D prettier`);
        await sleep(400);
        addLog("success", "Prettier configured!");
      }

      // Database setup
      if (config.database && config.database !== "none") {
        const db = DATABASE_OPTIONS.find((d) => d.id === config.database);
        addLog("info", `Setting up ${db?.name}...`);
        await sleep(500);

        if (config.database.includes("prisma")) {
          addLog("command", `$ ${config.packageManager} add prisma @prisma/client`);
          await sleep(400);
          addLog("command", `$ ${pmCmd} prisma init`);
          await sleep(300);
        } else if (config.database === "drizzle-postgres") {
          addLog("command", `$ ${config.packageManager} add drizzle-orm pg`);
          await sleep(400);
        }

        addLog("success", `${db?.name} configured!`);
      }

      // Auth setup
      if (config.auth && config.auth !== "none") {
        const auth = AUTH_OPTIONS.find((a) => a.id === config.auth);
        addLog("info", `Setting up ${auth?.name}...`);
        await sleep(500);
        addLog("success", `${auth?.name} configured!`);
      }

      await sleep(300);
      addLog("success", "🎉 Project created successfully!");
      addLog("info", `Run: cd ${config.name} && ${config.packageManager} run dev`);

      setLocalCreationComplete(true);
      onCreateProject(config);
    } catch (error) {
      addLog("error", `Error: ${error}`);
      setLocalCreationError(String(error));
    } finally {
      setLocalIsCreating(false);
    }
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const nextStep = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const resetWizard = () => {
    setShowWizard(false);
    setCurrentStep(0);

    // Reset state based on mode
    if (useWebSocket && wsResetCreation) {
      wsResetCreation();
    } else {
      setLocalIsCreating(false);
      setLocalLogs([]);
      setLocalCreationComplete(false);
      setLocalCreationError(null);
    }

    setConfig({
      name: "",
      framework: "",
      features: ["typescript", "tailwind"],
      styling: "tailwind",
      database: null,
      auth: null,
      packageManager: "bun",
    });
    onRefreshProjects();
  };

  // Render step content
  const renderStepContent = () => {
    const step = WIZARD_STEPS[currentStep];

    switch (step.id) {
      case "name":
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-2 block">Project Name</label>
              <Input
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                placeholder="my-awesome-app"
                className="bg-zinc-900 border-zinc-700 text-zinc-100 h-12 text-lg"
                autoFocus
              />
              <p className="text-xs text-zinc-500 mt-2">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>
            {workspacePath && (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <FolderOpen className="size-4" />
                <span>Will be created in: {workspacePath}/{config.name || "..."}</span>
              </div>
            )}
          </div>
        );

      case "framework":
        return (
          <div className="grid grid-cols-2 gap-3">
            {FRAMEWORKS.map((fw) => (
              <button
                key={fw.id}
                onClick={() => setConfig({ ...config, framework: fw.id })}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                  config.framework === fw.id
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                )}
              >
                <div className={cn("size-10 rounded-lg flex items-center justify-center text-xl", fw.color)}>
                  {fw.icon}
                </div>
                <div>
                  <div className="font-medium text-zinc-100">{fw.name}</div>
                  <div className="text-xs text-zinc-500">{fw.description}</div>
                </div>
                {config.framework === fw.id && (
                  <CheckIcon className="ml-auto size-5 text-blue-500" />
                )}
              </button>
            ))}
          </div>
        );

      case "features":
        return (
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((feature) => (
              <button
                key={feature.id}
                onClick={() => {
                  const features = config.features.includes(feature.id)
                    ? config.features.filter((f) => f !== feature.id)
                    : [...config.features, feature.id];
                  setConfig({ ...config, features });
                }}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                  config.features.includes(feature.id)
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                )}
              >
                <div className="size-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                  {feature.icon}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-zinc-100">{feature.name}</div>
                  <div className="text-xs text-zinc-500">{feature.description}</div>
                </div>
                <div className={cn(
                  "size-5 rounded-md border-2 flex items-center justify-center transition-colors",
                  config.features.includes(feature.id)
                    ? "border-blue-500 bg-blue-500"
                    : "border-zinc-700"
                )}>
                  {config.features.includes(feature.id) && <CheckIcon className="size-3 text-white" />}
                </div>
              </button>
            ))}
          </div>
        );

      case "styling":
        return (
          <div className="space-y-2">
            {STYLING_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setConfig({ ...config, styling: option.id })}
                className={cn(
                  "w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                  config.styling === option.id
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                )}
              >
                <div className="flex-1">
                  <div className="font-medium text-zinc-100">{option.name}</div>
                  <div className="text-xs text-zinc-500">{option.description}</div>
                </div>
                {config.styling === option.id && <CheckIcon className="size-5 text-blue-500" />}
              </button>
            ))}
          </div>
        );

      case "database":
        return (
          <div className="space-y-2">
            {DATABASE_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setConfig({ ...config, database: option.id === "none" ? null : option.id })}
                className={cn(
                  "w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                  (config.database === option.id || (option.id === "none" && !config.database))
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                )}
              >
                <div className="flex-1">
                  <div className="font-medium text-zinc-100">{option.name}</div>
                  <div className="text-xs text-zinc-500">{option.description}</div>
                </div>
                {(config.database === option.id || (option.id === "none" && !config.database)) && (
                  <CheckIcon className="size-5 text-blue-500" />
                )}
              </button>
            ))}
          </div>
        );

      case "auth":
        return (
          <div className="space-y-2">
            {AUTH_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setConfig({ ...config, auth: option.id === "none" ? null : option.id })}
                className={cn(
                  "w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                  (config.auth === option.id || (option.id === "none" && !config.auth))
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                )}
              >
                <div className="flex-1">
                  <div className="font-medium text-zinc-100">{option.name}</div>
                  <div className="text-xs text-zinc-500">{option.description}</div>
                </div>
                {(config.auth === option.id || (option.id === "none" && !config.auth)) && (
                  <CheckIcon className="size-5 text-blue-500" />
                )}
              </button>
            ))}
          </div>
        );

      case "package-manager":
        return (
          <div className="grid grid-cols-2 gap-3">
            {PACKAGE_MANAGERS.map((pm) => (
              <button
                key={pm.id}
                onClick={() => setConfig({ ...config, packageManager: pm.id })}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                  config.packageManager === pm.id
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                )}
              >
                <div className="size-10 rounded-lg bg-zinc-800 flex items-center justify-center font-mono text-sm text-zinc-300">
                  {pm.id === "bun" ? "🥟" : pm.id === "pnpm" ? "📦" : pm.id === "npm" ? "📦" : "🧶"}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-zinc-100">{pm.name}</div>
                  <div className="text-xs text-zinc-500">{pm.description}</div>
                </div>
                {config.packageManager === pm.id && <CheckIcon className="size-5 text-blue-500" />}
              </button>
            ))}
          </div>
        );

      case "review":
        const framework = FRAMEWORKS.find((f) => f.id === config.framework);
        const styling = STYLING_OPTIONS.find((s) => s.id === config.styling);
        const database = DATABASE_OPTIONS.find((d) => d.id === config.database);
        const auth = AUTH_OPTIONS.find((a) => a.id === config.auth);
        const pm = PACKAGE_MANAGERS.find((p) => p.id === config.packageManager);

        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <ReviewItem label="Project Name" value={config.name} />
              <ReviewItem label="Framework" value={framework?.name || "-"} />
              <ReviewItem label="Features" value={config.features.join(", ") || "None"} />
              <ReviewItem label="Styling" value={styling?.name || "-"} />
              <ReviewItem label="Database" value={database?.name || "None"} />
              <ReviewItem label="Auth" value={auth?.name || "None"} />
              <ReviewItem label="Package Manager" value={pm?.name || "-"} />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // If creating or complete, show logs view
  if (isCreating || creationComplete || creationError) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/50 overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            {isCreating && <Loader2 className="size-5 animate-spin text-blue-500" />}
            {creationComplete && <CheckCircle2 className="size-5 text-green-500" />}
            {creationError && <XCircle className="size-5 text-red-500" />}
            <div>
              <h3 className="font-semibold text-zinc-100">
                {isCreating && "Creating Project..."}
                {creationComplete && "Project Created!"}
                {creationError && "Creation Failed"}
              </h3>
              <p className="text-sm text-zinc-500">{config.name}</p>
            </div>
          </div>
          {isCreating && (
            <Progress value={undefined} className="mt-4 h-1" />
          )}
        </div>

        {/* Logs */}
        <ScrollArea className="h-80">
          <div className="p-4 font-mono text-sm space-y-1">
            {logs.map((log) => (
              <div
                key={log.id}
                className={cn(
                  "flex items-start gap-2 py-1",
                  log.type === "error" && "text-red-400",
                  log.type === "success" && "text-green-400",
                  log.type === "warning" && "text-yellow-400",
                  log.type === "command" && "text-blue-400",
                  log.type === "info" && "text-zinc-400"
                )}
              >
                <span className="text-zinc-600 text-xs shrink-0">
                  {log.timestamp.toLocaleTimeString()}
                </span>
                <span>{log.message}</span>
              </div>
            ))}
            {isCreating && (
              <div className="flex items-center gap-2 text-zinc-500">
                <Loader2 className="size-3 animate-spin" />
                <span>Processing...</span>
              </div>
            )}
          </div>
        </ScrollArea>

        {(creationComplete || creationError) && (
          <div className="p-4 border-t border-zinc-800 flex justify-end gap-3">
            <Button variant="outline" onClick={resetWizard} className="bg-zinc-800 border-zinc-700">
              {creationComplete ? "Create Another" : "Try Again"}
            </Button>
            {creationComplete && (
              <Button className="bg-blue-600 hover:bg-blue-500">
                Open Project
              </Button>
            )}
          </div>
        )}
      </Card>
    );
  }

  // If wizard is open, show wizard steps
  if (showWizard) {
    const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;
    const step = WIZARD_STEPS[currentStep];

    return (
      <Card className="border-zinc-800 bg-zinc-900/50 overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-zinc-800">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step indicators */}
        <div className="p-4 border-b border-zinc-800 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {WIZARD_STEPS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => i < currentStep && setCurrentStep(i)}
                disabled={i > currentStep}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  i === currentStep && "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50",
                  i < currentStep && "bg-green-500/20 text-green-400 cursor-pointer hover:bg-green-500/30",
                  i > currentStep && "bg-zinc-800/50 text-zinc-600 cursor-not-allowed"
                )}
              >
                {i < currentStep ? <CheckIcon className="size-3" /> : <span>{i + 1}</span>}
                <span className="hidden sm:inline">{s.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                {step.icon}
              </div>
              <div>
                <h3 className="font-semibold text-lg text-zinc-100">{step.title}</h3>
                <p className="text-sm text-zinc-500">{step.description}</p>
              </div>
            </div>
          </div>

          <div className="min-h-[300px]">
            {renderStepContent()}
          </div>
        </div>

        {/* Navigation */}
        <div className="p-4 border-t border-zinc-800 flex justify-between">
          <Button
            variant="outline"
            onClick={currentStep === 0 ? () => setShowWizard(false) : prevStep}
            className="bg-zinc-800 border-zinc-700"
          >
            <ChevronLeft className="size-4 mr-1" />
            {currentStep === 0 ? "Cancel" : "Back"}
          </Button>

          {currentStep === WIZARD_STEPS.length - 1 ? (
            <Button
              onClick={handleCreateProject}
              disabled={!isStepValid()}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
            >
              <Rocket className="size-4 mr-2" />
              Create Project
            </Button>
          ) : (
            <Button
              onClick={nextStep}
              disabled={!isStepValid()}
              className="bg-blue-600 hover:bg-blue-500"
            >
              Continue
              <ChevronRight className="size-4 ml-1" />
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // Default view: Show projects or prompt to create
  return (
    <Card className="border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="p-6">
        {isDetecting ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-blue-500" />
            <span className="ml-3 text-zinc-400">Detecting projects...</span>
          </div>
        ) : projects.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-zinc-100">Your Projects</h3>
                <p className="text-sm text-zinc-500">{projects.length} project(s) found</p>
              </div>
              <Button
                onClick={() => setShowWizard(true)}
                size="sm"
                className="bg-blue-600 hover:bg-blue-500"
              >
                <FolderPlus className="size-4 mr-2" />
                New Project
              </Button>
            </div>
            <div className="space-y-2">
              {projects.slice(0, 3).map((project) => (
                <div
                  key={project.path}
                  className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-800"
                >
                  <div className="size-10 rounded-lg bg-zinc-900 flex items-center justify-center">
                    <FolderOpen className="size-5 text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-200 truncate">{project.name}</div>
                    <div className="text-xs text-zinc-500 truncate">{project.path}</div>
                  </div>
                  <div className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    project.status === "running"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-zinc-800 text-zinc-500"
                  )}>
                    {project.status || "stopped"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="size-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-4">
              <FolderPlus className="size-8 text-blue-400" />
            </div>
            <h3 className="font-semibold text-lg text-zinc-100 mb-2">No Projects Found</h3>
            <p className="text-zinc-500 mb-6 max-w-sm mx-auto">
              Create your first project with our interactive wizard. Choose your stack and get started in seconds.
            </p>
            <Button
              onClick={() => setShowWizard(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
            >
              <Sparkles className="size-4 mr-2" />
              Create New Project
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

// Helper component for review
function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-800">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="font-medium text-zinc-200">{value}</div>
    </div>
  );
}
