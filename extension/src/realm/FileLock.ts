/**
 * REALM Protocol - File Lock
 * 
 * Mutex pour les opérations de fichiers.
 * Empêche les modifications concurrentes sur un même fichier.
 */

// ============================================================================
// Types
// ============================================================================

interface LockInfo {
  filePath: string;
  acquiredAt: number;
  owner: string;
}

// ============================================================================
// File Lock
// ============================================================================

export class FileLock {
  private static instance: FileLock;
  
  /** Locks actifs */
  private locks: Map<string, LockInfo> = new Map();
  
  /** Timeout pour l'acquisition (ms) */
  private acquireTimeout: number;
  
  /** TTL max pour un lock (ms) */
  private lockTTL: number;
  
  private constructor(acquireTimeout = 5000, lockTTL = 60000) {
    this.acquireTimeout = acquireTimeout;
    this.lockTTL = lockTTL;
  }
  
  public static getInstance(): FileLock {
    if (!FileLock.instance) {
      FileLock.instance = new FileLock();
    }
    return FileLock.instance;
  }
  
  public static resetInstance(): void {
    FileLock.instance = new FileLock();
  }
  
  /**
   * Acquiert un lock sur un fichier
   * Attend si le fichier est déjà locké
   */
  async acquire(filePath: string, owner = 'default'): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < this.acquireTimeout) {
      // Vérifier si un lock existe
      const existingLock = this.locks.get(filePath);
      
      if (existingLock) {
        // Vérifier si le lock a expiré
        if (Date.now() - existingLock.acquiredAt > this.lockTTL) {
          console.log(`[FileLock] Expired lock released: ${filePath}`);
          this.locks.delete(filePath);
        } else {
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
  release(filePath: string): void {
    if (this.locks.has(filePath)) {
      this.locks.delete(filePath);
      console.log(`[FileLock] Released: ${filePath}`);
    }
  }
  
  /**
   * Vérifie si un fichier est locké
   */
  isLocked(filePath: string): boolean {
    const lock = this.locks.get(filePath);
    
    if (!lock) return false;
    
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
  getLockInfo(filePath: string): LockInfo | undefined {
    return this.locks.get(filePath);
  }
  
  /**
   * Récupère tous les locks actifs
   */
  getAllLocks(): LockInfo[] {
    return Array.from(this.locks.values());
  }
  
  /**
   * Force la libération d'un lock (admin only)
   */
  forceRelease(filePath: string): void {
    this.locks.delete(filePath);
    console.log(`[FileLock] Force released: ${filePath}`);
  }
  
  /**
   * Libère tous les locks
   */
  releaseAll(): void {
    const count = this.locks.size;
    this.locks.clear();
    console.log(`[FileLock] Released all ${count} locks`);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
