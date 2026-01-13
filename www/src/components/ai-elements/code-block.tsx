"use client";

import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

export type CodeBlockProps = ComponentProps<"pre"> & {
  code: string;
  language?: string;
};

export const CodeBlock = ({
  className,
  code,
  language = "text",
  ...props
}: CodeBlockProps) => {
  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-md bg-zinc-900 p-4 text-sm text-zinc-100 font-mono",
        className
      )}
      {...props}
    >
      <code className={`language-${language}`}>{code}</code>
    </pre>
  );
};
