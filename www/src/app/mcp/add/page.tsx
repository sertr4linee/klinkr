'use client';

import { useEffect, useState, useCallback } from 'react';
import { SupabaseMCPServer } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCwIcon, SearchIcon, ExternalLinkIcon, DownloadIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon, ArrowLeftIcon, BookOpenIcon, TerminalIcon, SettingsIcon, SparklesIcon, CopyIcon, CheckCircleIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';

const SUPABASE_URL = 'https://knhgkaawjfqqwmsgmxns.supabase.co/rest/v1/mcps';
const SUPABASE_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuaGdrYWF3amZxcXdtc2dteG5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk2NDAzMTksImV4cCI6MjA1NTIxNjMxOX0.1Uc-at_fT0Tf1MsNuewJf1VR0yiynPzrPvF0uWvTNnk';
const ITEMS_PER_PAGE = 48;

export default function AddMCPPage() {
  const router = useRouter();
  const [mcpServers, setMcpServers] = useState<SupabaseMCPServer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [installedServers, setInstalledServers] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [showUsageGuide, setShowUsageGuide] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const fetchMCPServers = useCallback(async (page: number = 1, search: string = '') => {
    setIsLoading(true);
    setError(null);
    
    try {
      const offset = (page - 1) * ITEMS_PER_PAGE;
      let url = `${SUPABASE_URL}?select=*&active=eq.true&order=company_id.asc.nullslast&limit=${ITEMS_PER_PAGE}&offset=${offset}`;
      
      // Ajouter la recherche si présente
      if (search.trim()) {
        const searchEncoded = encodeURIComponent(search.trim());
        url += `&fts=fts.%25${searchEncoded}%25:*`;
      }

      const response = await fetch(url, {
        headers: {
          'apikey': SUPABASE_API_KEY,
          'Authorization': `Bearer ${SUPABASE_API_KEY}`,
          'Prefer': 'count=exact',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch MCP servers: ${response.statusText}`);
      }

      // Récupérer le total count depuis les headers
      const contentRange = response.headers.get('content-range');
      if (contentRange) {
        const total = parseInt(contentRange.split('/')[1]);
        setTotalCount(total);
      }

      const data: SupabaseMCPServer[] = await response.json();
      setMcpServers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error fetching MCP servers:', err);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    fetchMCPServers(currentPage, searchQuery);
  }, [currentPage, fetchMCPServers]);

  const handleSearch = useCallback(() => {
    setIsSearching(true);
    setCurrentPage(1); // Retour à la première page lors d'une recherche
    fetchMCPServers(1, searchQuery);
  }, [searchQuery, fetchMCPServers]);

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleInstall = (server: SupabaseMCPServer) => {
    setInstalledServers(prev => new Set(prev).add(server.id));
    
    if (server.mcp_link) {
      window.open(server.mcp_link, '_blank');
    } else if (server.link) {
      window.open(server.link, '_blank');
    }
  };

  const isInstalled = (serverId: string) => installedServers.has(serverId);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const usageExamples = [
    {
      id: 'config',
      title: 'Configuration MCP dans VS Code',
      description: 'Ajoutez cette configuration dans votre fichier settings.json',
      code: `{
  "mcp": {
    "servers": {
      "my-mcp-server": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-name"]
      }
    }
  }
}`
    },
    {
      id: 'chat',
      title: 'Utilisation dans Copilot Chat',
      description: 'Utilisez @mcp pour interagir avec les serveurs MCP',
      code: `@mcp list-tools
@mcp call tool-name --param value
@mcp /help`
    },
    {
      id: 'agent',
      title: 'Mode Agent avec MCP',
      description: 'Activez le mode agent pour des interactions automatisées',
      code: `// Dans Copilot Chat, utilisez:
// 1. Ouvrez le panneau Copilot Chat
// 2. Sélectionnez "Agent" mode
// 3. Les outils MCP seront automatiquement disponibles

// Exemple de prompt:
"Utilise l'outil MCP filesystem pour lister les fichiers"`
    }
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950">

      <div className="sticky top-0 z-10 backdrop-blur-xl bg-zinc-950/80 border-b border-zinc-800/50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="gap-2"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                Back
              </Button>
              <div className="h-8 w-px bg-zinc-700"></div>
              <div>
                <h1 className="text-2xl font-bold bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  MCP Server Marketplace
                </h1>
                <p className="text-sm text-zinc-400">
                  Discover {totalCount.toLocaleString()} Model Context Protocol servers
                </p>
              </div>
            </div>
            <Button
              onClick={() => fetchMCPServers(currentPage, searchQuery)}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCwIcon className={isLoading ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
              Refresh
            </Button>
            <Button
              onClick={() => setShowUsageGuide(!showUsageGuide)}
              variant={showUsageGuide ? "default" : "outline"}
              size="sm"
              className="gap-2"
            >
              <SparklesIcon className="w-4 h-4" />
              Copilot Usage
            </Button>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                placeholder="Search MCP servers by name, description, or keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                className="pl-10 bg-zinc-900/50 border-zinc-700 focus:border-blue-500"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={isSearching}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <SearchIcon className={isSearching ? "w-4 h-4 animate-pulse" : "w-4 h-4"} />
              Search
            </Button>
            {searchQuery && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                  fetchMCPServers(1, '');
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {showUsageGuide && (
        <div className="border-b border-zinc-800/50 bg-zinc-900/50">
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <SparklesIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">GitHub Copilot + MCP Usage Guide</h2>
                <p className="text-sm text-zinc-400">Learn how to use MCP servers with GitHub Copilot</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
              <Card className="border-zinc-800 bg-zinc-950/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <SettingsIcon className="w-4 h-4 text-blue-400" />
                    </div>
                    <CardTitle className="text-sm font-medium text-zinc-200">1. Installation</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-xs text-zinc-400 space-y-2">
                  <p>• Ouvrez VS Code Settings (JSON)</p>
                  <p>• Ajoutez la configuration MCP</p>
                  <p>• Redémarrez VS Code</p>
                </CardContent>
              </Card>

              <Card className="border-zinc-800 bg-zinc-950/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <TerminalIcon className="w-4 h-4 text-green-400" />
                    </div>
                    <CardTitle className="text-sm font-medium text-zinc-200">2. Activation</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-xs text-zinc-400 space-y-2">
                  <p>• Ouvrez Copilot Chat (Ctrl+Shift+I)</p>
                  <p>• Sélectionnez le mode "Agent"</p>
                  <p>• Les outils MCP apparaissent automatiquement</p>
                </CardContent>
              </Card>

              <Card className="border-zinc-800 bg-zinc-950/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <BookOpenIcon className="w-4 h-4 text-purple-400" />
                    </div>
                    <CardTitle className="text-sm font-medium text-zinc-200">3. Utilisation</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-xs text-zinc-400 space-y-2">
                  <p>• Demandez à Copilot d'utiliser un outil</p>
                  <p>• Ex: "Liste les fichiers avec MCP"</p>
                  <p>• Copilot exécute les outils automatiquement</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <TerminalIcon className="w-4 h-4" />
                Code Examples
              </h3>
              <div className="grid gap-4 lg:grid-cols-3">
                {usageExamples.map((example) => (
                  <Card key={example.id} className="border-zinc-800 bg-zinc-950/50 overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-zinc-200">{example.title}</CardTitle>
                      <CardDescription className="text-xs">{example.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="relative">
                        <pre className="bg-zinc-900 rounded-lg p-3 text-xs text-zinc-300 overflow-x-auto border border-zinc-800">
                          <code>{example.code}</code>
                        </pre>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(example.code, example.id)}
                          className="absolute top-2 right-2 h-7 w-7 p-0"
                        >
                          {copiedCode === example.id ? (
                            <CheckCircleIcon className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <CopyIcon className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-linear-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
              <div className="flex items-start gap-3">
                <SparklesIcon className="w-5 h-5 text-purple-400 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-zinc-200 mb-1">Pro Tip</h4>
                  <p className="text-xs text-zinc-400">
                    En mode Agent, Copilot peut chaîner plusieurs outils MCP automatiquement. 
                    Décrivez simplement votre objectif et laissez Copilot orchestrer les appels aux outils.
                    Exemple: "Analyse ce projet et génère un rapport de documentation"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-6 py-8">
        {error && (
          <Card className="border-red-500/50 bg-red-500/10 mb-6">
            <CardContent className="pt-6">
              <p className="text-red-400">{error}</p>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-zinc-700 rounded-full"></div>
              <div className="w-16 h-16 border-4 border-blue-500 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
            </div>
            <span className="mt-4 text-zinc-400">Loading MCP servers...</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="secondary" className="px-3 py-1 text-sm">
                  Page {currentPage} of {totalPages}
                </Badge>
                <span className="text-zinc-400">
                  Showing {mcpServers.length} of {totalCount.toLocaleString()} servers
                </span>
              </div>
            </div>

            <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-8">
              {mcpServers.map((server) => (
                <Card 
                  key={server.id} 
                  className="group relative overflow-hidden border-zinc-800 bg-zinc-900/50 hover:border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-1"
                >
                  <div className="absolute inset-0 bg-linear-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  <CardHeader className="relative pb-3">
                    <div className="flex items-start gap-3">
                      {server.logo ? (
                        <div className="relative">
                          <img
                            src={server.logo}
                            alt={server.name}
                            className="w-12 h-12 rounded-xl object-cover ring-2 ring-zinc-800 group-hover:ring-blue-500/50 transition-all"
                          />
                          {isInstalled(server.id) && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                              <CheckIcon className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-linear-to-br from-zinc-800 to-zinc-700 flex items-center justify-center ring-2 ring-zinc-800 group-hover:ring-blue-500/50 transition-all">
                          <span className="text-xl font-bold text-zinc-300">
                            {server.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base font-semibold truncate text-zinc-100 group-hover:text-blue-400 transition-colors">
                          {server.name}
                        </CardTitle>
                        <Badge variant="secondary" className="mt-1 text-xs bg-zinc-800 text-zinc-400 border-0">
                          {server.plan}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="relative space-y-4 pt-0">
                    <CardDescription className="line-clamp-3 text-xs text-zinc-400 leading-relaxed min-h-[3.6rem]">
                      {server.description}
                    </CardDescription>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={isInstalled(server.id) ? "secondary" : "default"}
                        onClick={() => handleInstall(server)}
                        disabled={isInstalled(server.id)}
                        className="flex-1 h-8 text-xs"
                      >
                        {isInstalled(server.id) ? (
                          <>
                            <CheckIcon className="w-3 h-3 mr-1.5" />
                            Installed
                          </>
                        ) : (
                          <>
                            <DownloadIcon className="w-3 h-3 mr-1.5" />
                            Install
                          </>
                        )}
                      </Button>
                      {server.link && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(server.link, '_blank')}
                          className="h-8 w-8 p-0"
                        >
                          <ExternalLinkIcon className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {mcpServers.length === 0 && !isLoading && (
              <Card className="border-dashed border-zinc-700 bg-zinc-900/30">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="w-20 h-20 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                    <SearchIcon className="w-10 h-10 text-zinc-600" />
                  </div>
                  <p className="text-lg font-medium text-zinc-300 mb-2">
                    No servers found
                  </p>
                  <p className="text-sm text-zinc-500 text-center max-w-md">
                    {searchQuery 
                      ? `No MCP servers match "${searchQuery}". Try a different search term.`
                      : 'No MCP servers available at the moment.'}
                  </p>
                </CardContent>
              </Card>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="gap-1"
                >
                  <ChevronsLeftIcon className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="gap-1"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                  Previous
                </Button>
                
                <div className="flex items-center gap-1 mx-2">
                  {[...Array(Math.min(7, totalPages))].map((_, i) => {
                    let pageNum;
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (currentPage <= 4) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = currentPage - 3 + i;
                    }

                    return (
                      <Button
                        key={i}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(pageNum)}
                        className={currentPage === pageNum ? "w-9 h-9 p-0 bg-blue-600 hover:bg-blue-700 text-white" : "w-9 h-9 p-0"}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="gap-1"
                >
                  Next
                  <ChevronRightIcon className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="gap-1"
                >
                  <ChevronsRightIcon className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
