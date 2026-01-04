/**
 * REALM Protocol - Sync Engine
 * 
 * Orchestre la synchronisation entre les différentes sources:
 * - Extension (server.ts)
 * - Panel Web (WebSocket)
 * - DOM Preview (PostMessage/iframe)
 * - File Watcher
 */

import * as crypto from 'crypto';
import type { 
  RealmEvent, 
  RealmID, 
  EventSource,
  ElementStyles,
  ConflictInfo,
} from '../types';
import { EventBus, createEvent } from './EventBus';
import { ElementRegistry } from '../ElementRegistry';
import { TransactionManager } from '../TransactionManager';

// ============================================================================
// Types
// ============================================================================

export interface SyncClient {
  id: string;
  type: 'websocket' | 'postmessage' | 'internal';
  send: (event: RealmEvent) => void;
  isConnected: () => boolean;
}

export interface SyncEngineConfig {
  /** Délai de debounce pour les events (ms) */
  debounceDelay: number;
  /** Stratégie de résolution de conflit */
  conflictStrategy: 'last-write-wins' | 'first-write-wins' | 'manual';
  /** Activer le mode preview (pas de commit auto) */
  previewMode: boolean;
}

const DEFAULT_CONFIG: SyncEngineConfig = {
  debounceDelay: 50,
  conflictStrategy: 'last-write-wins',
  previewMode: false,
};

// ============================================================================
// Sync Engine
// ============================================================================

export class SyncEngine {
  private static instance: SyncEngine;
  
  private eventBus: EventBus;
  private registry: ElementRegistry;
  private txManager: TransactionManager;
  
  /** Clients connectés */
  private clients: Map<string, SyncClient> = new Map();
  
  /** Config */
  private config: SyncEngineConfig;
  
  /** Debounce timers */
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  
  /** Version vectors pour conflict detection */
  private versionVectors: Map<string, number> = new Map();
  
  /** Pending previews (pas encore commités) */
  private pendingPreviews: Map<string, PendingPreview> = new Map();
  
  private constructor(config: Partial<SyncEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.eventBus = EventBus.getInstance();
    this.registry = ElementRegistry.getInstance();
    this.txManager = TransactionManager.getInstance();
    
    this.setupEventHandlers();
  }
  
