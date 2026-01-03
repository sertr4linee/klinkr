'use client';

import { Activity } from '@/types';
import { cn } from '@/lib/utils';
import { 
  FileIcon, 
  FileEditIcon, 
  FilePlusIcon, 
  FileMinusIcon, 
  TerminalIcon, 
  SearchIcon, 
  BrainIcon, 
  WrenchIcon,
  AlertCircleIcon,
  RefreshCwIcon,
  Trash2Icon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEffect, useRef, useMemo } from 'react';

interface ActivityFeedProps {
  activities: Activity[];
  onClear?: () => void;
  className?: string;
}

// Limiter à 50 activités max pour éviter les problèmes de performance
const MAX_ACTIVITIES = 50;

const activityIcons: Record<Activity['type'], React.ReactNode> = {
  file_read: <FileIcon className="size-3.5 text-blue-400" />,
  file_create: <FilePlusIcon className="size-3.5 text-green-400" />,
  file_modify: <FileEditIcon className="size-3.5 text-yellow-400" />,
  file_delete: <FileMinusIcon className="size-3.5 text-red-400" />,
  file_rename: <RefreshCwIcon className="size-3.5 text-purple-400" />,
  terminal_command: <TerminalIcon className="size-3.5 text-cyan-400" />,
  terminal_output: <TerminalIcon className="size-3.5 text-zinc-400" />,
  thinking: <BrainIcon className="size-3.5 text-purple-400" />,
  tool_call: <WrenchIcon className="size-3.5 text-orange-400" />,
  search: <SearchIcon className="size-3.5 text-blue-400" />,
  diagnostic: <AlertCircleIcon className="size-3.5 text-red-400" />,
};

const activityColors: Record<Activity['type'], string> = {
  file_read: 'border-l-blue-500/50 bg-blue-500/5',
  file_create: 'border-l-green-500/50 bg-green-500/5',
  file_modify: 'border-l-yellow-500/50 bg-yellow-500/5',
  file_delete: 'border-l-red-500/50 bg-red-500/5',
  file_rename: 'border-l-purple-500/50 bg-purple-500/5',
  terminal_command: 'border-l-cyan-500/50 bg-cyan-500/5',
  terminal_output: 'border-l-zinc-500/50 bg-zinc-500/5',
  thinking: 'border-l-purple-500/50 bg-purple-500/5',
  tool_call: 'border-l-orange-500/50 bg-orange-500/5',
  search: 'border-l-blue-500/50 bg-blue-500/5',
  diagnostic: 'border-l-red-500/50 bg-red-500/5',
};

const activityLabels: Record<Activity['type'], string> = {
  file_read: 'Read',
  file_create: 'Create',
  file_modify: 'Modify',
  file_delete: 'Delete',
  file_rename: 'Rename',
  terminal_command: 'Command',
  terminal_output: 'Output',
  thinking: 'Thinking',
  tool_call: 'Tool',
  search: 'Search',
  diagnostic: 'Error',
};

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('fr-FR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 1000) return 'now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return formatTime(timestamp);
}

export function ActivityFeed({ activities, onClear, className }: ActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollTimeRef = useRef<number>(0);
  
  // Limiter les activités affichées pour éviter les problèmes de performance
  const displayedActivities = useMemo(() => {
    return activities.slice(-MAX_ACTIVITIES);
  }, [activities]);
  
  // Auto-scroll to bottom when new activities arrive (throttled)
  useEffect(() => {
    const now = Date.now();
    // Throttle: au maximum 1 scroll toutes les 500ms
    if (scrollRef.current && now - lastScrollTimeRef.current > 500) {
      lastScrollTimeRef.current = now;
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedActivities.length]);

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-zinc-300">Activity Feed</span>
          <span className="text-xs text-zinc-500">({displayedActivities.length}{activities.length > MAX_ACTIVITIES ? `/${activities.length}` : ''})</span>
        </div>
        {onClear && displayedActivities.length > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClear}
            className="h-6 px-2 text-xs text-zinc-400 hover:text-zinc-200"
          >
            <Trash2Icon className="size-3 mr-1" />
            Clear
          </Button>
        )}
      </div>
      
      {/* Activities */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-2 space-y-1">
          {displayedActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
              <BrainIcon className="size-8 mb-2 opacity-50" />
              <p className="text-xs">Waiting for activity...</p>
              <p className="text-xs opacity-50">Actions will appear here in real-time</p>
            </div>
          ) : (
            displayedActivities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ActivityItem({ activity }: { activity: Activity }) {
  const { type, data, timestamp } = activity;
  
  return (
    <div 
      className={cn(
        "flex items-start gap-2 p-2 rounded-md border-l-2 transition-colors",
        activityColors[type]
      )}
    >
      {/* Icon */}
      <div className="mt-0.5 shrink-0">
        {activityIcons[type]}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            {activityLabels[type]}
          </span>
          <span className="text-[10px] text-zinc-600">
            {formatRelativeTime(timestamp)}
          </span>
        </div>
        
        {/* Message or Path */}
        <p className="text-xs text-zinc-300 truncate mt-0.5">
          {data.message || data.path}
        </p>
        
        {/* Additional info */}
        {data.path && data.message && data.path !== data.message && (
          <p className="text-[10px] text-zinc-500 truncate mt-0.5 font-mono">
            {data.path}
          </p>
        )}
        
        {/* Tool args */}
        {data.tool && (
          <p className="text-[10px] text-orange-400/70 truncate mt-0.5 font-mono">
            {data.tool}
          </p>
        )}
        
        {/* Command */}
        {data.command && (
          <p className="text-[10px] text-cyan-400/70 truncate mt-0.5 font-mono">
            $ {data.command}
          </p>
        )}
      </div>
    </div>
  );
}

export default ActivityFeed;
