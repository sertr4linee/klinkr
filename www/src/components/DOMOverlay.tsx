'use client';

import { useEffect, useRef } from 'react';

// Type simplifié pour les bounds - compatible avec les deux hooks
interface SimpleBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  selector?: string;
  tagName?: string;
}

interface DOMOverlayProps {
  hoveredBounds: SimpleBounds | null;
  selectedBounds: SimpleBounds | null;
  showLabel?: boolean;
}

/**
 * Overlay visuel ultra-fluide pour sélection DOM
 * Stratégies anti-jitter:
 * - CSS transforms pour animation GPU
 * - will-change pour optimisation
 * - Transitions CSS smooth
 * - pointer-events: none
 */
export function DOMOverlay({
  hoveredBounds,
  selectedBounds,
  showLabel = true,
}: DOMOverlayProps) {
  const hoverRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLDivElement>(null);

  /**
   * Applique les bounds avec animation fluide
   * Utilise transform au lieu de top/left pour performance GPU
   */
  const applyBounds = (
    element: HTMLDivElement | null,
    bounds: SimpleBounds | null
  ) => {
    if (!element || !bounds) return;

    // Force GPU acceleration avec transform + will-change
    element.style.transform = `translate3d(${bounds.x}px, ${bounds.y}px, 0)`;
    element.style.width = `${bounds.width}px`;
    element.style.height = `${bounds.height}px`;
    element.style.opacity = '1';
  };

  /**
   * Cache l'overlay avec fade out
   */
  const hideBounds = (element: HTMLDivElement | null) => {
    if (!element) return;
    element.style.opacity = '0';
  };

  // Update hover overlay
  useEffect(() => {
    if (hoveredBounds) {
      applyBounds(hoverRef.current, hoveredBounds);
    } else {
      hideBounds(hoverRef.current);
    }
  }, [hoveredBounds]);

  // Update selected overlay
  useEffect(() => {
    if (selectedBounds) {
      applyBounds(selectRef.current, selectedBounds);
    } else {
      hideBounds(selectRef.current);
    }
  }, [selectedBounds]);

  return (
    <>
      {/* Hover overlay - bleu translucide */}
      <div
        ref={hoverRef}
        className="dom-overlay dom-overlay-hover"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 999998,
          opacity: 0,
          transition: 'opacity 150ms ease-out, transform 120ms cubic-bezier(0.4, 0, 0.2, 1), width 120ms cubic-bezier(0.4, 0, 0.2, 1), height 120ms cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'transform, width, height, opacity',
          border: '2px solid rgba(59, 130, 246, 0.8)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.3) inset',
        }}
        data-overlay-type="hover"
      >
        {showLabel && hoveredBounds && (
          <div
            className="dom-overlay-label"
            style={{
              position: 'absolute',
              top: '-24px',
              left: '0',
              padding: '2px 6px',
              fontSize: '11px',
              fontFamily: 'monospace',
              backgroundColor: 'rgba(59, 130, 246, 0.95)',
              color: 'white',
              borderRadius: '3px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            {hoveredBounds.tagName || 'element'}
          </div>
        )}
      </div>

      {/* Selected overlay - vert avec handles */}
      <div
        ref={selectRef}
        className="dom-overlay dom-overlay-selected"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 999999,
          opacity: 0,
          transition: 'opacity 200ms ease-out, transform 150ms cubic-bezier(0.4, 0, 0.2, 1), width 150ms cubic-bezier(0.4, 0, 0.2, 1), height 150ms cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'transform, width, height, opacity',
          border: '2px solid rgba(34, 197, 94, 0.9)',
          backgroundColor: 'rgba(34, 197, 94, 0.08)',
          boxShadow: '0 0 0 1px rgba(34, 197, 94, 0.4) inset, 0 4px 12px rgba(34, 197, 94, 0.3)',
          animation: 'pulse-border 2s ease-in-out infinite',
        }}
        data-overlay-type="selected"
      >
        {/* Coins de sélection (handles visuels) */}
        {selectedBounds && (
          <>
            <div className="corner-handle corner-tl" />
            <div className="corner-handle corner-tr" />
            <div className="corner-handle corner-bl" />
            <div className="corner-handle corner-br" />
            
            {showLabel && selectedBounds.selector && (
              <div
                className="dom-overlay-label selected"
                style={{
                  position: 'absolute',
                  top: '-28px',
                  left: '0',
                  padding: '4px 8px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  backgroundColor: 'rgba(34, 197, 94, 0.95)',
                  color: 'white',
                  borderRadius: '4px',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  fontWeight: 600,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                }}
              >
                ✓ {selectedBounds.selector.length > 50 
                  ? selectedBounds.selector.substring(0, 50) + '...' 
                  : selectedBounds.selector}
              </div>
            )}
            
            {/* Corner handles avec styles inline */}
            <style dangerouslySetInnerHTML={{__html: `
              .corner-handle {
                position: absolute;
                width: 8px;
                height: 8px;
                background: white;
                border: 2px solid rgba(34, 197, 94, 1);
                border-radius: 50%;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
              }
              .corner-tl { top: -4px; left: -4px; }
              .corner-tr { top: -4px; right: -4px; }
              .corner-bl { bottom: -4px; left: -4px; }
              .corner-br { bottom: -4px; right: -4px; }
              
              @keyframes pulse-border {
                0%, 100% { box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.4) inset, 0 4px 12px rgba(34, 197, 94, 0.3); }
                50% { box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.6) inset, 0 4px 16px rgba(34, 197, 94, 0.4); }
              }
            `}} />
          </>
        )}
      </div>
    </>
  );
}
