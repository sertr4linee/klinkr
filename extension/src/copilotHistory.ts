/**
 * Service pour récupérer l'historique des conversations Copilot
 * Supporte VS Code stable et Insiders
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export interface CopilotConversation {
  id: string;
  title: string;
  timestamp: number;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  source: 'stable' | 'insiders';
}

export interface CopilotHistoryConfig {
  preferredVersion: 'stable' | 'insiders' | 'both';
  maxConversations: number;
}

export class CopilotHistoryService {
  private static instance: CopilotHistoryService;
  private config: CopilotHistoryConfig;

  private constructor(private context: vscode.ExtensionContext) {
    this.config = this.loadConfig();
  }

  public static getInstance(context: vscode.ExtensionContext): CopilotHistoryService {
    if (!CopilotHistoryService.instance) {
      CopilotHistoryService.instance = new CopilotHistoryService(context);
    }
    return CopilotHistoryService.instance;
  }

  /**
   * Charge la configuration depuis les settings VS Code
   */
  private loadConfig(): CopilotHistoryConfig {
    const config = vscode.workspace.getConfiguration('klinkr');
    return {
      preferredVersion: config.get<'stable' | 'insiders' | 'both'>('copilotHistoryVersion', 'both'),
      maxConversations: config.get<number>('copilotHistoryMax', 3)
    };
  }

  /**
   * Met à jour la configuration
   */
  public async updateConfig(newConfig: Partial<CopilotHistoryConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    const config = vscode.workspace.getConfiguration('klinkr');
    
    if (newConfig.preferredVersion) {
      await config.update('copilotHistoryVersion', newConfig.preferredVersion, vscode.ConfigurationTarget.Global);
    }
    if (newConfig.maxConversations) {
      await config.update('copilotHistoryMax', newConfig.maxConversations, vscode.ConfigurationTarget.Global);
    }
  }

  /**
   * Récupère les chemins des dossiers Copilot selon l'OS
   */
  private getCopilotPaths(): { stable: string; insiders: string } {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    
    if (process.platform === 'darwin') {
      // macOS
      return {
        stable: path.join(homeDir, 'Library/Application Support/Code/User/globalStorage/github.copilot-chat'),
        insiders: path.join(homeDir, 'Library/Application Support/Code - Insiders/User/globalStorage/github.copilot-chat')
      };
    } else if (process.platform === 'win32') {
      // Windows
      return {
        stable: path.join(homeDir, 'AppData/Roaming/Code/User/globalStorage/github.copilot-chat'),
        insiders: path.join(homeDir, 'AppData/Roaming/Code - Insiders/User/globalStorage/github.copilot-chat')
      };
    } else {
      // Linux
      return {
        stable: path.join(homeDir, '.config/Code/User/globalStorage/github.copilot-chat'),
        insiders: path.join(homeDir, '.config/Code - Insiders/User/globalStorage/github.copilot-chat')
      };
    }
  }

  /**
   * Vérifie quelles versions de VS Code sont disponibles
   */
  public async getAvailableVersions(): Promise<{ stable: boolean; insiders: boolean }> {
    const paths = this.getCopilotPaths();
    
    const stableExists = await this.pathExists(paths.stable);
    const insidersExists = await this.pathExists(paths.insiders);
    
    return {
      stable: stableExists,
      insiders: insidersExists
    };
  }

  /**
   * Récupère les dernières conversations
   */
  public async getRecentConversations(): Promise<CopilotConversation[]> {
    const paths = this.getCopilotPaths();
    const available = await this.getAvailableVersions();
    const conversations: CopilotConversation[] = [];

    // Déterminer quelles versions lire selon la config
    const shouldReadStable = 
      (this.config.preferredVersion === 'stable' || this.config.preferredVersion === 'both') && 
      available.stable;
    
    const shouldReadInsiders = 
      (this.config.preferredVersion === 'insiders' || this.config.preferredVersion === 'both') && 
      available.insiders;

    // Lire les conversations de VS Code stable
    if (shouldReadStable) {
      const stableConvs = await this.readConversationsFromPath(paths.stable, 'stable');
      conversations.push(...stableConvs);
    }

    // Lire les conversations de VS Code Insiders
    if (shouldReadInsiders) {
      const insidersConvs = await this.readConversationsFromPath(paths.insiders, 'insiders');
      conversations.push(...insidersConvs);
    }

    // Trier par timestamp décroissant et limiter au max
    conversations.sort((a, b) => b.timestamp - a.timestamp);
    return conversations.slice(0, this.config.maxConversations);
  }

  /**
   * Lit les conversations depuis un dossier spécifique
   */
  private async readConversationsFromPath(
    basePath: string, 
    source: 'stable' | 'insiders'
  ): Promise<CopilotConversation[]> {
    try {
      if (!await this.pathExists(basePath)) {
        console.log(`[CopilotHistory] Path not found: ${basePath}`);
        return [];
      }

      // Le dossier contient généralement des fichiers .json avec les sessions
      const files = await readdir(basePath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      console.log(`[CopilotHistory] Found ${jsonFiles.length} JSON files in ${source}`);

      const conversations: CopilotConversation[] = [];

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(basePath, file);
          const content = await readFile(filePath, 'utf-8');
          const data = JSON.parse(content);

          // Parser le format de conversation Copilot
          const conversation = this.parseConversationData(data, file, source);
          if (conversation) {
            conversations.push(conversation);
          }
        } catch (error) {
          console.error(`[CopilotHistory] Error reading ${file}:`, error);
        }
      }

      return conversations;
    } catch (error) {
      console.error(`[CopilotHistory] Error reading from ${basePath}:`, error);
      return [];
    }
  }

  /**
   * Parse les données d'une conversation Copilot
   */
  private parseConversationData(
    data: any, 
    filename: string, 
    source: 'stable' | 'insiders'
  ): CopilotConversation | null {
    try {
      // Le format exact peut varier selon la version de Copilot
      // Voici une structure générique qui devrait fonctionner
      
      const messages = [];
      const turns = data.turns || data.messages || [];

      for (const turn of turns) {
        if (turn.request?.message) {
          messages.push({
            role: 'user' as const,
            content: turn.request.message,
            timestamp: turn.request.timestamp || Date.now()
          });
        }
        if (turn.response?.message) {
          messages.push({
            role: 'assistant' as const,
            content: turn.response.message,
            timestamp: turn.response.timestamp || Date.now()
          });
        }
      }

      if (messages.length === 0) {
        return null;
      }

      // Extraire le titre (premier message user ou filename)
      const firstUserMessage = messages.find(m => m.role === 'user');
      const title = firstUserMessage 
        ? firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
        : filename.replace('.json', '');

      // Timestamp = date de modification du fichier ou premier message
      const timestamp = messages[0]?.timestamp || Date.now();

      return {
        id: `${source}-${filename}`,
        title,
        timestamp,
        messages,
        source
      };
    } catch (error) {
      console.error('[CopilotHistory] Error parsing conversation:', error);
      return null;
    }
  }

  /**
   * Vérifie si un chemin existe
   */
  private async pathExists(p: string): Promise<boolean> {
    try {
      await stat(p);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Récupère la configuration actuelle
   */
  public getConfig(): CopilotHistoryConfig {
    return { ...this.config };
  }
}
