/**
 * REALM Protocol - Core Types
 * 
 * Types fondamentaux pour le système d'identification et de modification
 * des éléments en temps réel.
 */

import * as t from '@babel/types';

// ============================================================================
// REALM ID - Identification unique des éléments
// ============================================================================

/**
 * Identifiant unique et stable pour un élément dans le code source.
 * Basé sur: fichier + composant + position AST
 */
export interface RealmID {
  /** Hash court (12 chars) basé sur file:component:position */
  hash: string;
  
  /** Chemin du fichier source relatif au workspace */
  sourceFile: string;
  
  /** Chemin dans l'AST (ex: "JSXElement[0].children[2]") */
  astPath: string;
  
  /** Nom du composant parent */
  componentName: string;
  
  /** Position dans le fichier source */
  sourceLocation: SourceLocation;
  
  /** Version du RealmID (pour invalidation) */
  version: number;
}

export interface SourceLocation {
  start: { line: number; column: number; index: number };
  end: { line: number; column: number; index: number };
}

// ============================================================================
// ELEMENT INFO - Informations sur un élément tracké
// ============================================================================

export interface ElementInfo {
  realmId: RealmID;
  
  /** Tag HTML/JSX (div, span, Button, etc.) */
  tagName: string;
  
  /** Attributs de l'élément */
  attributes: ElementAttributes;
  
  /** Styles actuels (computed) */
  styles: ElementStyles;
  
  /** Contenu texte direct */
  textContent?: string;
  
  /** Enfants (RealmIDs) */
  children: string[];
  
  /** Parent (RealmID) */
  parentId?: string;
  
  /** Metadata du framework */
  frameworkMeta?: FrameworkMeta;
}

export interface ElementAttributes {
  id?: string;
  className?: string;
  style?: Record<string, string>;
  [key: string]: unknown;
}

export interface ElementStyles {
  // Layout
  display?: string;
  position?: string;
  width?: string;
  height?: string;
  
  // Spacing
  padding?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  margin?: string;
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  
  // Typography
  color?: string;
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  lineHeight?: string;
  textAlign?: string;
  
  // Background
  backgroundColor?: string;
  backgroundImage?: string;
  
  // Border
  border?: string;
  borderRadius?: string;
  borderColor?: string;
  borderWidth?: string;
  
  // Flex
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
  gap?: string;
  
  // Effects
  boxShadow?: string;
  opacity?: string;
  
  // Autres
  [key: string]: string | undefined;
}

export interface FrameworkMeta {
  framework: 'react' | 'vue' | 'svelte' | 'html';
  styleSystem: 'tailwind' | 'css-modules' | 'styled-components' | 'inline' | 'css';
  isComponent: boolean;
  componentPath?: string;
}

// ============================================================================
// TRANSACTIONS - Modifications atomiques
// ============================================================================

export type TransactionStatus = 
  | 'pending' 
  | 'validated' 
  | 'committed' 
  | 'rolled_back' 
  | 'failed';

export interface Transaction {
  id: string;
  realmId: RealmID;
  operations: Operation[];
  status: TransactionStatus;
  
  /** Snapshot du fichier avant modification */
  beforeSnapshot: FileSnapshot;
  
  /** Snapshot après modification (une fois validated) */
  afterSnapshot?: FileSnapshot;
  
  /** Timestamps */
  createdAt: number;
  validatedAt?: number;
  committedAt?: number;
  
  /** Erreur si failed */
  error?: string;
}

export interface FileSnapshot {
  filePath: string;
  content: string;
  hash: string;
  timestamp: number;
}

export type OperationType = 'style' | 'text' | 'class' | 'attribute' | 'structure';

export interface Operation {
  id: string;
  type: OperationType;
  target: RealmID;
  
  /** Valeur avant modification */
  before: unknown;
  
  /** Valeur après modification */
  after: unknown;
  
  /** Payload spécifique au type */
  payload: OperationPayload;
}

export type OperationPayload =
  | StyleOperationPayload
  | TextOperationPayload
  | ClassOperationPayload
  | AttributeOperationPayload
  | StructureOperationPayload;

export interface StyleOperationPayload {
  type: 'style';
  styles: Partial<ElementStyles>;
  mode: 'merge' | 'replace';
}

export interface TextOperationPayload {
  type: 'text';
  text: string;
  mode: 'replace' | 'append' | 'prepend';
}

export interface ClassOperationPayload {
  type: 'class';
  add?: string[];
  remove?: string[];
  replace?: { from: string; to: string }[];
}

export interface AttributeOperationPayload {
  type: 'attribute';
  name: string;
  value: string | null; // null = remove
}

export interface StructureOperationPayload {
  type: 'structure';
  action: 'wrap' | 'unwrap' | 'move' | 'delete';
  wrapper?: string; // Pour wrap
  newParent?: RealmID; // Pour move
}

// ============================================================================
// CHANGELOG - Historique immutable
// ============================================================================

export interface ChangeLogEntry {
  id: string;
  transactionId: string;
  timestamp: number;
  
  /** Fichier modifié */
  filePath: string;
  
  /** Opérations effectuées */
  operations: Operation[];
  
  /** Contenu avant/après */
  before: string;
  after: string;
  
  /** Hash pour vérification */
  beforeHash: string;
  afterHash: string;
  
