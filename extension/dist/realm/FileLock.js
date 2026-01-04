"use strict";
/**
 * REALM Protocol - File Lock
 *
 * Mutex pour les opérations de fichiers.
 * Empêche les modifications concurrentes sur un même fichier.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileLock = void 0;
// ============================================================================
// File Lock
// ============================================================================
class FileLock {
    static instance;
    /** Locks actifs */
    locks = new Map();
    /** Timeout pour l'acquisition (ms) */
    acquireTimeout;
    /** TTL max pour un lock (ms) */
    lockTTL;
    constructor(acquireTimeout = 5000, lockTTL = 60000) {
        this.acquireTimeout = acquireTimeout;
        this.lockTTL = lockTTL;
    }
    static getInstance() {
        if (!FileLock.instance) {
            FileLock.instance = new FileLock();
        }
        return FileLock.instance;
    }
    static resetInstance() {
        FileLock.instance = new FileLock();
    }
    /**
     * Acquiert un lock sur un fichier
     * Attend si le fichier est déjà locké
     */
    async acquire(filePath, owner = 'default') {
        const startTime = Date.now();
        while (Date.now() - startTime < this.acquireTimeout) {
            // Vérifier si un lock existe
            const existingLock = this.locks.get(filePath);
            if (existingLock) {
                // Vérifier si le lock a expiré
                if (Date.now() - existingLock.acquiredAt > this.lockTTL) {
                    console.log(`[FileLock] Expired lock released: ${filePath}`);
                    this.locks.delete(filePath);
                }
                else {
                    // Attendre un peu avant de réessayer
                    await this.sleep(50);
                    continue;
                }
            }
            // Créer le lock
            this.locks.set(filePath, {
                filePath,
                acquiredAt: Date.now(),
                owner,
            });
            console.log(`[FileLock] Acquired: ${filePath} by ${owner}`);
            return true;
        }
        console.warn(`[FileLock] Timeout acquiring lock: ${filePath}`);
        return false;
    }
    /**
     * Relâche un lock
     */
    release(filePath) {
        if (this.locks.has(filePath)) {
            this.locks.delete(filePath);
            console.log(`[FileLock] Released: ${filePath}`);
        }
    }
    /**
     * Vérifie si un fichier est locké
     */
    isLocked(filePath) {
        const lock = this.locks.get(filePath);
        if (!lock)
            return false;
        // Vérifier l'expiration
        if (Date.now() - lock.acquiredAt > this.lockTTL) {
            this.locks.delete(filePath);
            return false;
        }
        return true;
    }
    /**
     * Récupère les infos d'un lock
     */
    getLockInfo(filePath) {
        return this.locks.get(filePath);
    }
    /**
     * Récupère tous les locks actifs
     */
    getAllLocks() {
        return Array.from(this.locks.values());
    }
    /**
     * Force la libération d'un lock (admin only)
     */
    forceRelease(filePath) {
        this.locks.delete(filePath);
        console.log(`[FileLock] Force released: ${filePath}`);
    }
    /**
     * Libère tous les locks
     */
    releaseAll() {
        const count = this.locks.size;
        this.locks.clear();
        console.log(`[FileLock] Released all ${count} locks`);
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.FileLock = FileLock;
//# sourceMappingURL=FileLock.js.map