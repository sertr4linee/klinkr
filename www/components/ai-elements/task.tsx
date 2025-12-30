"use client";

import * as React from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const TaskContext = React.createContext<TaskContextType | undefined>(undefined);

const useTaskContext = () => {
  const context = React.useContext(TaskContext);
  if (!context) {
    throw new Error("Task components must be used within Task");
  }
  return context;
};

export const Task = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <TaskContext.Provider value={{ isOpen, setIsOpen }}>
      <div
        ref={ref}
        className={cn(
          "rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </TaskContext.Provider>
  );
});
Task.displayName = "Task";

export const TaskTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { title?: string }
>(({ className, title, ...props }, ref) => {
  const { isOpen, setIsOpen } = useTaskContext();

  return (
    <button
      ref={ref}
      className={cn(
        "flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-zinc-800/50",
        className
      )}
      onClick={() => setIsOpen(!isOpen)}
      {...props}
    >
      <span className="text-sm font-medium text-zinc-200">{title || "Task"}</span>
      {isOpen ? (
        <ChevronDownIcon className="size-4 text-zinc-400" />
      ) : (
        <ChevronRightIcon className="size-4 text-zinc-400" />
      )}
    </button>
  );
});
TaskTrigger.displayName = "TaskTrigger";

export const TaskContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { isOpen } = useTaskContext();

  if (!isOpen) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "border-t border-zinc-800 bg-zinc-950/50 px-4 py-3",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
TaskContent.displayName = "TaskContent";

export const TaskItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-2 py-1.5 text-sm text-zinc-400",
        className
      )}
      {...props}
    >
      <span className="size-1.5 rounded-full bg-zinc-600" />
      {children}
    </div>
  );
});
TaskItem.displayName = "TaskItem";

export const TaskItemFile = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, children, ...props }, ref) => {
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md bg-zinc-800 px-2 py-0.5 text-zinc-200",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
});
TaskItemFile.displayName = "TaskItemFile";
