"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

// Message Component
export const Message = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    from: "user" | "assistant";
  }
>(({ className, from, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "flex w-full",
        from === "user" ? "justify-end" : "justify-start",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-lg p-4",
          from === "user"
            ? "bg-blue-600 text-white"
            : "bg-zinc-800/50 border border-zinc-700 text-zinc-100"
        )}
      >
        {children}
      </div>
    </div>
  );
});
Message.displayName = "Message";

// Message Content
export const MessageContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div ref={ref} className={cn("space-y-2", className)} {...props}>
      {children}
    </div>
  );
});
MessageContent.displayName = "MessageContent";

// Message Response (renders markdown)
export const MessageResponse = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const content = typeof children === "string" ? children : String(children);

  return (
    <div
      ref={ref}
      className={cn("prose prose-invert max-w-none prose-sm", className)}
      {...props}
    >
      <ReactMarkdown
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? (
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            ) : (
              <code className={cn("rounded bg-zinc-700 px-1 py-0.5", className)} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
MessageResponse.displayName = "MessageResponse";

// Message Attachments
export const MessageAttachments = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex flex-wrap gap-2 mb-2", className)}
      {...props}
    >
      {children}
    </div>
  );
});
MessageAttachments.displayName = "MessageAttachments";

// Message Attachment
export const MessageAttachment = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    data: {
      type: "file";
      url: string;
      mediaType?: string;
      filename?: string;
    };
  }
>(({ className, data, ...props }, ref) => {
  const isImage = data.mediaType?.startsWith("image/");

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-zinc-700 overflow-hidden",
        className
      )}
      {...props}
    >
      {isImage && data.url ? (
        <img
          src={data.url}
          alt={data.filename || "Attachment"}
          className="h-32 w-32 object-cover"
        />
      ) : (
        <div className="flex items-center gap-2 bg-zinc-800 px-3 py-2">
          <span className="text-xs text-zinc-400">{data.filename}</span>
        </div>
      )}
    </div>
  );
});
MessageAttachment.displayName = "MessageAttachment";

// Message Actions
export const MessageActions = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("mt-2 flex items-center gap-1", className)}
      {...props}
    >
      {children}
    </div>
  );
});
MessageActions.displayName = "MessageActions";

// Message Action
export const MessageAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    tooltip?: string;
  }
>(({ className, label, tooltip, children, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        "rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-100",
        className
      )}
      title={tooltip || label}
      aria-label={label}
      {...props}
    >
      {children}
    </button>
  );
});
MessageAction.displayName = "MessageAction";

// Message Branch Context
interface MessageBranchContextType {
  currentBranch: number;
  setCurrentBranch: (branch: number) => void;
  totalBranches: number;
}

const MessageBranchContext = React.createContext<
  MessageBranchContextType | undefined
>(undefined);

const useMessageBranchContext = () => {
  const context = React.useContext(MessageBranchContext);
  if (!context) {
    throw new Error(
      "MessageBranch components must be used within MessageBranch"
    );
  }
  return context;
};

// Message Branch
export const MessageBranch = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    defaultBranch?: number;
  }
>(({ className, defaultBranch = 0, children, ...props }, ref) => {
  const [currentBranch, setCurrentBranch] = React.useState(defaultBranch);
  const childrenArray = React.Children.toArray(children);
  const content = childrenArray.find(
    (child: any) => child.type?.displayName === "MessageBranchContent"
  );
  const contentChildren = content ? React.Children.toArray((content as any).props.children) : [];
  const totalBranches = contentChildren.length;

  return (
    <MessageBranchContext.Provider
      value={{ currentBranch, setCurrentBranch, totalBranches }}
    >
      <div ref={ref} className={cn("space-y-2", className)} {...props}>
        {children}
      </div>
    </MessageBranchContext.Provider>
  );
});
MessageBranch.displayName = "MessageBranch";

// Message Branch Content
export const MessageBranchContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { currentBranch } = useMessageBranchContext();
  const childrenArray = React.Children.toArray(children);

  return (
    <div ref={ref} className={cn(className)} {...props}>
      {childrenArray[currentBranch]}
    </div>
  );
});
MessageBranchContent.displayName = "MessageBranchContent";

// Message Toolbar
export const MessageToolbar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("mt-2 flex items-center justify-between", className)}
      {...props}
    >
      {children}
    </div>
  );
});
MessageToolbar.displayName = "MessageToolbar";

// Message Branch Selector
export const MessageBranchSelector = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    from?: "user" | "assistant";
  }
>(({ className, from = "assistant", children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex items-center gap-1", className)}
      {...props}
    >
      {children}
    </div>
  );
});
MessageBranchSelector.displayName = "MessageBranchSelector";

// Message Branch Previous
export const MessageBranchPrevious = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  const { currentBranch, setCurrentBranch, totalBranches } =
    useMessageBranchContext();

  return (
    <button
      ref={ref}
      className={cn(
        "rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      onClick={() => setCurrentBranch(Math.max(0, currentBranch - 1))}
      disabled={currentBranch === 0}
      aria-label="Previous branch"
      {...props}
    >
      ←
    </button>
  );
});
MessageBranchPrevious.displayName = "MessageBranchPrevious";

// Message Branch Next
export const MessageBranchNext = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  const { currentBranch, setCurrentBranch, totalBranches } =
    useMessageBranchContext();

  return (
    <button
      ref={ref}
      className={cn(
        "rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      onClick={() =>
        setCurrentBranch(Math.min(totalBranches - 1, currentBranch + 1))
      }
      disabled={currentBranch === totalBranches - 1}
      aria-label="Next branch"
      {...props}
    >
      →
    </button>
  );
});
MessageBranchNext.displayName = "MessageBranchNext";

// Message Branch Page
export const MessageBranchPage = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => {
  const { currentBranch, totalBranches } = useMessageBranchContext();

  return (
    <span
      ref={ref}
      className={cn("text-xs text-zinc-400", className)}
      {...props}
    >
      {currentBranch + 1} / {totalBranches}
    </span>
  );
});
MessageBranchPage.displayName = "MessageBranchPage";
