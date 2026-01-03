'use client';

import React, { useState } from 'react';
import { FileIcon, FolderIcon, FolderOpenIcon, ChevronRightIcon } from 'lucide-react';
import type { FileTreeItem } from '@/types';

interface FileTreeProps {
  fileTree: Record<string, FileTreeItem>;
  rootPath: string;
}

interface TreeNodeProps {
  itemId: string;
  item: FileTreeItem;
  fileTree: Record<string, FileTreeItem>;
  level: number;
  expandedItems: Set<string>;
  onToggle: (id: string) => void;
}

function TreeNode({ itemId, item, fileTree, level, expandedItems, onToggle }: TreeNodeProps) {
  const isDirectory = item.type === 'directory';
  const isExpanded = expandedItems.has(itemId);
  const hasChildren = item.children && item.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 px-2 hover:bg-zinc-800/50 rounded cursor-pointer text-sm"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => isDirectory && hasChildren && onToggle(itemId)}
      >
        {isDirectory && hasChildren ? (
          <ChevronRightIcon 
            className={`size-3 text-zinc-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        ) : (
          <span className="w-3" />
        )}
        
        {isDirectory ? (
          isExpanded ? (
            <FolderOpenIcon className="size-4 text-blue-500 shrink-0" />
          ) : (
            <FolderIcon className="size-4 text-blue-500 shrink-0" />
          )
        ) : (
          <FileIcon className="size-4 text-zinc-500 shrink-0" />
        )}
        
        <span className="truncate text-zinc-300">{item.name}</span>
      </div>
      
      {isDirectory && isExpanded && hasChildren && (
        <div>
          {item.children!.map((childId) => {
            const childItem = fileTree[childId];
            if (!childItem) return null;
            return (
              <TreeNode
                key={childId}
                itemId={childId}
                item={childItem}
                fileTree={fileTree}
                level={level + 1}
                expandedItems={expandedItems}
                onToggle={onToggle}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FileTree({ fileTree, rootPath }: FileTreeProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Debug logs
  React.useEffect(() => {
    console.log('[FileTree] rootPath:', rootPath);
    console.log('[FileTree] fileTree:', fileTree);
    console.log('[FileTree] fileTree keys:', Object.keys(fileTree));
  }, [rootPath, fileTree]);

  const handleToggle = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Trouver l'entrée root (celle avec le path le plus court ou vide)
  const rootEntries = React.useMemo(() => {
    const entries = Object.entries(fileTree);
    if (entries.length === 0) return [];
    
    // Trouver les entrées de premier niveau (sans '/' ou avec le path le plus court)
    const sorted = entries.sort((a, b) => a[1].path.length - b[1].path.length);
    
    // Prendre la première entrée comme root
    if (sorted.length > 0) {
      const rootId = sorted[0][0];
      // Auto-expand root
      if (!expandedItems.has(rootId)) {
        setExpandedItems(prev => new Set([...prev, rootId]));
      }
      return [[rootId, sorted[0][1]] as [string, FileTreeItem]];
    }
    
    return [];
  }, [fileTree]);

  if (rootEntries.length === 0) {
    return (
      <div className="p-4 text-sm text-zinc-500">
        No workspace detected
      </div>
    );
  }

  return (
    <div className="w-full">
      {rootEntries.map(([id, item]) => (
        <TreeNode
          key={id}
          itemId={id}
          item={item}
          fileTree={fileTree}
          level={0}
          expandedItems={expandedItems}
          onToggle={handleToggle}
        />
      ))}
    </div>
  );
}
