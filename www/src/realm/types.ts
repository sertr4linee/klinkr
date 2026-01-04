/**
 * REALM Protocol - Client Types
 * 
 * Types partagés entre l'extension et le panel web.
 */

// ============================================================================
// RealmID
// ============================================================================

export interface RealmID {
  hash: string;
  sourceFile: string;
  astPath: string;
  componentName: string;
  sourceLocation: SourceLocation;
  version: number;
}

export interface SourceLocation {
  start: { line: number; column: number; index: number };
  end: { line: number; column: number; index: number };
}

// ============================================================================
// Events
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
  preview: boolean;
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
  classes: ClassChanges;
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

// ============================================================================
// Element Data
// ============================================================================

export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
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
  
  [key: string]: string | undefined;
}

export interface ClassChanges {
  add?: string[];
  remove?: string[];
  replace?: { from: string; to: string }[];
}

export interface ConflictInfo {
  realmId: RealmID;
  localVersion: number;
  remoteVersion: number;
  resolution?: 'local' | 'remote' | 'merge';
}
