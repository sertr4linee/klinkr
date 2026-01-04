"use strict";
/**
 * REALM Protocol - Adapter Registry
 *
 * Gère l'enregistrement et la sélection automatique des adapters.
 * Utilise une chaîne de priorité pour la détection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdapterRegistry = void 0;
exports.registerAdapters = registerAdapters;
// ============================================================================
// Adapter Registry
// ============================================================================
class AdapterRegistry {
    static instance;
    /** Adapters enregistrés, triés par priorité */
    adapters = [];
    /** Cache de détection: filePath → adapterName */
    detectionCache = new Map();
    /** Max cache size */
    maxCacheSize = 500;
    constructor() { }
    static getInstance() {
        if (!AdapterRegistry.instance) {
            AdapterRegistry.instance = new AdapterRegistry();
        }
        return AdapterRegistry.instance;
    }
    static resetInstance() {
        AdapterRegistry.instance = new AdapterRegistry();
    }
    // ============================================================================
    // Registration
    // ============================================================================
    /**
     * Enregistre un adapter
     */
    register(adapter) {
        // Éviter les doublons
        const existing = this.adapters.findIndex(a => a.name === adapter.name);
        if (existing !== -1) {
            this.adapters[existing] = adapter;
        }
        else {
            this.adapters.push(adapter);
        }
        // Trier par priorité décroissante
        this.adapters.sort((a, b) => b.priority - a.priority);
        // Invalider le cache
        this.detectionCache.clear();
        console.log(`[AdapterRegistry] Registered: ${adapter.name} (priority: ${adapter.priority})`);
    }
    /**
     * Désenregistre un adapter
     */
    unregister(name) {
        const index = this.adapters.findIndex(a => a.name === name);
        if (index === -1)
            return false;
        this.adapters.splice(index, 1);
        this.detectionCache.clear();
        console.log(`[AdapterRegistry] Unregistered: ${name}`);
        return true;
    }
    // ============================================================================
    // Detection
    // ============================================================================
    /**
     * Détecte l'adapter approprié pour un fichier
     */
    detect(filePath, content) {
        // Vérifier le cache
        const cached = this.detectionCache.get(filePath);
        if (cached) {
            const adapter = this.adapters.find(a => a.name === cached);
            if (adapter)
                return adapter;
        }
        // Parcourir les adapters par priorité
        for (const adapter of this.adapters) {
            try {
                if (adapter.detect(filePath, content)) {
                    this.cacheDetection(filePath, adapter.name);
                    console.log(`[AdapterRegistry] Detected: ${adapter.name} for ${filePath}`);
                    return adapter;
                }
            }
            catch (error) {
                console.warn(`[AdapterRegistry] Detection error in ${adapter.name}:`, error);
            }
        }
        console.warn(`[AdapterRegistry] No adapter found for ${filePath}`);
        return null;
    }
    /**
     * Récupère un adapter par son nom
     */
    get(name) {
        return this.adapters.find(a => a.name === name);
    }
    /**
     * Récupère tous les adapters
     */
    getAll() {
        return [...this.adapters];
    }
    /**
     * Liste les noms des adapters enregistrés
     */
    listNames() {
        return this.adapters.map(a => a.name);
    }
    // ============================================================================
    // Cache Management
    // ============================================================================
    cacheDetection(filePath, adapterName) {
        // Pruning si nécessaire
        if (this.detectionCache.size >= this.maxCacheSize) {
            const keys = Array.from(this.detectionCache.keys());
            for (let i = 0; i < 50; i++) {
                this.detectionCache.delete(keys[i]);
            }
        }
        this.detectionCache.set(filePath, adapterName);
    }
    /**
     * Invalide le cache pour un fichier
     */
    invalidateCache(filePath) {
        this.detectionCache.delete(filePath);
    }
    /**
     * Vide tout le cache
     */
    clearCache() {
        this.detectionCache.clear();
    }
    /**
     * Retourne la taille du cache
     */
    get cacheSize() {
        return this.detectionCache.size;
    }
}
exports.AdapterRegistry = AdapterRegistry;
// ============================================================================
// Helper: Auto-register adapters
// ============================================================================
/**
 * Enregistre tous les adapters fournis
 */
function registerAdapters(adapters) {
    const registry = AdapterRegistry.getInstance();
    for (const adapter of adapters) {
        registry.register(adapter);
    }
}
//# sourceMappingURL=AdapterRegistry.js.map