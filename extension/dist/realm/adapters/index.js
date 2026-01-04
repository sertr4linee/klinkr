"use strict";
/**
 * REALM Protocol - Adapters Index
 *
 * Exporte tous les adapters et initialise le registry par défaut.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactTailwindAdapter = exports.registerAdapters = exports.AdapterRegistry = void 0;
exports.initializeDefaultAdapters = initializeDefaultAdapters;
var AdapterRegistry_1 = require("./AdapterRegistry");
Object.defineProperty(exports, "AdapterRegistry", { enumerable: true, get: function () { return AdapterRegistry_1.AdapterRegistry; } });
Object.defineProperty(exports, "registerAdapters", { enumerable: true, get: function () { return AdapterRegistry_1.registerAdapters; } });
var ReactTailwindAdapter_1 = require("./ReactTailwindAdapter");
Object.defineProperty(exports, "ReactTailwindAdapter", { enumerable: true, get: function () { return ReactTailwindAdapter_1.ReactTailwindAdapter; } });
const AdapterRegistry_2 = require("./AdapterRegistry");
const ReactTailwindAdapter_2 = require("./ReactTailwindAdapter");
/**
 * Initialise les adapters par défaut
 */
function initializeDefaultAdapters() {
    const registry = AdapterRegistry_2.AdapterRegistry.getInstance();
    // React + Tailwind (priorité haute)
    registry.register(new ReactTailwindAdapter_2.ReactTailwindAdapter());
    // Autres adapters à ajouter ici...
    // registry.register(new ReactCSSModulesAdapter());
    // registry.register(new PlainHTMLAdapter());
    console.log('[Adapters] Initialized default adapters');
}
//# sourceMappingURL=index.js.map