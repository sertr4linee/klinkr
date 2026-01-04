/**
 * REALM Protocol - Web Module Exports
 */

export { RealmClient, getRealmClient, resetRealmClient } from './RealmClient';
export type { ConnectionState, RealmClientConfig } from './RealmClient';

export { 
  useRealmSync, 
  useRealmStyleChanges, 
  useRealmTextChanges,
  useRealmConnection,
} from './useRealmSync';
export type { UseRealmSyncOptions, UseRealmSyncReturn } from './useRealmSync';

export type {
  RealmID,
  RealmEvent,
  EventSource,
  ElementStyles,
  ElementBounds,
  ClassChanges,
  ConflictInfo,
  StyleChangedEvent,
  TextChangedEvent,
  ElementSelectedEvent,
} from './types';
