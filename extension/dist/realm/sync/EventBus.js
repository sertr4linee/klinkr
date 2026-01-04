"use strict";
/**
 * REALM Protocol - Event Bus
 *
 * Système pub/sub pour la communication entre composants.
 * Centralise tous les événements REALM.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventBus = void 0;
exports.createEvent = createEvent;
// ============================================================================
// Event Bus
// ============================================================================
class EventBus {
    static instance;
    /** Subscriptions actives */
    subscriptions = new Map();
    /** Index par type d'event */
    byType = new Map();
    /** Historique des events (pour debug) */
    history = [];
    /** Max history size */
    maxHistorySize = 100;
    /** Compteur d'events */
    eventCount = 0;
    /** Stats par type */
    eventsByType = new Map();
    /** ID counter pour subscriptions */
    subscriptionIdCounter = 0;
    constructor() { }
    static getInstance() {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }
    static resetInstance() {
        EventBus.instance = new EventBus();
    }
    // ============================================================================
    // Subscribe
    // ============================================================================
    /**
     * S'abonne à un type d'événement
     */
    on(eventType, handler, options = {}) {
        const id = `sub_${++this.subscriptionIdCounter}`;
        const subscription = {
            id,
            eventType,
            handler: handler,
            source: options.source,
        };
        this.subscriptions.set(id, subscription);
        // Ajouter à l'index par type
        if (!this.byType.has(eventType)) {
            this.byType.set(eventType, new Set());
        }
        this.byType.get(eventType).add(id);
        console.log(`[EventBus] Subscribed: ${id} to ${eventType}`);
        // Retourner fonction de unsubscribe
        return () => this.off(id);
    }
    /**
     * S'abonne à un événement une seule fois
     */
    once(eventType, handler) {
        const unsubscribe = this.on(eventType, (event) => {
            unsubscribe();
            handler(event);
        });
        return unsubscribe;
    }
    /**
     * Se désabonne
     */
    off(subscriptionId) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription)
            return;
        this.subscriptions.delete(subscriptionId);
        this.byType.get(subscription.eventType)?.delete(subscriptionId);
        console.log(`[EventBus] Unsubscribed: ${subscriptionId}`);
    }
    /**
     * Supprime tous les handlers pour un type
     */
    offAll(eventType) {
        if (eventType) {
            const ids = this.byType.get(eventType);
            if (ids) {
                for (const id of ids) {
                    this.subscriptions.delete(id);
                }
                this.byType.delete(eventType);
            }
        }
        else {
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
    emit(event) {
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
            }
            catch (error) {
                console.error(`[EventBus] Handler error for ${event.type}:`, error);
            }
        }
    }
    /**
     * Émet un événement de manière asynchrone
     */
    async emitAsync(event) {
        this.eventCount++;
        const count = this.eventsByType.get(event.type) || 0;
        this.eventsByType.set(event.type, count + 1);
        this.addToHistory(event);
        const handlers = this.getHandlers(event);
        console.log(`[EventBus] EmitAsync: ${event.type} (${handlers.length} handlers)`);
        // Exécuter en parallèle
        await Promise.all(handlers.map(async (handler) => {
            try {
                await handler(event);
            }
            catch (error) {
                console.error(`[EventBus] Async handler error for ${event.type}:`, error);
            }
        }));
    }
    // ============================================================================
    // Query
    // ============================================================================
    /**
     * Récupère l'historique des events
     */
    getHistory(filter) {
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
    getStats() {
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
    hasSubscribers(eventType) {
        const typeIds = this.byType.get(eventType)?.size || 0;
        const wildcardIds = this.byType.get('*')?.size || 0;
        return typeIds + wildcardIds > 0;
    }
    // ============================================================================
    // Private Helpers
    // ============================================================================
    getHandlers(event) {
        const handlers = [];
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
    addToHistory(event) {
        this.history.push(event);
        // Pruning
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(-this.maxHistorySize);
        }
    }
    /**
     * Vide l'historique
     */
    clearHistory() {
        this.history = [];
    }
}
exports.EventBus = EventBus;
// ============================================================================
// Helper: Create typed event
// ============================================================================
let eventIdCounter = 0;
/**
 * Crée un événement REALM avec les champs de base
 */
function createEvent(type, source, data) {
    return {
        id: `evt_${++eventIdCounter}_${Date.now()}`,
        timestamp: Date.now(),
        type,
        source,
        ...data,
    };
}
//# sourceMappingURL=EventBus.js.map