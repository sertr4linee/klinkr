'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MCPServer } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCwIcon, ServerIcon, CheckCircle2Icon, XCircleIcon, AlertCircleIcon, ChevronRightIcon, PlusIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MCPToolsViewer } from './MCPToolsViewer';

interface MCPServerManagerProps {
  mcpServers: MCPServer[];
  detectMCPServers: () => void;
  isDetectingMCP: boolean;
}

export function MCPServerManager({
  mcpServers,
  detectMCPServers,
  isDetectingMCP
}: MCPServerManagerProps) {
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);
  const router = useRouter();

  // Auto-detect on mount
  useEffect(() => {
    detectMCPServers();
  }, [detectMCPServers]);

  const getStatusIcon = (status: MCPServer['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle2Icon className="w-4 h-4 text-green-500" />;
      case 'inactive':
        return <XCircleIcon className="w-4 h-4 text-zinc-400" />;
      case 'error':
        return <AlertCircleIcon className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: MCPServer['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-600">Active</Badge>;
      case 'inactive':
        return <Badge variant="secondary" className="bg-zinc-700">Inactive</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
    }
  };

  return (
    <div className="w-full">
      <Card className="border-zinc-800 bg-zinc-950">
        <CardHeader className="pb-4 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-12 rounded-xl bg-linear-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
                <ServerIcon className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <CardTitle className="text-xl text-zinc-100">MCP Servers</CardTitle>
                <CardDescription className="text-zinc-500 mt-1">
                  Model Context Protocol servers active in your workspace
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={() => router.push('/mcp/add')}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white border-0"
              >
                <PlusIcon className="w-4 h-4" />
                Add MCP Server
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={detectMCPServers}
                disabled={isDetectingMCP}
                className="gap-2 border-zinc-700 hover:bg-zinc-800"
              >
                <RefreshCwIcon className={`w-4 h-4 ${isDetectingMCP ? 'animate-spin' : ''}`} />
                {isDetectingMCP ? 'Scanning...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {mcpServers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ServerIcon className="w-16 h-16 text-zinc-600 mb-4" />
              <p className="text-sm text-zinc-400 mb-1 font-medium">No MCP servers detected</p>
              <p className="text-xs text-zinc-500 mb-4">
                Configure MCP servers in VS Code settings or browse available servers
              </p>
              <Button
                size="sm"
                onClick={() => router.push('/mcp/add')}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <PlusIcon className="w-4 h-4" />
                Browse MCP Servers
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {/* Liste des serveurs - 1/3 de la largeur */}
              <div className="xl:col-span-1">
                <ScrollArea className="h-150">
                  <div className="space-y-3 pr-4">
                    {mcpServers.map((server, index) => (
                      <div
                        key={index}
                        className={`group relative rounded-xl border cursor-pointer transition-all duration-200 ${
                          selectedServer?.name === server.name
                            ? 'border-blue-500/50 bg-linear-to-br from-blue-950/20 to-indigo-950/20 shadow-lg shadow-blue-900/20'
                            : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700 hover:bg-zinc-900/50'
                        }`}
                        onClick={() => setSelectedServer(server)}
                      >
                        {/* Gradient overlay on hover */}
                        <div className="absolute inset-0 rounded-xl bg-linear-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        <div className="relative p-4">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`flex items-center justify-center size-8 rounded-lg ${
                                server.status === 'active' 
                                  ? 'bg-linear-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30'
                                  : 'bg-zinc-800 border border-zinc-700'
                              }`}>
                                {getStatusIcon(server.status)}
                              </div>
                              <div>
                                <h4 className="font-semibold text-sm text-zinc-100">{server.name}</h4>
                              </div>
                            </div>
                            <ChevronRightIcon className={`w-4 h-4 transition-transform ${
                              selectedServer?.name === server.name ? 'rotate-90 text-blue-400' : 'text-zinc-600 group-hover:text-zinc-400'
                            }`} />
                          </div>
                          
                          <div className="mb-2">
                            {getStatusBadge(server.status)}
                          </div>

                          {/* Tools Badge */}
                          {server.tools && server.tools.length > 0 && (
                            <Badge variant="outline" className="text-xs border-blue-500/30 bg-blue-500/10 text-blue-400 font-medium">
                              🔧 {server.tools.length} tool{server.tools.length > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Viewer des tools - 2/3 de la largeur */}
              <div className="xl:col-span-2">
                {selectedServer ? (
                  <div className="h-150 overflow-hidden">
                    {/* Header des détails */}
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 mb-4">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`flex items-center justify-center size-12 rounded-xl ${
                            selectedServer.status === 'active' 
                              ? 'bg-linear-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30'
                              : 'bg-zinc-800 border border-zinc-700'
                          }`}>
                            {getStatusIcon(selectedServer.status)}
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-zinc-100">{selectedServer.name}</h3>
                            {selectedServer.description && (
                              <p className="text-sm text-zinc-400 mt-1">{selectedServer.description}</p>
                            )}
                          </div>
                        </div>
                        {getStatusBadge(selectedServer.status)}
                      </div>

                      {/* Command & Args */}
                      <div className="space-y-3">
                        <div>
                          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">
                            Command
                          </span>
                          <code className="text-sm bg-zinc-800/70 px-3 py-2 rounded-lg block text-zinc-300 font-mono border border-zinc-700/50">
                            {selectedServer.command}
                          </code>
                        </div>
                        
                        {selectedServer.args.length > 0 && (
                          <div>
                            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">
                              Arguments
                            </span>
                            <code className="text-sm bg-zinc-800/70 px-3 py-2 rounded-lg block text-zinc-300 font-mono border border-zinc-700/50">
                              {selectedServer.args.join(' ')}
                            </code>
                          </div>
                        )}

                        {selectedServer.env && Object.keys(selectedServer.env).length > 0 && (
                          <div>
                            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1 block">
                              Environment Variables
                            </span>
                            <div className="space-y-1">
                              {Object.entries(selectedServer.env).map(([key, value]) => (
                                <code key={key} className="text-sm bg-zinc-800/70 px-3 py-2 rounded-lg block text-zinc-300 font-mono border border-zinc-700/50">
                                  {key}={value}
                                </code>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tools viewer */}
                    <MCPToolsViewer 
                      serverName={selectedServer.name} 
                      tools={selectedServer.tools || []} 
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-150 rounded-xl border border-zinc-800 bg-zinc-900/30 text-center">
                    <ServerIcon className="w-20 h-20 text-zinc-700 mb-4" />
                    <p className="text-zinc-400 mb-2 font-medium text-lg">Select an MCP server</p>
                    <p className="text-sm text-zinc-600">
                      Click on a server from the list to view its details and available tools
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
