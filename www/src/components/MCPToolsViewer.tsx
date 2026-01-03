"use client";

import { useState } from "react";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { WrenchIcon, ToggleLeftIcon, ToggleRightIcon, CheckCircle2Icon, XCircleIcon } from "lucide-react";

interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

interface MCPToolsViewerProps {
  serverName: string;
  tools: MCPTool[];
}

export function MCPToolsViewer({ serverName, tools }: MCPToolsViewerProps) {
  const [enabledTools, setEnabledTools] = useState<Set<string>>(() => {
    // Par défaut, tous les tools sont activés
    return new Set(tools?.map(t => t.name) || []);
  });

  const toggleTool = (toolName: string) => {
    setEnabledTools(prev => {
      const newSet = new Set(prev);
      if (newSet.has(toolName)) {
        newSet.delete(toolName);
      } else {
        newSet.add(toolName);
      }
      return newSet;
    });
  };

  const toggleAll = () => {
    if (enabledTools.size === tools?.length) {
      setEnabledTools(new Set());
    } else {
      setEnabledTools(new Set(tools?.map(t => t.name) || []));
    }
  };

  if (!tools || tools.length === 0) {
    return (
      <div>
        <div className="mb-3 flex items-center gap-2">
          <WrenchIcon className="w-5 h-5 text-purple-400" />
          <h3 className="font-bold text-base text-zinc-100">
            Available Tools
          </h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-zinc-800 bg-zinc-900/30 text-center">
          <WrenchIcon className="w-16 h-16 text-zinc-600 mb-3" />
          <p className="text-sm text-zinc-400">No tools available for this server</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <WrenchIcon className="w-5 h-5 text-purple-400" />
          <h3 className="font-bold text-base text-zinc-100">
            Available Tools
          </h3>
          <Badge variant="outline" className="border-zinc-700 bg-zinc-800 text-zinc-300">
            {tools.length} total
          </Badge>
          <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-400">
            {enabledTools.size} enabled
          </Badge>
        </div>
        <button
          onClick={toggleAll}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
        >
          {enabledTools.size === tools.length ? (
            <>
              <ToggleRightIcon className="w-4 h-4 text-blue-400" />
              Disable All
            </>
          ) : (
            <>
              <ToggleLeftIcon className="w-4 h-4 text-zinc-500" />
              Enable All
            </>
          )}
        </button>
      </div>
      <ScrollArea className="h-112.5">
        <div className="pr-4">
          <div className="space-y-3">
            {tools.map((tool, index) => {
              const isEnabled = enabledTools.has(tool.name);
              return (
                <div
                  key={index}
                  className={`rounded-xl border overflow-hidden transition-all duration-200 ${
                    isEnabled
                      ? 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
                      : 'border-zinc-800/50 bg-zinc-900/10 opacity-60'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`flex items-center justify-center size-8 rounded-lg border shrink-0 ${
                        isEnabled
                          ? 'bg-linear-to-br from-blue-500/20 to-indigo-500/20 border-blue-500/30'
                          : 'bg-zinc-800 border-zinc-700'
                      }`}>
                        <WrenchIcon className={`w-4 h-4 ${isEnabled ? 'text-blue-400' : 'text-zinc-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <h3 className={`font-semibold text-base ${isEnabled ? 'text-zinc-100' : 'text-zinc-500'}`}>
                            {tool.name}
                          </h3>
                          <button
                            onClick={() => toggleTool(tool.name)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                              isEnabled
                                ? 'bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30'
                                : 'bg-zinc-800 border border-zinc-700 text-zinc-500 hover:bg-zinc-700'
                            }`}
                          >
                            {isEnabled ? (
                              <>
                                <CheckCircle2Icon className="w-3 h-3" />
                                Enabled
                              </>
                            ) : (
                              <>
                                <XCircleIcon className="w-3 h-3" />
                                Disabled
                              </>
                            )}
                          </button>
                        </div>
                        {tool.description && (
                          <p className={`text-sm leading-relaxed ${isEnabled ? 'text-zinc-400' : 'text-zinc-600'}`}>
                            {tool.description}
                          </p>
                        )}
                      </div>
                    </div>
                  
                    {tool.inputSchema && tool.inputSchema.properties && (
                      <div className={`mt-3 pt-3 border-t ${isEnabled ? 'border-zinc-800' : 'border-zinc-800/50'}`}>
                        <div className={`mb-3 text-xs font-semibold uppercase tracking-wider ${
                          isEnabled ? 'text-zinc-500' : 'text-zinc-600'
                        }`}>
                          Parameters
                        </div>
                        <div className="space-y-2">
                          {Object.entries(tool.inputSchema.properties).map(([key, value]: [string, any]) => (
                            <div key={key} className="flex items-start gap-3 text-sm">
                              <code className={`font-semibold px-3 py-1.5 rounded-lg border shrink-0 ${
                                isEnabled
                                  ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                                  : 'text-zinc-600 bg-zinc-800/50 border-zinc-700/50'
                              }`}>
                                {key}
                              </code>
                              <div className="flex-1 pt-1">
                                <span className={isEnabled ? 'text-zinc-300' : 'text-zinc-600'}>
                                  {value.description || value.type || 'N/A'}
                                </span>
                                {value.type && (
                                  <span className={`ml-2 text-xs ${isEnabled ? 'text-zinc-500' : 'text-zinc-700'}`}>
                                    ({value.type})
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
