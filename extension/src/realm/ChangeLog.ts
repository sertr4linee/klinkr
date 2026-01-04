/**
 * REALM Protocol - ChangeLog
 * 
 * Historique immutable des modifications.
 * Permet le rollback et l'audit des changements.
 */

import type { ChangeLogEntry, Operation } from './types';

// ============================================================================
// Types
// ============================================================================

export interface ChangeLogQuery {
  /** Filtrer par fichier */
  filePath?: string;
  /** Filtrer par transaction */
  transactionId?: string;
  /** Depuis (timestamp) */
  since?: number;
  /** Jusqu'à (timestamp) */
  until?: number;
  /** Limite de résultats */
  limit?: number;
  /** Exclure les rollbacks */
  excludeRolledBack?: boolean;
}

export interface ChangeLogStats {
  totalEntries: number;
  filesModified: number;
  rolledBackCount: number;
  oldestEntry?: number;
  newestEntry?: number;
}

// ============================================================================
// ChangeLog
// ============================================================================

export class ChangeLog {
  private static instance: ChangeLog;
  
  /** Entrées du changelog (immutable append-only) */
  private entries: ChangeLogEntry[] = [];
  
  /** Index par transaction ID */
  private byTransactionId: Map<string, number> = new Map();
  
  /** Index par fichier */
  private byFilePath: Map<string, number[]> = new Map();
  
  /** Nombre max d'entrées */
  private maxEntries: number;
  
  private constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }
  
  public static getInstance(): ChangeLog {
    if (!ChangeLog.instance) {
      ChangeLog.instance = new ChangeLog();
    }
    return ChangeLog.instance;
  }
  
  public static resetInstance(): void {
    ChangeLog.instance = new ChangeLog();
  }
  
  // ============================================================================
  // Write Operations
  // ============================================================================
  
  /**
   * Ajoute une entrée au changelog
   */
  add(entry: ChangeLogEntry): void {
    // Ajouter l'entrée
    const index = this.entries.length;
    this.entries.push(entry);
    
    // Mettre à jour les index
    this.byTransactionId.set(entry.transactionId, index);
    
    const fileIndices = this.byFilePath.get(entry.filePath) || [];
    fileIndices.push(index);
    this.byFilePath.set(entry.filePath, fileIndices);
    
    // Pruning si nécessaire
    if (this.entries.length > this.maxEntries) {
      this.prune();
    }
    
    console.log(`[ChangeLog] Added: ${entry.id} (${entry.filePath})`);
  }
  
  /**
   * Marque une entrée comme rolled back
   */
  markRolledBack(transactionId: string): boolean {
    const index = this.byTransactionId.get(transactionId);
    if (index === undefined) return false;
    
    const entry = this.entries[index];
    if (!entry) return false;
    
    entry.rolledBack = true;
    entry.rolledBackAt = Date.now();
    
    console.log(`[ChangeLog] Marked as rolled back: ${transactionId}`);
    return true;
  }
  
  // ============================================================================
  // Query Operations
  // ============================================================================
  
  /**
   * Récupère une entrée par ID
   */
  get(entryId: string): ChangeLogEntry | undefined {
    return this.entries.find(e => e.id === entryId);
  }
  
  /**
   * Récupère une entrée par transaction ID
   */
  getByTransactionId(transactionId: string): ChangeLogEntry | undefined {
    const index = this.byTransactionId.get(transactionId);
    if (index === undefined) return undefined;
    return this.entries[index];
  }
  
  /**
   * Recherche les entrées selon des critères
   */
  query(query: ChangeLogQuery): ChangeLogEntry[] {
    let results = [...this.entries];
    
    // Filtrer par fichier
    if (query.filePath) {
      const indices = this.byFilePath.get(query.filePath) || [];
      results = indices.map(i => this.entries[i]).filter(Boolean);
    }
    
    // Filtrer par transaction
    if (query.transactionId) {
      results = results.filter(e => e.transactionId === query.transactionId);
    }
    
    // Filtrer par date
    if (query.since) {
      results = results.filter(e => e.timestamp >= query.since!);
    }
    
    if (query.until) {
      results = results.filter(e => e.timestamp <= query.until!);
    }
    
    // Exclure les rollbacks
    if (query.excludeRolledBack) {
      results = results.filter(e => !e.rolledBack);
    }
    
    // Trier par date décroissante
    results.sort((a, b) => b.timestamp - a.timestamp);
    
    // Limiter
    if (query.limit) {
      results = results.slice(0, query.limit);
    }
    
    return results;
  }
  
  /**
   * Récupère les dernières entrées
   */
  getRecent(limit = 10): ChangeLogEntry[] {
    return this.query({ limit, excludeRolledBack: false });
  }
  
  /**
   * Récupère l'historique d'un fichier
   */
  getFileHistory(filePath: string, limit = 50): ChangeLogEntry[] {
    return this.query({ filePath, limit });
  }
  
  /**
   * Trouve le dernier changement valide d'un fichier
   */
  getLastValidChange(filePath: string): ChangeLogEntry | undefined {
    const history = this.query({ filePath, excludeRolledBack: true, limit: 1 });
    return history[0];
  }
  
  // ============================================================================
  // Stats & Info
  // ============================================================================
  
  /**
   * Retourne les stats du changelog
   */
  getStats(): ChangeLogStats {
    const rolledBackCount = this.entries.filter(e => e.rolledBack).length;
    const timestamps = this.entries.map(e => e.timestamp);
    
    return {
      totalEntries: this.entries.length,
      filesModified: this.byFilePath.size,
      rolledBackCount,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : undefined,
    };
  }
  
  /**
   * Retourne le nombre d'entrées
   */
  get size(): number {
    return this.entries.length;
  }
  
  // ============================================================================
  // Export/Import
  // ============================================================================
  
  /**
   * Exporte le changelog en JSON
   */
  export(): string {
    return JSON.stringify({
      entries: this.entries,
      exportedAt: Date.now(),
    }, null, 2);
  }
  
  /**
   * Importe un changelog depuis JSON
   */
  import(json: string): void {
    try {
      const data = JSON.parse(json);
      
      if (Array.isArray(data.entries)) {
        for (const entry of data.entries) {
          this.add(entry);
        }
      }
      
      console.log(`[ChangeLog] Imported ${data.entries?.length || 0} entries`);
    } catch (error) {
      console.error('[ChangeLog] Import failed:', error);
      throw new Error('Invalid changelog JSON');
    }
  }
  
  // ============================================================================
  // Maintenance
  // ============================================================================
  
  /**
   * Supprime les anciennes entrées
   */
  private prune(): void {
    if (this.entries.length <= this.maxEntries) return;
    
    // Garder les maxEntries plus récentes
    const toRemove = this.entries.length - this.maxEntries;
    const removed = this.entries.splice(0, toRemove);
    
    // Reconstruire les index
    this.rebuildIndices();
    
    console.log(`[ChangeLog] Pruned ${removed.length} old entries`);
  }
  
  /**
   * Reconstruit les index
   */
  private rebuildIndices(): void {
    this.byTransactionId.clear();
    this.byFilePath.clear();
    
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      
      this.byTransactionId.set(entry.transactionId, i);
      
      const fileIndices = this.byFilePath.get(entry.filePath) || [];
      fileIndices.push(i);
      this.byFilePath.set(entry.filePath, fileIndices);
    }
  }
  
  /**
   * Vide le changelog
   */
  clear(): void {
    this.entries = [];
    this.byTransactionId.clear();
    this.byFilePath.clear();
    console.log('[ChangeLog] Cleared');
  }
}
