'use client';

/**
 * REALM Protocol - React Hook
 * 
 * Hook pour intégrer REALM dans les composants React.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { RealmClient, getRealmClient, ConnectionState } from './RealmClient';
import type { 
  RealmID, 
  RealmEvent, 
  ElementStyles,
  StyleChangedEvent,
  TextChangedEvent,
  ElementSelectedEvent,
} from './types';

// ============================================================================
// Types
// ============================================================================

export interface UseRealmSyncOptions {
  /** URL WebSocket personnalisée */
  wsUrl?: string;
  /** Se connecter automatiquement */
  autoConnect?: boolean;
  /** Callback sur connexion */
  onConnect?: () => void;
  /** Callback sur déconnexion */
  onDisconnect?: () => void;
  /** Callback sur erreur */
  onError?: (error: Error) => void;
}

export interface UseRealmSyncReturn {
  /** État de connexion */
  connectionState: ConnectionState;
  /** Est connecté */
  isConnected: boolean;
  /** Élément actuellement sélectionné */
  selectedElement: RealmID | null;
  /** Se connecter */
  connect: () => void;
  /** Se déconnecter */
  disconnect: () => void;
  /** Envoyer un changement de style */
  sendStyleChange: (realmId: RealmID, styles: Partial<ElementStyles>, preview?: boolean) => void;
  /** Envoyer un changement de texte */
  sendTextChange: (realmId: RealmID, text: string, preview?: boolean) => void;
  /** Sélectionner un élément */
  selectElement: (realmId: RealmID) => void;
  /** S'abonner à un type d'événement */
  subscribe: <T extends RealmEvent>(eventType: T['type'], handler: (event: T) => void) => () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useRealmSync(options: UseRealmSyncOptions = {}): UseRealmSyncReturn {
  const { 
    wsUrl, 
    autoConnect = true,
    onConnect,
    onDisconnect,
    onError,
  } = options;
  
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [selectedElement, setSelectedElement] = useState<RealmID | null>(null);
  
  const clientRef = useRef<RealmClient | null>(null);
  const unsubscribesRef = useRef<(() => void)[]>([]);
  
  // Initialiser le client
  useEffect(() => {
    const client = getRealmClient(wsUrl ? { wsUrl } : undefined);
    clientRef.current = client;
    
    // S'abonner aux changements d'état
    const unsubState = client.onStateChange((state) => {
      setConnectionState(state);
      
      if (state === 'connected') {
        onConnect?.();
      } else if (state === 'disconnected') {
        onDisconnect?.();
      } else if (state === 'error') {
        onError?.(new Error('Connection error'));
      }
    });
    
    // S'abonner aux sélections d'éléments
    const unsubSelect = client.on('ELEMENT_SELECTED', (event) => {
      if (event.type === 'ELEMENT_SELECTED') {
        setSelectedElement(event.realmId);
      }
    });
    
    unsubscribesRef.current.push(unsubState, unsubSelect);
    
    // Auto-connect
    if (autoConnect) {
      client.connect();
    }
    
    // Cleanup
    return () => {
      unsubscribesRef.current.forEach(unsub => unsub());
      unsubscribesRef.current = [];
    };
  }, [wsUrl, autoConnect, onConnect, onDisconnect, onError]);
  
  // ============================================================================
  // Methods
  // ============================================================================
  
  const connect = useCallback(() => {
    clientRef.current?.connect();
  }, []);
  
  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);
  
  const sendStyleChange = useCallback((
    realmId: RealmID,
    styles: Partial<ElementStyles>,
    preview = true
  ) => {
    clientRef.current?.sendStyleChange(realmId, styles, preview);
  }, []);
  
  const sendTextChange = useCallback((
    realmId: RealmID,
    text: string,
    preview = true
  ) => {
    clientRef.current?.sendTextChange(realmId, text, preview);
  }, []);
  
  const selectElement = useCallback((realmId: RealmID) => {
    setSelectedElement(realmId);
    clientRef.current?.sendElementSelected(realmId);
  }, []);
  
  const subscribe = useCallback(<T extends RealmEvent>(
    eventType: T['type'],
    handler: (event: T) => void
  ): (() => void) => {
    if (!clientRef.current) return () => {};
    return clientRef.current.on(eventType, handler as any);
  }, []);
  
  return {
    connectionState,
    isConnected: connectionState === 'connected',
    selectedElement,
    connect,
    disconnect,
    sendStyleChange,
    sendTextChange,
    selectElement,
    subscribe,
  };
}

// ============================================================================
// Specialized Hooks
// ============================================================================

/**
 * Hook pour observer les changements de style d'un élément
 */
export function useRealmStyleChanges(
  realmId: RealmID | null,
  onStyleChange: (styles: Partial<ElementStyles>) => void
): void {
  const { subscribe } = useRealmSync({ autoConnect: true });
  
  useEffect(() => {
    if (!realmId) return;
    
    const unsubscribe = subscribe<StyleChangedEvent>('STYLE_CHANGED', (event) => {
      if (event.realmId.hash === realmId.hash) {
        onStyleChange(event.styles);
      }
    });
    
    return unsubscribe;
  }, [realmId, onStyleChange, subscribe]);
}

/**
 * Hook pour observer les changements de texte d'un élément
 */
export function useRealmTextChanges(
  realmId: RealmID | null,
  onTextChange: (text: string) => void
): void {
  const { subscribe } = useRealmSync({ autoConnect: true });
  
  useEffect(() => {
    if (!realmId) return;
    
    const unsubscribe = subscribe<TextChangedEvent>('TEXT_CHANGED', (event) => {
      if (event.realmId.hash === realmId.hash) {
        onTextChange(event.text);
      }
    });
    
    return unsubscribe;
  }, [realmId, onTextChange, subscribe]);
}

/**
 * Hook pour la connexion status seulement
 */
export function useRealmConnection(): { isConnected: boolean; state: ConnectionState } {
  const { connectionState, isConnected } = useRealmSync({ autoConnect: true });
  return { isConnected, state: connectionState };
}
