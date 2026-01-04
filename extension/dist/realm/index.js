"use strict";
/**
 * REALM Protocol - Public Exports
 *
 * Point d'entrée unique pour le module REALM.
 * Exporte tous les types, classes et fonctions publiques.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncEngine = exports.createEvent = exports.EventBus = exports.ReactTailwindAdapter = exports.initializeDefaultAdapters = exports.registerAdapters = exports.AdapterRegistry = exports.ChangeLog = exports.FileLock = exports.TransactionManager = exports.resetASTParser = exports.getASTParser = exports.ASTParser = exports.ElementRegistry = exports.buildASTPath = exports.extractComponentName = exports.toDebugString = exports.isSameRealmID = exports.isValidRealmID = exports.generateRealmID = exports.DEFAULT_REALM_CONFIG = void 0;
var types_1 = require("./types");
Object.defineProperty(exports, "DEFAULT_REALM_CONFIG", { enumerable: true, get: function () { return types_1.DEFAULT_REALM_CONFIG; } });
// ============================================================================
// RealmID
// ============================================================================
var RealmID_1 = require("./RealmID");
Object.defineProperty(exports, "generateRealmID", { enumerable: true, get: function () { return RealmID_1.generateRealmID; } });
Object.defineProperty(exports, "isValidRealmID", { enumerable: true, get: function () { return RealmID_1.isValidRealmID; } });
Object.defineProperty(exports, "isSameRealmID", { enumerable: true, get: function () { return RealmID_1.isSameRealmID; } });
Object.defineProperty(exports, "toDebugString", { enumerable: true, get: function () { return RealmID_1.toDebugString; } });
Object.defineProperty(exports, "extractComponentName", { enumerable: true, get: function () { return RealmID_1.extractComponentName; } });
Object.defineProperty(exports, "buildASTPath", { enumerable: true, get: function () { return RealmID_1.buildASTPath; } });
// ============================================================================
// Registry
// ============================================================================
var ElementRegistry_1 = require("./ElementRegistry");
Object.defineProperty(exports, "ElementRegistry", { enumerable: true, get: function () { return ElementRegistry_1.ElementRegistry; } });
// ============================================================================
// AST Parser
// ============================================================================
var ASTParser_1 = require("./ASTParser");
Object.defineProperty(exports, "ASTParser", { enumerable: true, get: function () { return ASTParser_1.ASTParser; } });
Object.defineProperty(exports, "getASTParser", { enumerable: true, get: function () { return ASTParser_1.getASTParser; } });
Object.defineProperty(exports, "resetASTParser", { enumerable: true, get: function () { return ASTParser_1.resetASTParser; } });
// ============================================================================
// Transaction Layer
// ============================================================================
var TransactionManager_1 = require("./TransactionManager");
Object.defineProperty(exports, "TransactionManager", { enumerable: true, get: function () { return TransactionManager_1.TransactionManager; } });
var FileLock_1 = require("./FileLock");
Object.defineProperty(exports, "FileLock", { enumerable: true, get: function () { return FileLock_1.FileLock; } });
var ChangeLog_1 = require("./ChangeLog");
Object.defineProperty(exports, "ChangeLog", { enumerable: true, get: function () { return ChangeLog_1.ChangeLog; } });
// ============================================================================
// Adapters
// ============================================================================
var adapters_1 = require("./adapters");
Object.defineProperty(exports, "AdapterRegistry", { enumerable: true, get: function () { return adapters_1.AdapterRegistry; } });
Object.defineProperty(exports, "registerAdapters", { enumerable: true, get: function () { return adapters_1.registerAdapters; } });
Object.defineProperty(exports, "initializeDefaultAdapters", { enumerable: true, get: function () { return adapters_1.initializeDefaultAdapters; } });
var ReactTailwindAdapter_1 = require("./adapters/ReactTailwindAdapter");
Object.defineProperty(exports, "ReactTailwindAdapter", { enumerable: true, get: function () { return ReactTailwindAdapter_1.ReactTailwindAdapter; } });
// ============================================================================
// Sync Engine
// ============================================================================
var EventBus_1 = require("./sync/EventBus");
Object.defineProperty(exports, "EventBus", { enumerable: true, get: function () { return EventBus_1.EventBus; } });
Object.defineProperty(exports, "createEvent", { enumerable: true, get: function () { return EventBus_1.createEvent; } });
var SyncEngine_1 = require("./sync/SyncEngine");
Object.defineProperty(exports, "SyncEngine", { enumerable: true, get: function () { return SyncEngine_1.SyncEngine; } });
//# sourceMappingURL=index.js.map