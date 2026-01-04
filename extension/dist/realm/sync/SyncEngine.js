"use strict";
/**
 * REALM Protocol - Sync Engine
 *
 * Orchestre la synchronisation entre les différentes sources:
 * - Extension (server.ts)
 * - Panel Web (WebSocket)
 * - DOM Preview (PostMessage/iframe)
 * - File Watcher
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncEngine = void 0;
const EventBus_1 = require("./EventBus");
const ElementRegistry_1 = require("../ElementRegistry");
const TransactionManager_1 = require("../TransactionManager");
const DEFAULT_CONFIG = {
    debounceDelay: 50,
    conflictStrategy: 'last-write-wins',
    previewMode: false,
};
// ============================================================================
// Sync Engine
// ============================================================================
class SyncEngine {
    static instance;
    eventBus;
    registry;
    txManager;
    /** Clients connectés */
    clients = new Map();
    /** Config */
    config;
    /** Debounce timers */
    debounceTimers = new Map();
    /** Version vectors pour conflict detection */
    versionVectors = new Map();
    /** Pending previews (pas encore commités) */
    pendingPreviews = new Map();
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.eventBus = EventBus_1.EventBus.getInstance();
        this.registry = ElementRegistry_1.ElementRegistry.getInstance();
        this.txManager = TransactionManager_1.TransactionManager.getInstance();
        this.setupEventHandlers();
    }
    static getInstance() {
        if (!SyncEngine.instance) {
            SyncEngine.instance = new SyncEngine();
        }
        return SyncEngine.instance;
    }
    static resetInstance() {
        SyncEngine.instance = new SyncEngine();
    }
    // ============================================================================
    // Client Management
    // ============================================================================
    /**
     * Enregistre un client
     */
    registerClient(client) {
        this.clients.set(client.id, client);
        console.log(`[SyncEngine] Client registered: ${client.id} (${client.type})`);
    }
    /**
     * Désenregistre un client
     */
    unregisterClient(clientId) {
        this.clients.delete(clientId);
        console.log(`[SyncEngine] Client unregistered: ${clientId}`);
    }
    /**
     * Récupère un client
     */
    getClient(clientId) {
        return this.clients.get(clientId);
    }
    /**
     * Liste les clients connectés
     */
    getConnectedClients() {
        return Array.from(this.clients.values()).filter(c => c.isConnected());
    }
    // ============================================================================
    // Event Handling
    // ============================================================================
    setupEventHandlers() {
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
    receiveFromClient(clientId, event) {
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
    handleStyleChanged(event) {
        const { realmId, styles, preview, source } = event;
        if (preview) {
            // Mode preview: stocker sans commiter
            this.storePendingPreview(realmId, 'style', styles);
            this.broadcastToClients(event, source);
        }
        else {
            // Mode commit: créer une transaction
            this.commitStyleChange(realmId, styles, source);
        }
    }
    /**
     * Synchronise un changement de texte
     */
    handleTextChanged(event) {
        const { realmId, text, preview, source } = event;
        if (preview) {
            this.storePendingPreview(realmId, 'text', text);
            this.broadcastToClients(event, source);
        }
        else {
            this.commitTextChange(realmId, text, source);
        }
    }
    /**
     * Gère un changement de fichier externe
     */
    handleFileChanged(event) {
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
    async commitStyleChange(realmId, styles, source) {
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
            const commitEvent = (0, EventBus_1.createEvent)('TRANSACTION_STARTED', source, {
                realmId,
                styles,
                preview: false,
            });
            this.broadcastToClients(commitEvent, source);
            console.log(`[SyncEngine] Style change committed for ${realmId.hash}`);
        }
        catch (error) {
            console.error('[SyncEngine] Style commit error:', error);
        }
    }
    async commitTextChange(realmId, text, source) {
        try {
            const conflict = this.checkConflict(realmId);
            if (conflict) {
                this.handleConflict(conflict, 'text', text);
                return;
            }
            this.incrementVersion(realmId.hash);
            const commitEvent = (0, EventBus_1.createEvent)('TEXT_CHANGED', source, {
                realmId,
                text,
                preview: false,
            });
            this.broadcastToClients(commitEvent, source);
            console.log(`[SyncEngine] Text change committed for ${realmId.hash}`);
        }
        catch (error) {
            console.error('[SyncEngine] Text commit error:', error);
        }
    }
    // ============================================================================
    // Preview Management
    // ============================================================================
    storePendingPreview(realmId, type, value) {
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
    async commitPendingPreviews(realmId) {
        const key = `${realmId.sourceFile}:${realmId.hash}`;
        const pending = this.pendingPreviews.get(key);
        if (!pending)
            return;
        if (pending.type === 'style') {
            await this.commitStyleChange(realmId, pending.value, 'system');
        }
        else if (pending.type === 'text') {
            await this.commitTextChange(realmId, pending.value, 'system');
        }
        this.pendingPreviews.delete(key);
    }
    /**
     * Public method: Commit pending changes for a RealmID
     * Called from server.ts when receiving COMMIT_REQUESTED
     */
    async commitPendingChanges(realmId) {
        console.log(`[SyncEngine] commitPendingChanges for ${realmId.hash}`);
        await this.commitPendingPreviews(realmId);
    }
    /**
     * Public method: Rollback pending changes for a RealmID
     * Called from server.ts when receiving ROLLBACK_REQUESTED
     */
    async rollbackPendingChanges(realmId) {
        console.log(`[SyncEngine] rollbackPendingChanges for ${realmId.hash}`);
        this.cancelPendingPreviews(realmId);
        // Emit rollback event so clients can update their state
        const rollbackEvent = {
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
    cancelPendingPreviews(realmId) {
        if (realmId) {
            const key = `${realmId.sourceFile}:${realmId.hash}`;
            this.pendingPreviews.delete(key);
        }
        else {
            this.pendingPreviews.clear();
        }
    }
    // ============================================================================
    // Conflict Resolution
    // ============================================================================
    checkConflict(realmId) {
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
    handleConflict(conflict, changeType, changeValue) {
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
                this.eventBus.emit((0, EventBus_1.createEvent)('SYNC_REQUESTED', 'system', {
                    realmId: conflict.realmId,
                }));
                return;
        }
    }
    incrementVersion(hash) {
        const current = this.versionVectors.get(hash) || 0;
        this.versionVectors.set(hash, current + 1);
    }
    // ============================================================================
    // Broadcasting
    // ============================================================================
    /**
     * Diffuse un événement à tous les clients (sauf la source)
     */
    broadcastToClients(event, excludeSource) {
        for (const client of this.clients.values()) {
            if (!client.isConnected())
                continue;
            // Ne pas renvoyer à la source (comparaison simplifiée)
            if (excludeSource && this.clientTypeMatchesSource(client.type, excludeSource))
                continue;
            try {
                client.send(event);
            }
            catch (error) {
                console.error(`[SyncEngine] Error sending to ${client.id}:`, error);
            }
        }
    }
    /**
     * Envoie à un client spécifique
     */
    sendToClient(clientId, event) {
        const client = this.clients.get(clientId);
        if (client?.isConnected()) {
            client.send(event);
        }
    }
    // ============================================================================
    // Debouncing
    // ============================================================================
    shouldDebounce(event) {
        // Debounce les events fréquents
        return ['STYLE_CHANGED', 'TEXT_CHANGED'].includes(event.type);
    }
    debounce(event) {
        const key = `${event.type}:${'realmId' in event ? event.realmId.hash : 'global'}`;
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
    validateEvent(event) {
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
    clientTypeMatchesSource(clientType, source) {
        const mapping = {
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
    cleanup() {
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
exports.SyncEngine = SyncEngine;
//# sourceMappingURL=SyncEngine.js.map