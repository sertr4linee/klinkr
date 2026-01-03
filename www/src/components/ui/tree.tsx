'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { MinusIcon, PlusIcon } from 'lucide-react';

interface TreeProps extends React.HTMLAttributes<HTMLDivElement> {
  tree: any;
  indent?: number;
  toggleIconType?: 'chevron' | 'plus-minus';
}

const Tree = React.forwardRef<HTMLDivElement, TreeProps>(
  ({ className, tree, indent = 20, toggleIconType = 'chevron', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('relative', className)}
        style={{ '--tree-indent': `${indent}px` } as React.CSSProperties}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Tree.displayName = 'Tree';

interface TreeItemProps extends React.HTMLAttributes<HTMLDivElement> {
  item: any;
}

const TreeItem = React.forwardRef<HTMLDivElement, TreeItemProps>(
  ({ className, item, children, ...props }, ref) => {
    const isExpanded = item.isExpanded();
    const isFolder = item.isFolder();
    const level = item.getItemMeta().level;
    const indent = 20;

    const toggle = () => {
      if (isFolder) {
        item.toggle();
      }
    };

    return (
      <div
        ref={ref}
        className={cn('flex items-center', className)}
        role="treeitem"
        aria-expanded={isFolder ? isExpanded : undefined}
        style={{
          paddingLeft: `${level * indent}px`,
        }}
        {...props}
      >
        {isFolder && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggle();
            }}
            className="relative z-10 mr-1 flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <MinusIcon className="size-3" />
            ) : (
              <PlusIcon className="size-3" />
            )}
          </button>
        )}
        {!isFolder && <div className="mr-1 size-5 shrink-0" />}
        {children}
      </div>
    );
  }
);
TreeItem.displayName = 'TreeItem';

interface TreeItemLabelProps extends React.HTMLAttributes<HTMLSpanElement> {}

const TreeItemLabel = React.forwardRef<HTMLSpanElement, TreeItemLabelProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'flex-1 select-none truncate text-sm',
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);
TreeItemLabel.displayName = 'TreeItemLabel';

export { Tree, TreeItem, TreeItemLabel };
export type { TreeProps, TreeItemProps, TreeItemLabelProps };
