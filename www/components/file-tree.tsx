"use client";

import { ChevronDownIcon, ChevronRightIcon, FileIcon, FolderIcon } from "lucide-react";
import { useEffect, useState } from "react";

type FileNode = {
  name: string;
  type: "file" | "directory";
  path: string;
  children?: FileNode[];
};

export const FileTree = () => {
  const [tree, setTree] = useState<FileNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(["root"]));

  useEffect(() => {
    const fetchTree = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/file-tree");
        if (!response.ok) {
          throw new Error("Failed to fetch file tree");
        }
        const data = await response.json();
        if (data.success && data.tree) {
          setTree(data.tree);
        } else {
          throw new Error(data.error || "No tree data received");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        console.error("Error fetching file tree:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTree();
  }, []);

  const toggleExpanded = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const renderNode = (node: FileNode, level: number = 0) => {
    const isExpanded = expandedPaths.has(node.path);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.path}>
        <div
          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-zinc-800/50"
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => hasChildren && toggleExpanded(node.path)}
        >
          {node.type === "directory" ? (
            <>
              {hasChildren && (
                isExpanded ? (
                  <ChevronDownIcon className="size-4 text-zinc-400" />
                ) : (
                  <ChevronRightIcon className="size-4 text-zinc-400" />
                )
              )}
              <FolderIcon className="size-4 text-blue-400" />
              <span className="text-sm text-zinc-300">{node.name}</span>
            </>
          ) : (
            <>
              <FileIcon className="ml-4 size-4 text-zinc-500" />
              <span className="text-sm text-zinc-400">{node.name}</span>
            </>
          )}
        </div>
        {node.type === "directory" && isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-zinc-400">Loading file tree...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-sm text-zinc-400">No files found</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {tree && renderNode(tree)}
    </div>
  );
};
