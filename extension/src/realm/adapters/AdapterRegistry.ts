/**
 * REALM Protocol - Adapter Registry
 * 
 * Gère l'enregistrement et la sélection automatique des adapters.
 * Utilise une chaîne de priorité pour la détection.
 */

import type { FrameworkAdapter } from '../types';

// ============================================================================
// Adapter Registry
// ============================================================================

export class AdapterRegistry {
  private static instance: AdapterRegistry;
  
  /** Adapters enregistrés, triés par priorité */
  private adapters: FrameworkAdapter[] = [];
  
  /** Cache de détection: filePath → adapterName */
  private detectionCache: Map<string, string> = new Map();
  
  /** Max cache size */
  private maxCacheSize = 500;
  
  private constructor() {}
  
  public static getInstance(): AdapterRegistry {
    if (!AdapterRegistry.instance) {
      AdapterRegistry.instance = new AdapterRegistry();
    }
    return AdapterRegistry.instance;
  }
  
  public static resetInstance(): void {
    AdapterRegistry.instance = new AdapterRegistry();
  }
  
  // ============================================================================
  // Registration
  // ============================================================================
  
  /**
   * Enregistre un adapter
   */
  register(adapter: FrameworkAdapter): void {
    // Éviter les doublons
    const existing = this.adapters.findIndex(a => a.name === adapter.name);
    if (existing !== -1) {
      this.adapters[existing] = adapter;
    } else {
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
  unregister(name: string): boolean {
    const index = this.adapters.findIndex(a => a.name === name);
    if (index === -1) return false;
    
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
  detect(filePath: string, content: string): FrameworkAdapter | null {
    // Vérifier le cache
    const cached = this.detectionCache.get(filePath);
    if (cached) {
      const adapter = this.adapters.find(a => a.name === cached);
      if (adapter) return adapter;
    }
    
    // Parcourir les adapters par priorité
    for (const adapter of this.adapters) {
      try {
        if (adapter.detect(filePath, content)) {
          this.cacheDetection(filePath, adapter.name);
          console.log(`[AdapterRegistry] Detected: ${adapter.name} for ${filePath}`);
          return adapter;
        }
      } catch (error) {
        console.warn(`[AdapterRegistry] Detection error in ${adapter.name}:`, error);
      }
    }
    
    console.warn(`[AdapterRegistry] No adapter found for ${filePath}`);
    return null;
  }
  
  /**
   * Récupère un adapter par son nom
   */
  get(name: string): FrameworkAdapter | undefined {
    return this.adapters.find(a => a.name === name);
  }
  
  /**
   * Récupère tous les adapters
   */
  getAll(): FrameworkAdapter[] {
    return [...this.adapters];
  }
  
  /**
   * Liste les noms des adapters enregistrés
   */
  listNames(): string[] {
    return this.adapters.map(a => a.name);
  }
  
  // ============================================================================
  // Cache Management
  // ============================================================================
  
  private cacheDetection(filePath: string, adapterName: string): void {
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
  invalidateCache(filePath: string): void {
    this.detectionCache.delete(filePath);
  }
  
  /**
   * Vide tout le cache
   */
  clearCache(): void {
    this.detectionCache.clear();
  }
  
  /**
   * Retourne la taille du cache
   */
  get cacheSize(): number {
    return this.detectionCache.size;
  }
}

// ============================================================================
// Helper: Auto-register adapters
// ============================================================================

/**
 * Enregistre tous les adapters fournis
 */
export function registerAdapters(adapters: FrameworkAdapter[]): void {
  const registry = AdapterRegistry.getInstance();
  for (const adapter of adapters) {
    registry.register(adapter);
  }
}
