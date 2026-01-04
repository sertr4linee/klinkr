/**
 * REALM Protocol - Public Exports
 * 
 * Point d'entrée unique pour le module REALM.
 * Exporte tous les types, classes et fonctions publiques.
 */

// ============================================================================
// Types
// ============================================================================
export type {
  // Core types
  RealmID,
  SourceLocation,
  ElementInfo,
  ElementAttributes,
  ElementStyles,
  FrameworkMeta,
  
  // Transaction types
  Transaction,
  TransactionStatus,
  Operation,
  OperationType,
  OperationPayload,
  FileSnapshot,
  StyleOperationPayload,
  TextOperationPayload,
  ClassOperationPayload,
  AttributeOperationPayload,
  StructureOperationPayload,
  ChangeLogEntry,
  
  // Validation
  ValidationResult,
  ValidationError,
  ValidationWarning,
  
  // Event types
  RealmEvent,
  EventSource,
  BaseEvent,
  ElementSelectedEvent,
  StyleChangedEvent,
  TextChangedEvent,
  ClassChangedEvent,
  TransactionEvent,
  FileEvent,
  SyncEvent,
  ElementBounds,
  ConflictInfo,
  
  // Adapter types
  FrameworkAdapter,
  ParsedElement,
  
  // Config types
  RealmConfig,
} from './types';

export { DEFAULT_REALM_CONFIG } from './types';

// ============================================================================
// RealmID
// ============================================================================
export {
  generateRealmID,
  isValidRealmID,
  isSameRealmID,
  toDebugString,
  extractComponentName,
  buildASTPath,
} from './RealmID';

// ============================================================================
// Registry
// ============================================================================
export { ElementRegistry } from './ElementRegistry';
export type {
  RegistryStats,
  RegistryEvent,
  RegistryEventType,
  RegistryListener,
} from './ElementRegistry';

// ============================================================================
// AST Parser
// ============================================================================
export { ASTParser, getASTParser, resetASTParser } from './ASTParser';
export type {
  ParseResult,
  ParseError,
  ParseOptions,
} from './ASTParser';

// ============================================================================
// Transaction Layer
// ============================================================================
export { TransactionManager } from './TransactionManager';
export type { TransactionOptions } from './TransactionManager';

export { FileLock } from './FileLock';

export { ChangeLog } from './ChangeLog';
export type {
  ChangeLogQuery,
  ChangeLogStats,
} from './ChangeLog';

// ============================================================================
// Adapters
// ============================================================================
export { AdapterRegistry, registerAdapters, initializeDefaultAdapters } from './adapters';
export { ReactTailwindAdapter } from './adapters/ReactTailwindAdapter';

// ============================================================================
// Sync Engine
// ============================================================================
export { EventBus, createEvent } from './sync/EventBus';
export type { EventHandler, Subscription, EventBusStats } from './sync/EventBus';

export { SyncEngine } from './sync/SyncEngine';
export type { SyncClient, SyncEngineConfig } from './sync/SyncEngine';
