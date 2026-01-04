/**
 * REALM Protocol - Adapters Index
 * 
 * Exporte tous les adapters et initialise le registry par défaut.
 */

export { AdapterRegistry, registerAdapters } from './AdapterRegistry';
export { ReactTailwindAdapter } from './ReactTailwindAdapter';

import { AdapterRegistry } from './AdapterRegistry';
import { ReactTailwindAdapter } from './ReactTailwindAdapter';

/**
 * Initialise les adapters par défaut
 */
export function initializeDefaultAdapters(): void {
  const registry = AdapterRegistry.getInstance();
  
  // React + Tailwind (priorité haute)
  registry.register(new ReactTailwindAdapter());
  
  // Autres adapters à ajouter ici...
  // registry.register(new ReactCSSModulesAdapter());
  // registry.register(new PlainHTMLAdapter());
  
  console.log('[Adapters] Initialized default adapters');
}
