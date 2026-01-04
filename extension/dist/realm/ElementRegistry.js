"use strict";
/**
 * REALM Protocol - Element Registry
 *
 * Registry centralisé pour tous les éléments trackés.
 * Single Source of Truth pour les mappings RealmID ↔ ElementInfo.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElementRegistry = void 0;
const RealmID_1 = require("./RealmID");
/**
 * Registry singleton pour les éléments REALM
 */
class ElementRegistry {
    static instance;
    /** Map principale: hash → ElementInfo */
    elements = new Map();
    /** Index secondaire: filePath → Set<hash> */
    byFile = new Map();
    /** Index secondaire: componentName → Set<hash> */
    byComponent = new Map();
    /** Listeners pour les changements */
    listeners = new Set();
    constructor() { }
    /**
     * Obtient l'instance singleton
     */
    static getInstance() {
        if (!ElementRegistry.instance) {
            ElementRegistry.instance = new ElementRegistry();
        }
        return ElementRegistry.instance;
    }
    /**
     * Réinitialise le registry (pour tests)
     */
    static resetInstance() {
        ElementRegistry.instance = new ElementRegistry();
    }
    // ============================================================================
    // CRUD Operations
    // ============================================================================
    /**
     * Enregistre ou met à jour un élément
     */
    register(info) {
        const hash = info.realmId.hash;
        const isNew = !this.elements.has(hash);
        // Stocker dans la map principale
        this.elements.set(hash, info);
        // Mettre à jour les index secondaires
        this.addToIndex(this.byFile, info.realmId.sourceFile, hash);
        this.addToIndex(this.byComponent, info.realmId.componentName, hash);
        // Notifier les listeners
        this.notify({
            type: isNew ? 'registered' : 'updated',
            realmId: info.realmId,
            info,
        });
        console.log(`[Registry] ${isNew ? 'Registered' : 'Updated'}: ${(0, RealmID_1.toDebugString)(info.realmId)}`);
    }
    /**
     * Supprime un élément du registry
     */
    unregister(realmId) {
        const hash = realmId.hash;
        const info = this.elements.get(hash);
        if (!info) {
            return false;
        }
        // Supprimer de la map principale
        this.elements.delete(hash);
        // Supprimer des index secondaires
        this.removeFromIndex(this.byFile, info.realmId.sourceFile, hash);
        this.removeFromIndex(this.byComponent, info.realmId.componentName, hash);
        // Notifier les listeners
        this.notify({
            type: 'unregistered',
            realmId,
            info,
        });
        console.log(`[Registry] Unregistered: ${(0, RealmID_1.toDebugString)(realmId)}`);
        return true;
    }
    /**
     * Récupère un élément par son RealmID
     */
    get(realmId) {
        return this.elements.get(realmId.hash);
    }
    /**
     * Récupère un élément par son hash
     */
    getByHash(hash) {
        return this.elements.get(hash);
    }
    /**
     * Vérifie si un élément existe
     */
    has(realmId) {
        return this.elements.has(realmId.hash);
    }
    // ============================================================================
    // Query Operations
    // ============================================================================
    /**
     * Récupère tous les éléments d'un fichier
     */
    getByFile(filePath) {
        const hashes = this.byFile.get(filePath);
        if (!hashes)
            return [];
        return Array.from(hashes)
            .map(hash => this.elements.get(hash))
            .filter((info) => info !== undefined);
    }
    /**
     * Récupère tous les éléments d'un composant
     */
    getByComponent(componentName) {
        const hashes = this.byComponent.get(componentName);
        if (!hashes)
            return [];
        return Array.from(hashes)
            .map(hash => this.elements.get(hash))
            .filter((info) => info !== undefined);
    }
    /**
     * Trouve un élément par sa position dans le source
     */
    findByPosition(filePath, line, column) {
        const fileElements = this.getByFile(filePath);
        return fileElements.find(info => {
            const loc = info.realmId.sourceLocation;
            return (line >= loc.start.line &&
                line <= loc.end.line &&
                (line > loc.start.line || column >= loc.start.column) &&
                (line < loc.end.line || column <= loc.end.column));
        });
    }
    /**
     * Trouve un élément par sélecteur CSS (fallback)
     */
    findBySelector(selector, filePath) {
        const elements = filePath ? this.getByFile(filePath) : Array.from(this.elements.values());
        // Parse le sélecteur pour extraire tag, id, classes
        const tagMatch = selector.match(/^(\w+)/);
        const idMatch = selector.match(/#([\w-]+)/);
        const classMatches = selector.match(/\.([\w-]+)/g);
        const targetTag = tagMatch?.[1]?.toLowerCase();
        const targetId = idMatch?.[1];
        const targetClasses = classMatches?.map(c => c.slice(1)) || [];
        return elements.find(info => {
            // Match tag
            if (targetTag && info.tagName.toLowerCase() !== targetTag) {
                return false;
            }
            // Match id
            if (targetId && info.attributes.id !== targetId) {
                return false;
            }
            // Match classes
            if (targetClasses.length > 0 && info.attributes.className) {
                const elementClasses = info.attributes.className.split(/\s+/);
                const matchCount = targetClasses.filter(c => elementClasses.includes(c)).length;
                // Au moins 50% des classes doivent matcher
                if (matchCount / targetClasses.length < 0.5) {
                    return false;
                }
            }
            return true;
        });
    }
    /**
     * Retourne tous les éléments
     */
    getAll() {
        return Array.from(this.elements.values());
    }
    /**
     * Retourne le nombre d'éléments
     */
    get size() {
        return this.elements.size;
    }
    /**
     * Retourne les stats du registry
     */
    getStats() {
        const fileCount = this.byFile.size;
        const componentCount = this.byComponent.size;
        return {
            totalElements: this.elements.size,
            fileCount,
            componentCount,
            elementsPerFile: fileCount > 0 ? Math.round(this.elements.size / fileCount) : 0,
        };
    }
    // ============================================================================
    // Bulk Operations
    // ============================================================================
    /**
     * Supprime tous les éléments d'un fichier
     */
    clearFile(filePath) {
        const hashes = this.byFile.get(filePath);
        if (!hashes)
            return 0;
        let count = 0;
        for (const hash of hashes) {
            const info = this.elements.get(hash);
            if (info) {
                this.elements.delete(hash);
                this.removeFromIndex(this.byComponent, info.realmId.componentName, hash);
                count++;
            }
        }
        this.byFile.delete(filePath);
        console.log(`[Registry] Cleared ${count} elements from ${filePath}`);
        return count;
    }
    /**
     * Vide le registry
     */
    clear() {
        const count = this.elements.size;
        this.elements.clear();
        this.byFile.clear();
        this.byComponent.clear();
        console.log(`[Registry] Cleared all ${count} elements`);
    }
    // ============================================================================
    // Listeners
    // ============================================================================
    /**
     * Ajoute un listener pour les changements
     */
    addListener(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    /**
     * Supprime un listener
     */
    removeListener(listener) {
        this.listeners.delete(listener);
    }
    notify(event) {
        for (const listener of this.listeners) {
            try {
                listener(event);
            }
            catch (error) {
                console.error('[Registry] Listener error:', error);
            }
        }
    }
    // ============================================================================
    // Helpers
    // ============================================================================
    addToIndex(index, key, hash) {
        let set = index.get(key);
        if (!set) {
            set = new Set();
            index.set(key, set);
        }
        set.add(hash);
    }
    removeFromIndex(index, key, hash) {
        const set = index.get(key);
        if (set) {
            set.delete(hash);
            if (set.size === 0) {
                index.delete(key);
            }
        }
    }
}
exports.ElementRegistry = ElementRegistry;
//# sourceMappingURL=ElementRegistry.js.map