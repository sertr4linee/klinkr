/**
 * REALM Protocol - Event Bus
 * 
 * Système pub/sub pour la communication entre composants.
 * Centralise tous les événements REALM.
 */

import type { RealmEvent, EventSource } from '../types';

// ============================================================================
// Types
// ============================================================================

export type EventHandler<T extends RealmEvent = RealmEvent> = (event: T) => void;

export interface Subscription {
  id: string;
  eventType: string | '*';
  handler: EventHandler;
  source?: EventSource;
}

export interface EventBusStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  subscriberCount: number;
  historySize: number;
}

// ============================================================================
// Event Bus
// ============================================================================

export class EventBus {
  private static instance: EventBus;
  
  /** Subscriptions actives */
  private subscriptions: Map<string, Subscription> = new Map();
  
  /** Index par type d'event */
  private byType: Map<string, Set<string>> = new Map();
  
  /** Historique des events (pour debug) */
  private history: RealmEvent[] = [];
  
  /** Max history size */
  private maxHistorySize = 100;
  
  /** Compteur d'events */
  private eventCount = 0;
  
  /** Stats par type */
  private eventsByType: Map<string, number> = new Map();
  
  /** ID counter pour subscriptions */
  private subscriptionIdCounter = 0;
  
  private constructor() {}
  
  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }
  
  public static resetInstance(): void {
    EventBus.instance = new EventBus();
  }
  
  // ============================================================================
  // Subscribe
  // ============================================================================
  
  /**
   * S'abonne à un type d'événement
   */
  on<T extends RealmEvent>(
    eventType: T['type'] | '*',
    handler: EventHandler<T>,
    options: { source?: EventSource } = {}
  ): () => void {
    const id = `sub_${++this.subscriptionIdCounter}`;
    
    const subscription: Subscription = {
      id,
      eventType,
      handler: handler as EventHandler,
      source: options.source,
    };
    
    this.subscriptions.set(id, subscription);
    
    // Ajouter à l'index par type
    if (!this.byType.has(eventType)) {
      this.byType.set(eventType, new Set());
    }
    this.byType.get(eventType)!.add(id);
    
    console.log(`[EventBus] Subscribed: ${id} to ${eventType}`);
    
    // Retourner fonction de unsubscribe
    return () => this.off(id);
  }
  
  /**
   * S'abonne à un événement une seule fois
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
   * Se désabonne
   */
  off(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;
    
    this.subscriptions.delete(subscriptionId);
    this.byType.get(subscription.eventType)?.delete(subscriptionId);
    
    console.log(`[EventBus] Unsubscribed: ${subscriptionId}`);
  }
  
  /**
   * Supprime tous les handlers pour un type
   */
  offAll(eventType?: string): void {
    if (eventType) {
      const ids = this.byType.get(eventType);
      if (ids) {
        for (const id of ids) {
          this.subscriptions.delete(id);
        }
        this.byType.delete(eventType);
      }
    } else {
      this.subscriptions.clear();
      this.byType.clear();
    }
  }
  
  // ============================================================================
  // Emit
  // ============================================================================
  
  /**
   * Émet un événement
   */
  emit(event: RealmEvent): void {
    this.eventCount++;
    
    // Stats
    const count = this.eventsByType.get(event.type) || 0;
    this.eventsByType.set(event.type, count + 1);
    
    // Historique
    this.addToHistory(event);
    
    // Trouver les handlers
    const handlers = this.getHandlers(event);
    
    console.log(`[EventBus] Emit: ${event.type} (${handlers.length} handlers)`);
    
    // Exécuter les handlers
    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error(`[EventBus] Handler error for ${event.type}:`, error);
      }
    }
  }
  
  /**
   * Émet un événement de manière asynchrone
   */
  async emitAsync(event: RealmEvent): Promise<void> {
    this.eventCount++;
    
    const count = this.eventsByType.get(event.type) || 0;
    this.eventsByType.set(event.type, count + 1);
    
    this.addToHistory(event);
    
    const handlers = this.getHandlers(event);
    
    console.log(`[EventBus] EmitAsync: ${event.type} (${handlers.length} handlers)`);
    
    // Exécuter en parallèle
    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await handler(event);
        } catch (error) {
          console.error(`[EventBus] Async handler error for ${event.type}:`, error);
        }
      })
    );
  }
  
  // ============================================================================
  // Query
  // ============================================================================
  
  /**
   * Récupère l'historique des events
   */
  getHistory(filter?: { type?: string; source?: EventSource; limit?: number }): RealmEvent[] {
    let results = [...this.history];
    
    if (filter?.type) {
      results = results.filter(e => e.type === filter.type);
    }
    
    if (filter?.source) {
      results = results.filter(e => e.source === filter.source);
    }
    
    if (filter?.limit) {
      results = results.slice(-filter.limit);
    }
    
    return results;
  }
  
  /**
   * Récupère les stats
   */
  getStats(): EventBusStats {
    return {
      totalEvents: this.eventCount,
      eventsByType: Object.fromEntries(this.eventsByType),
      subscriberCount: this.subscriptions.size,
      historySize: this.history.length,
    };
  }
  
  /**
   * Vérifie si un type a des subscribers
   */
  hasSubscribers(eventType: string): boolean {
    const typeIds = this.byType.get(eventType)?.size || 0;
    const wildcardIds = this.byType.get('*')?.size || 0;
    return typeIds + wildcardIds > 0;
  }
  
  // ============================================================================
  // Private Helpers
  // ============================================================================
  
  private getHandlers(event: RealmEvent): EventHandler[] {
    const handlers: EventHandler[] = [];
    
    // Handlers spécifiques au type
    const typeIds = this.byType.get(event.type);
    if (typeIds) {
      for (const id of typeIds) {
        const sub = this.subscriptions.get(id);
        if (sub && (!sub.source || sub.source === event.source)) {
          handlers.push(sub.handler);
        }
      }
    }
    
    // Handlers wildcard (*)
    const wildcardIds = this.byType.get('*');
    if (wildcardIds) {
      for (const id of wildcardIds) {
        const sub = this.subscriptions.get(id);
        if (sub && (!sub.source || sub.source === event.source)) {
          handlers.push(sub.handler);
        }
      }
    }
    
    return handlers;
  }
  
  private addToHistory(event: RealmEvent): void {
    this.history.push(event);
    
    // Pruning
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }
  }
  
  /**
   * Vide l'historique
   */
  clearHistory(): void {
    this.history = [];
  }
}

// ============================================================================
// Helper: Create typed event
// ============================================================================

let eventIdCounter = 0;

/**
 * Crée un événement REALM avec les champs de base
 */
export function createEvent<T extends RealmEvent['type']>(
  type: T,
  source: EventSource,
  data: Omit<Extract<RealmEvent, { type: T }>, 'id' | 'timestamp' | 'source' | 'type'>
): Extract<RealmEvent, { type: T }> {
  return {
    id: `evt_${++eventIdCounter}_${Date.now()}`,
    timestamp: Date.now(),
    type,
    source,
    ...data,
  } as Extract<RealmEvent, { type: T }>;
}
