"use strict";
/**
 * REALM Protocol - Core Types
 *
 * Types fondamentaux pour le système d'identification et de modification
 * des éléments en temps réel.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_REALM_CONFIG = void 0;
exports.DEFAULT_REALM_CONFIG = {
    transactionTTL: 5 * 60 * 1000, // 5 minutes
    maxChangeLogEntries: 1000,
    injectRealmIds: false, // Désactivé par défaut
    enabledAdapters: ['react-tailwind', 'react-css-modules', 'plain-html'],
    debug: false,
};
//# sourceMappingURL=types.js.map