  /** Si rollback effectué */
  rolledBack?: boolean;
  rolledBackAt?: number;
}

// ============================================================================
// EVENTS - Synchronisation temps réel
// ============================================================================

export type EventSource = 'editor' | 'panel' | 'dom' | 'file-watcher' | 'system';

export type RealmEvent =
  | ElementSelectedEvent
  | StyleChangedEvent
  | TextChangedEvent
  | ClassChangedEvent
  | TransactionEvent
  | FileEvent
  | SyncEvent
  | CommitEvent
  | RollbackEvent;

export interface BaseEvent {
  id: string;
  timestamp: number;
  source: EventSource;
}

export interface ElementSelectedEvent extends BaseEvent {
  type: 'ELEMENT_SELECTED';
  realmId: RealmID;
  bounds?: ElementBounds;
}

export interface StyleChangedEvent extends BaseEvent {
  type: 'STYLE_CHANGED';
  realmId: RealmID;
  styles: Partial<ElementStyles>;
  preview: boolean; // true = preview only, false = committed
}

export interface TextChangedEvent extends BaseEvent {
  type: 'TEXT_CHANGED';
  realmId: RealmID;
  text: string;
  preview: boolean;
}

export interface ClassChangedEvent extends BaseEvent {
  type: 'CLASS_CHANGED';
  realmId: RealmID;
  classes: ClassOperationPayload;
  preview: boolean;
}

export interface TransactionEvent extends BaseEvent {
  type: 'TRANSACTION_STARTED' | 'TRANSACTION_VALIDATED' | 'TRANSACTION_COMMITTED' | 'TRANSACTION_ROLLED_BACK' | 'TRANSACTION_FAILED';
  transactionId: string;
  realmId: RealmID;
  error?: string;
}

export interface FileEvent extends BaseEvent {
  type: 'FILE_CHANGED' | 'FILE_CREATED' | 'FILE_DELETED';
  filePath: string;
  affectedRealmIds?: string[];
}

export interface SyncEvent extends BaseEvent {
  type: 'SYNC_REQUESTED' | 'SYNC_COMPLETED' | 'CONFLICT_DETECTED';
  conflictInfo?: ConflictInfo;
}

export interface CommitEvent extends BaseEvent {
  type: 'COMMIT_REQUESTED' | 'COMMIT_COMPLETED';
  realmId: RealmID;
  transactionId?: string;
}

export interface RollbackEvent extends BaseEvent {
  type: 'ROLLBACK_REQUESTED' | 'ROLLBACK_COMPLETED';
  realmId: RealmID;
  transactionId?: string;
}

export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ConflictInfo {
  realmId: RealmID;
  localVersion: number;
  remoteVersion: number;
  resolution?: 'local' | 'remote' | 'merge';
}

// ============================================================================
// ADAPTERS - Interface pour les frameworks
// ============================================================================

export interface FrameworkAdapter {
  /** Nom unique de l'adapter */
  readonly name: string;
  
  /** Priorité (plus élevé = testé en premier) */
  readonly priority: number;
  
  /**
   * Détecte si cet adapter peut gérer le fichier
   */
  detect(filePath: string, content: string): boolean;
  
  /**
   * Parse un élément depuis l'AST
   */
  parseElement(
    ast: t.File,
    realmId: RealmID
  ): ParsedElement | null;
  
  /**
   * Trouve tous les éléments dans un fichier
   */
  findAllElements(
    ast: t.File,
    filePath: string
  ): ParsedElement[];
  
  /**
   * Applique des changements de style
   */
  applyStyles(
    element: ParsedElement,
    styles: Partial<ElementStyles>
  ): t.File;
  
  /**
   * Applique des changements de texte
   */
  applyText(
    element: ParsedElement,
    text: string
  ): t.File;
  
  /**
   * Applique des changements de classes
   */
  applyClasses(
    element: ParsedElement,
    changes: ClassOperationPayload
  ): t.File;
  
  /**
   * Génère le code depuis l'AST modifié
   */
  generateCode(ast: t.File, originalContent: string): string;
}

export interface ParsedElement {
  realmId: RealmID;
  node: t.JSXElement | t.Node;
  ast: t.File;
  
  /** Attributs extraits */
  attributes: ElementAttributes;
  
  /** Position dans l'AST */
  path: string;
  
  /** Framework metadata */
  meta: FrameworkMeta;
}

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  location?: SourceLocation;
}

export interface ValidationWarning {
  code: string;
  message: string;
  suggestion?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface RealmConfig {
  /** TTL des transactions en ms (default: 5 min) */
  transactionTTL: number;
  
  /** Nombre max d'entrées dans le changelog */
  maxChangeLogEntries: number;
  
  /** Activer l'injection de data-realm-id */
  injectRealmIds: boolean;
  
  /** Adapters activés */
  enabledAdapters: string[];
  
  /** Mode debug */
  debug: boolean;
}

export const DEFAULT_REALM_CONFIG: RealmConfig = {
  transactionTTL: 5 * 60 * 1000, // 5 minutes
  maxChangeLogEntries: 1000,
  injectRealmIds: false, // Désactivé par défaut
  enabledAdapters: ['react-tailwind', 'react-css-modules', 'plain-html'],
  debug: false,
};