  public static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }
  
  public static resetInstance(): void {
    SyncEngine.instance = new SyncEngine();
  }
  
  // ============================================================================
  // Client Management
  // ============================================================================
  
  /**
   * Enregistre un client
   */
  registerClient(client: SyncClient): void {
    this.clients.set(client.id, client);
    console.log(`[SyncEngine] Client registered: ${client.id} (${client.type})`);
  }
  
  /**
   * Désenregistre un client
   */
  unregisterClient(clientId: string): void {
    this.clients.delete(clientId);
    console.log(`[SyncEngine] Client unregistered: ${clientId}`);
  }
  
  /**
   * Récupère un client
   */
  getClient(clientId: string): SyncClient | undefined {
    return this.clients.get(clientId);
  }
  
  /**
   * Liste les clients connectés
   */
  getConnectedClients(): SyncClient[] {
    return Array.from(this.clients.values()).filter(c => c.isConnected());
  }
  
  // ============================================================================
  // Event Handling
  // ============================================================================
  
  private setupEventHandlers(): void {
    // Style changes
    this.eventBus.on('STYLE_CHANGED', (event) => {
      if (event.type === 'STYLE_CHANGED') {
        this.handleStyleChanged(event);
      }
    });
    
    // Text changes
    this.eventBus.on('TEXT_CHANGED', (event) => {
      if (event.type === 'TEXT_CHANGED') {
        this.handleTextChanged(event);
      }
    });
    
    // Element selection
    this.eventBus.on('ELEMENT_SELECTED', (event) => {
      this.broadcastToClients(event, event.source);
    });
    
    // File changes (from watcher)
    this.eventBus.on('FILE_CHANGED', (event) => {
      if (event.type === 'FILE_CHANGED') {
        this.handleFileChanged(event);
      }
    });
  }
  
  /**
   * Reçoit un événement d'un client
   */
  receiveFromClient(clientId: string, event: RealmEvent): void {
    console.log(`[SyncEngine] Received from ${clientId}: ${event.type}`);
    
    // Valider l'événement
    if (!this.validateEvent(event)) {
      console.warn(`[SyncEngine] Invalid event from ${clientId}`);
      return;
    }
    
    // Debounce si nécessaire
    if (this.shouldDebounce(event)) {
      this.debounce(event);
      return;
    }
    
    // Émettre sur le bus
    this.eventBus.emit(event);
  }
  
  // ============================================================================
  // Sync Operations
  // ============================================================================
  
  /**
   * Synchronise un changement de style
   */
  private handleStyleChanged(event: RealmEvent & { type: 'STYLE_CHANGED' }): void {
    const { realmId, styles, preview, source } = event;
    
    if (preview) {
      // Mode preview: stocker sans commiter
      this.storePendingPreview(realmId, 'style', styles);
      this.broadcastToClients(event, source);
    } else {
      // Mode commit: créer une transaction
      this.commitStyleChange(realmId, styles, source);
    }
  }
  
  /**
   * Synchronise un changement de texte
   */
  private handleTextChanged(event: RealmEvent & { type: 'TEXT_CHANGED' }): void {
    const { realmId, text, preview, source } = event;
    
    if (preview) {
      this.storePendingPreview(realmId, 'text', text);
      this.broadcastToClients(event, source);
    } else {
      this.commitTextChange(realmId, text, source);
    }
  }
  
  /**
   * Gère un changement de fichier externe
   */
  private handleFileChanged(event: RealmEvent & { type: 'FILE_CHANGED' | 'FILE_CREATED' | 'FILE_DELETED' }): void {
    const { filePath, affectedRealmIds } = event;
    
    // Invalider les previews en cours pour ce fichier
    for (const [key] of this.pendingPreviews) {
      if (key.startsWith(filePath)) {
        this.pendingPreviews.delete(key);
      }
    }
    
    // Notifier les clients
    this.broadcastToClients(event);
    
    // Re-parser le fichier si nécessaire
    if (affectedRealmIds && affectedRealmIds.length > 0) {
      // Invalidation du cache du registry
      this.registry.clearFile(filePath);
    }
  }
  
  // ============================================================================
  // Commit Operations
  // ============================================================================
  
  private async commitStyleChange(
    realmId: RealmID,
    styles: Partial<ElementStyles>,
    source: EventSource
  ): Promise<void> {
    try {
      // Vérifier les conflits
      const conflict = this.checkConflict(realmId);
      if (conflict) {
        this.handleConflict(conflict, 'style', styles);
        return;
      }
      
      // Incrémenter la version
      this.incrementVersion(realmId.hash);
      
      // Émettre l'événement de commit
      const commitEvent = createEvent('TRANSACTION_STARTED' as 'STYLE_CHANGED', source, {
        realmId,
        styles,
        preview: false,
      });
      
      this.broadcastToClients(commitEvent, source);
      
      console.log(`[SyncEngine] Style change committed for ${realmId.hash}`);
      
    } catch (error) {
      console.error('[SyncEngine] Style commit error:', error);
    }
  }
  
  private async commitTextChange(
    realmId: RealmID,
    text: string,
    source: EventSource
  ): Promise<void> {
    try {
      const conflict = this.checkConflict(realmId);
      if (conflict) {
        this.handleConflict(conflict, 'text', text);
        return;
      }
      
      this.incrementVersion(realmId.hash);
      
      const commitEvent = createEvent('TEXT_CHANGED', source, {
        realmId,
        text,
        preview: false,
      });
      
      this.broadcastToClients(commitEvent, source);
      
      console.log(`[SyncEngine] Text change committed for ${realmId.hash}`);
      
    } catch (error) {
      console.error('[SyncEngine] Text commit error:', error);
    }
  }
  
  // ============================================================================
  // Preview Management
  // ============================================================================
  
  private storePendingPreview(
    realmId: RealmID,
    type: 'style' | 'text',
    value: unknown
  ): void {
    const key = `${realmId.sourceFile}:${realmId.hash}`;
    
    this.pendingPreviews.set(key, {
      realmId,
      type,
      value,
      timestamp: Date.now(),
    });
  }
  
  /**
   * Commit tous les previews en attente pour un élément
   */
  async commitPendingPreviews(realmId: RealmID): Promise<void> {
    const key = `${realmId.sourceFile}:${realmId.hash}`;
    const pending = this.pendingPreviews.get(key);
    
    if (!pending) return;
    
    if (pending.type === 'style') {
      await this.commitStyleChange(realmId, pending.value as Partial<ElementStyles>, 'system');
    } else if (pending.type === 'text') {
      await this.commitTextChange(realmId, pending.value as string, 'system');
    }
    
    this.pendingPreviews.delete(key);
  }
  
  /**
   * Public method: Commit pending changes for a RealmID
   * Called from server.ts when receiving COMMIT_REQUESTED
   */
  async commitPendingChanges(realmId: RealmID): Promise<void> {
    console.log(`[SyncEngine] commitPendingChanges for ${realmId.hash}`);
    await this.commitPendingPreviews(realmId);
  }
  
  /**
   * Public method: Rollback pending changes for a RealmID
   * Called from server.ts when receiving ROLLBACK_REQUESTED
   */
  async rollbackPendingChanges(realmId: RealmID): Promise<void> {
    console.log(`[SyncEngine] rollbackPendingChanges for ${realmId.hash}`);
    this.cancelPendingPreviews(realmId);
    
    // Emit rollback event so clients can update their state
    const rollbackEvent: RealmEvent = {
      id: `evt_rollback_${Date.now()}`,
      timestamp: Date.now(),
      type: 'TRANSACTION_ROLLED_BACK',
      source: 'system',
      transactionId: `rollback_${Date.now()}`,
      realmId,
    };
    this.eventBus.emit(rollbackEvent);
  }
  
  /**
   * Annule les previews en attente
   */
  cancelPendingPreviews(realmId?: RealmID): void {
    if (realmId) {
      const key = `${realmId.sourceFile}:${realmId.hash}`;
      this.pendingPreviews.delete(key);
    } else {
      this.pendingPreviews.clear();
    }
  }
  
  // ============================================================================
  // Conflict Resolution
  // ============================================================================
  
  private checkConflict(realmId: RealmID): ConflictInfo | null {
    const localVersion = this.versionVectors.get(realmId.hash) || 0;
    const elementVersion = realmId.version;
    
    if (elementVersion > 0 && localVersion > elementVersion) {
      return {
        realmId,
        localVersion,
        remoteVersion: elementVersion,
      };
    }
    
    return null;
  }
  
  private handleConflict(
    conflict: ConflictInfo,
    changeType: string,
    changeValue: unknown
  ): void {
    console.warn(`[SyncEngine] Conflict detected for ${conflict.realmId.hash}`);
    
    switch (this.config.conflictStrategy) {
      case 'last-write-wins':
        // Accepter le changement
        console.log('[SyncEngine] Resolving with last-write-wins');
        break;
        
      case 'first-write-wins':
        // Rejeter le changement
        console.log('[SyncEngine] Rejecting change (first-write-wins)');
        return;
        
      case 'manual':
        // Émettre un événement de conflit
        this.eventBus.emit(createEvent('SYNC_REQUESTED' as 'ELEMENT_SELECTED', 'system', {
          realmId: conflict.realmId,
        }));
        return;
    }
  }
  
  private incrementVersion(hash: string): void {
    const current = this.versionVectors.get(hash) || 0;
    this.versionVectors.set(hash, current + 1);
  }
  
  // ============================================================================
  // Broadcasting
  // ============================================================================
  
  /**
   * Diffuse un événement à tous les clients (sauf la source)
   */
  broadcastToClients(event: RealmEvent, excludeSource?: EventSource): void {
    for (const client of this.clients.values()) {
      if (!client.isConnected()) continue;
      
      // Ne pas renvoyer à la source (comparaison simplifiée)
      if (excludeSource && this.clientTypeMatchesSource(client.type, excludeSource)) continue;
      
      try {
        client.send(event);
      } catch (error) {
        console.error(`[SyncEngine] Error sending to ${client.id}:`, error);
      }
    }
  }
  
  /**
   * Envoie à un client spécifique
   */
  sendToClient(clientId: string, event: RealmEvent): void {
    const client = this.clients.get(clientId);
    if (client?.isConnected()) {
      client.send(event);
    }
  }
  
  // ============================================================================
  // Debouncing
  // ============================================================================
  
  private shouldDebounce(event: RealmEvent): boolean {
    // Debounce les events fréquents
    return ['STYLE_CHANGED', 'TEXT_CHANGED'].includes(event.type);
  }
  
  private debounce(event: RealmEvent): void {
    const key = `${event.type}:${'realmId' in event ? (event as any).realmId.hash : 'global'}`;
    
    // Clear timer existant
    const existing = this.debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    
    // Nouveau timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      this.eventBus.emit(event);
    }, this.config.debounceDelay);
    
    this.debounceTimers.set(key, timer);
  }
  
  // ============================================================================
  // Validation
  // ============================================================================
  
  private validateEvent(event: RealmEvent): boolean {
    if (!event.type || !event.source || !event.timestamp) {
      return false;
    }
    
    // Vérifier que l'événement n'est pas trop vieux (10 secondes)
    if (Date.now() - event.timestamp > 10000) {
      console.warn('[SyncEngine] Event too old, discarding');
      return false;
    }
    
    return true;
  }
  
  /**
   * Vérifie si le type de client correspond à une source
   */
  private clientTypeMatchesSource(clientType: string, source: EventSource): boolean {
    const mapping: Record<string, EventSource[]> = {
      'websocket': ['panel', 'editor'],
      'postmessage': ['dom'],
      'internal': ['system', 'file-watcher'],
    };
    return mapping[clientType]?.includes(source) ?? false;
  }
  
  // ============================================================================
  // Cleanup
  // ============================================================================
  
  /**
   * Nettoie les ressources
   */
  cleanup(): void {
    // Clear tous les timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    
    // Clear les clients
    this.clients.clear();
    
    // Clear les previews
    this.pendingPreviews.clear();
  }
}

// ============================================================================
// Types internes
// ============================================================================

interface PendingPreview {
  realmId: RealmID;
  type: 'style' | 'text';
  value: unknown;
  timestamp: number;
}
