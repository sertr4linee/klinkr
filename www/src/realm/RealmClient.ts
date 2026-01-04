/**
 * REALM Protocol - Web Client
 * 
 * Client WebSocket pour la synchronisation avec l'extension.
 */

import type { 
  RealmEvent, 
  RealmID, 
  EventSource,
  ElementStyles,
  StyleChangedEvent,
  TextChangedEvent,
} from './types';

// ============================================================================
// Types
// ============================================================================

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export type EventHandler<T extends RealmEvent = RealmEvent> = (event: T) => void;

export interface RealmClientConfig {
  /** URL du WebSocket */
  wsUrl: string;
  /** Auto-reconnect */
  autoReconnect: boolean;
  /** Délai de reconnexion (ms) */
  reconnectDelay: number;
  /** Nombre max de tentatives */
  maxReconnectAttempts: number;
}

const DEFAULT_CONFIG: RealmClientConfig = {
  wsUrl: 'ws://localhost:57129',
  autoReconnect: true,
  reconnectDelay: 1000,
  maxReconnectAttempts: 10,
};

// ============================================================================
// REALM Client
// ============================================================================

export class RealmClient {
  private config: RealmClientConfig;
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  
  /** Event handlers */
  private handlers: Map<string, Set<EventHandler>> = new Map();
  
  /** State change listeners */
  private stateListeners: Set<(state: ConnectionState) => void> = new Set();
  
  /** Message queue (quand déconnecté) */
  private messageQueue: RealmEvent[] = [];
  
  /** Event ID counter */
  private eventIdCounter = 0;
  
  constructor(config: Partial<RealmClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  // ============================================================================
  // Connection
  // ============================================================================
  
  /**
   * Se connecte au serveur REALM
   */
  connect(): void {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }
    
    this.setState('connecting');
    
    try {
      this.ws = new WebSocket(this.config.wsUrl);
      
      this.ws.onopen = () => {
        console.log('[RealmClient] Connected');
        this.setState('connected');
        this.reconnectAttempts = 0;
        this.flushMessageQueue();
      };
      
      this.ws.onclose = () => {
        console.log('[RealmClient] Disconnected');
        this.setState('disconnected');
        this.ws = null;
        
        if (this.config.autoReconnect) {
          this.scheduleReconnect();
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('[RealmClient] Error:', error);
        this.setState('error');
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
      
    } catch (error) {
      console.error('[RealmClient] Connection error:', error);
      this.setState('error');
    }
  }
  
  /**
   * Se déconnecte
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.setState('disconnected');
  }
  
  /**
   * Retourne l'état de connexion
   */
  getState(): ConnectionState {
    return this.state;
  }
  
  /**
   * Vérifie si connecté
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }
  
  // ============================================================================
  // Event Sending
  // ============================================================================
  
  /**
   * Envoie un événement au serveur
   */
  send(event: RealmEvent): void {
    if (this.state !== 'connected' || !this.ws) {
      // Queue le message pour envoi ultérieur
      this.messageQueue.push(event);
      return;
    }
    
    try {
      const message = JSON.stringify({
        type: 'realm_event',
        payload: event,
      });
      this.ws.send(message);
    } catch (error) {
      console.error('[RealmClient] Send error:', error);
      this.messageQueue.push(event);
    }
  }
  
  /**
   * Envoie un changement de style
   */
  sendStyleChange(
    realmId: RealmID,
    styles: Partial<ElementStyles>,
    preview = true
  ): void {
    const event: StyleChangedEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'STYLE_CHANGED',
      source: 'panel',
      realmId,
      styles,
      preview,
    };
    this.send(event);
  }
  
  /**
   * Envoie un changement de texte
   */
  sendTextChange(
    realmId: RealmID,
    text: string,
    preview = true
  ): void {
    const event: TextChangedEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'TEXT_CHANGED',
      source: 'panel',
      realmId,
      text,
      preview,
    };
    this.send(event);
  }
  
  /**
   * Envoie une sélection d'élément
   */
  sendElementSelected(realmId: RealmID, bounds?: { x: number; y: number; width: number; height: number }): void {
    this.send({
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'ELEMENT_SELECTED',
      source: 'panel',
      realmId,
      bounds,
    });
  }
  
  /**
   * Envoie une demande de commit (persister les changements)
   */
  sendCommit(realmId: RealmID): void {
    this.send({
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'COMMIT_REQUESTED',
      source: 'panel',
      realmId,
    });
  }
  
  /**
   * Envoie une demande de rollback (annuler les changements preview)
   */
  sendRollback(realmId: RealmID): void {
    this.send({
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'ROLLBACK_REQUESTED',
      source: 'panel',
      realmId,
    });
  }
  
  // ============================================================================
  // Event Receiving
  // ============================================================================
  
  /**
   * S'abonne à un type d'événement
   */
  on<T extends RealmEvent>(
    eventType: T['type'] | '*',
    handler: EventHandler<T>
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as EventHandler);
    
    // Retourne fonction de désabonnement
    return () => {
      this.handlers.get(eventType)?.delete(handler as EventHandler);
    };
  }
  
  /**
   * S'abonne une seule fois
   */
  once<T extends RealmEvent>(
    eventType: T['type'],
    handler: EventHandler<T>
  ): () => void {
    const unsubscribe = this.on(eventType, (event) => {
      unsubscribe();
      handler(event as T);
    });
    return unsubscribe;
  }
  
  /**
   * S'abonne aux changements d'état
   */
  onStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'realm_event' && message.payload) {
        const event = message.payload as RealmEvent;
        this.dispatchEvent(event);
      }
    } catch (error) {
      console.error('[RealmClient] Message parse error:', error);
    }
  }
  
  private dispatchEvent(event: RealmEvent): void {
    // Handlers spécifiques
    const typeHandlers = this.handlers.get(event.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        try {
          handler(event);
        } catch (error) {
          console.error('[RealmClient] Handler error:', error);
        }
      }
    }
    
    // Handlers wildcard
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          handler(event);
        } catch (error) {
          console.error('[RealmClient] Wildcard handler error:', error);
        }
      }
    }
  }
  
  private setState(state: ConnectionState): void {
    this.state = state;
    for (const listener of this.stateListeners) {
      try {
        listener(state);
      } catch (error) {
        console.error('[RealmClient] State listener error:', error);
      }
    }
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('[RealmClient] Max reconnect attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`[RealmClient] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
  
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const event = this.messageQueue.shift();
      if (event) {
        this.send(event);
      }
    }
  }
  
  private generateEventId(): string {
    return `evt_${++this.eventIdCounter}_${Date.now()}`;
  }
}

// ============================================================================
// Singleton
// ============================================================================

let clientInstance: RealmClient | null = null;

export function getRealmClient(config?: Partial<RealmClientConfig>): RealmClient {
  if (!clientInstance) {
    clientInstance = new RealmClient(config);
  }
  return clientInstance;
}

export function resetRealmClient(): void {
  if (clientInstance) {
    clientInstance.disconnect();
    clientInstance = null;
  }
}
