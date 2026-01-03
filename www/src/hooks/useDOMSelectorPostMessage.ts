'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  selector: string;
  tagName: string;
  id?: string;
  className?: string;
  computedStyles?: Record<string, string>;
  attributes?: Record<string, string>;
  textContent?: string;
  fullTextContent?: string;
  directTextContent?: string;
  hasChildren?: boolean;
  childCount?: number;
  isComplexText?: boolean;
  children?: number;
}

interface UseDOMSelectorOptions {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  enabled?: boolean;
  onElementSelect?: (bounds: ElementBounds) => void;
}

/**
 * Script à injecter dans l'iframe pour la sélection cross-origin
 * Supporte aussi la modification des éléments en temps réel
 */
const INJECTION_SCRIPT = `
(function() {
  // Éviter l'injection multiple
  if (window.__DOM_SELECTOR_INJECTED__) return;
  window.__DOM_SELECTOR_INJECTED__ = true;

  let isInspecting = false;
  let hoverOverlay = null;
  let currentElement = null;
  let selectedElement = null;

  // Historique des modifications pour undo
  const modificationHistory = [];

  // Créer l'overlay de survol
  function createOverlay() {
    if (hoverOverlay) return;
    
    hoverOverlay = document.createElement('div');
    hoverOverlay.id = '__dom-selector-overlay__';
    hoverOverlay.style.cssText = \`
      position: fixed;
      pointer-events: none;
      z-index: 999999;
      background: rgba(59, 130, 246, 0.15);
      border: 2px solid rgba(59, 130, 246, 0.8);
      transition: all 0.05s ease-out;
      display: none;
    \`;
    document.body.appendChild(hoverOverlay);
  }

  function removeOverlay() {
    if (hoverOverlay) {
      hoverOverlay.remove();
      hoverOverlay = null;
    }
  }

  function getUniqueSelector(element) {
    if (element.id) return '#' + element.id;
    
    const path = [];
    let current = element;
    
    while (current && current !== document.body && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();
      
      if (current.className && typeof current.className === 'string') {
        // Take up to 5 classes for better matching, filter out hover/focus states that might change
        const classes = current.className.trim().split(/\\s+/).filter(c => c && !c.startsWith('hover:') && !c.startsWith('focus:')).slice(0, 5);
        if (classes.length) selector += '.' + classes.join('.');
      }
      
      if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children);
        const sameTag = siblings.filter(s => s.tagName === current.tagName);
        if (sameTag.length > 1) {
          const index = sameTag.indexOf(current) + 1;
          selector += ':nth-of-type(' + index + ')';
        }
      }
      
      path.unshift(selector);
      current = current.parentElement;
    }
    
    return path.join(' > ');
  }

  // Get direct text content (not from children)
  function getDirectTextContent(element) {
    let text = '';
    for (let i = 0; i < element.childNodes.length; i++) {
      const node = element.childNodes[i];
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent || '';
      }
    }
    return text.trim();
  }
  
  // Get information about the element's text structure
  function getTextInfo(element) {
    const hasChildElements = element.children.length > 0;
    const directText = getDirectTextContent(element);
    const fullText = element.textContent?.trim() || '';
    
    // For elements with children, we might want to show what's editable
    if (hasChildElements) {
      return {
        displayText: directText || fullText.substring(0, 100),
        fullText: fullText,
        directText: directText,
        hasChildren: true,
        childCount: element.children.length,
        isComplex: directText !== fullText
      };
    }
    
    return {
      displayText: fullText,
      fullText: fullText,
      directText: fullText,
      hasChildren: false,
      childCount: 0,
      isComplex: false
    };
  }

  function sendBounds(element, type) {
    if (!element) {
      window.parent.postMessage({ 
        type: 'dom-selector-' + type, 
        bounds: null 
      }, '*');
      return;
    }
    
    const rect = element.getBoundingClientRect();
    const textInfo = getTextInfo(element);
    
    window.parent.postMessage({
      type: 'dom-selector-' + type,
      bounds: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        selector: getUniqueSelector(element),
        tagName: element.tagName.toLowerCase(),
        id: element.id || undefined,
        className: element.className || undefined,
        textContent: textInfo.displayText,
        fullTextContent: textInfo.fullText,
        directTextContent: textInfo.directText,
        hasChildren: textInfo.hasChildren,
        childCount: textInfo.childCount,
        isComplexText: textInfo.isComplex
      }
    }, '*');
  }

  function updateOverlay(element) {
    if (!hoverOverlay || !element) {
      if (hoverOverlay) hoverOverlay.style.display = 'none';
      return;
    }
    
    const rect = element.getBoundingClientRect();
    hoverOverlay.style.display = 'block';
    hoverOverlay.style.left = rect.left + 'px';
    hoverOverlay.style.top = rect.top + 'px';
    hoverOverlay.style.width = rect.width + 'px';
    hoverOverlay.style.height = rect.height + 'px';
  }

  function handleMouseMove(e) {
    if (!isInspecting) return;
    
    let element = document.elementFromPoint(e.clientX, e.clientY);
    if (!element || element === hoverOverlay || element === document.body || element === document.documentElement) {
      return;
    }
    
    // Prefer selecting text-containing elements over containers
    // If element has no text but children do, try to find the most specific text element
    if (element.children.length > 0) {
      const textElements = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
      let node;
      while (node = walker.nextNode()) {
        if (node.textContent?.trim() && node.parentElement) {
          textElements.push(node.parentElement);
        }
      }
      
      // Find the smallest element under cursor that contains text
      for (const textEl of textElements) {
        const rect = textEl.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {
          // Prefer smaller, more specific elements
          if (!element.contains(textEl) || textEl.children.length < element.children.length) {
            element = textEl;
            break;
          }
        }
      }
    }
    
    if (element !== currentElement) {
      currentElement = element;
      updateOverlay(element);
      sendBounds(element, 'hover');
    }
  }

  function handleClick(e) {
    if (!isInspecting) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    let element = document.elementFromPoint(e.clientX, e.clientY);
    if (element && element !== hoverOverlay) {
      // Find the most specific text element at click point
      if (element.children.length > 0) {
        const clickX = e.clientX;
        const clickY = e.clientY;
        
        // Get all text-containing descendants
        const candidates = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
        let node;
        while (node = walker.nextNode()) {
          if (node.textContent?.trim() && node.parentElement) {
            const parent = node.parentElement;
            const rect = parent.getBoundingClientRect();
            if (clickX >= rect.left && clickX <= rect.right &&
                clickY >= rect.top && clickY <= rect.bottom) {
              candidates.push({ el: parent, area: rect.width * rect.height });
            }
          }
        }
        
        // Select the smallest element that contains the click
        if (candidates.length > 0) {
          candidates.sort((a, b) => a.area - b.area);
          element = candidates[0].el;
        }
      }
      
      sendBounds(element, 'select');
    }
    
    return false;
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape' && isInspecting) {
      window.parent.postMessage({ type: 'dom-selector-cancel' }, '*');
    }
  }

  // Écouter les messages du parent
  window.addEventListener('message', (e) => {
    if (e.data.type === 'dom-selector-enable') {
      isInspecting = true;
      createOverlay();
      document.body.style.cursor = 'crosshair';
      console.log('[DOMSelector] Inspection enabled');
    } else if (e.data.type === 'dom-selector-disable') {
      isInspecting = false;
      removeOverlay();
      currentElement = null;
      document.body.style.cursor = '';
      console.log('[DOMSelector] Inspection disabled');
    } else if (e.data.type === 'dom-selector-modify-style') {
      // Modifier les styles d'un élément
      const { selector, styles } = e.data;
      const element = document.querySelector(selector);
      if (element) {
        // Sauvegarder l'état précédent pour undo
        const previousStyles = {};
        for (const key of Object.keys(styles)) {
          previousStyles[key] = element.style[key];
        }
        modificationHistory.push({ selector, type: 'style', previous: previousStyles, new: styles });
        
        // Appliquer les nouveaux styles
        for (const [key, value] of Object.entries(styles)) {
          element.style[key] = value;
        }
        console.log('[DOMSelector] Style modified:', selector, styles);
        
        // Notifier le parent
        window.parent.postMessage({ 
          type: 'dom-selector-style-applied', 
          selector, 
          styles 
        }, '*');
      }
    } else if (e.data.type === 'dom-selector-modify-text') {
      // Modifier le texte d'un élément
      const { selector, text, replaceMode = 'smart' } = e.data;
      console.log('[DOMSelector] Attempting to modify text. Selector:', selector, 'New text:', text, 'Mode:', replaceMode);
      
      let element = document.querySelector(selector);
      
      // If element not found, try simpler selectors
      if (!element) {
        console.warn('[DOMSelector] Element not found with selector:', selector);
        // Try without nth-of-type
        const simplifiedSelector = selector.replace(/:nth-of-type\\(\\d+\\)/g, '');
        element = document.querySelector(simplifiedSelector);
        if (element) {
          console.log('[DOMSelector] Found with simplified selector:', simplifiedSelector);
        }
      }
      
      if (element) {
        // Sauvegarder l'état précédent (innerHTML pour restaurer la structure)
        const previousHTML = element.innerHTML;
        const previousText = element.textContent;
        modificationHistory.push({ selector, type: 'text', previous: previousHTML, previousText, new: text });
        
        // Smart text replacement - handle different cases
        const hasChildElements = element.children.length > 0;
        const hasOnlyTextNodes = !hasChildElements;
        
        console.log('[DOMSelector] Element analysis:', {
          tagName: element.tagName,
          hasChildElements,
          childCount: element.children.length,
          innerHTML: element.innerHTML.substring(0, 100)
        });
        
        if (hasOnlyTextNodes || replaceMode === 'full') {
          // Case 1: Simple element with only text content - replace directly
          element.textContent = text;
          console.log('[DOMSelector] Case 1: Simple replacement');
        } else {
          // Case 2: Element has child elements - be smarter about replacement
          // Find all direct text nodes
          const textNodes = [];
          for (let i = 0; i < element.childNodes.length; i++) {
            const node = element.childNodes[i];
            if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
              textNodes.push(node);
            }
          }
          
          console.log('[DOMSelector] Found direct text nodes:', textNodes.length);
          
          if (textNodes.length === 0) {
            // No direct text nodes - element might be a container like <div> with only child elements
            // Check if we should modify the first child with text instead
            const firstTextChild = element.querySelector('*');
            if (firstTextChild && firstTextChild.children.length === 0) {
              firstTextChild.textContent = text;
              console.log('[DOMSelector] Case 2a: Modified first text child');
            } else {
              // Fall back to replacing all content
              element.textContent = text;
              console.log('[DOMSelector] Case 2b: Full replacement (no better option)');
            }
          } else if (textNodes.length === 1) {
            // Single text node - replace just that text
            textNodes[0].textContent = text;
            console.log('[DOMSelector] Case 3: Single text node replacement');
          } else {
            // Multiple text nodes - this is complex content like "text <a>link</a> more text"
            // Determine what the user probably wants:
            // If new text is shorter/similar to first text node, replace first
            // If new text is much longer, it might be intended to replace all
            
            const firstTextContent = textNodes[0].textContent?.trim() || '';
            
            // Check if new text seems to be editing just the first text portion
            if (text.length <= firstTextContent.length * 2 || 
                text.startsWith(firstTextContent.substring(0, 3)) ||
                firstTextContent.startsWith(text.substring(0, 3))) {
              // Likely editing just the first text portion
              textNodes[0].textContent = text;
              console.log('[DOMSelector] Case 4a: Replaced first text node');
            } else {
              // User probably wants to replace all text content
              // Preserve structure by replacing text nodes proportionally or with new text
              // For now, set all to empty and set first to new text
              textNodes.forEach((node, i) => {
                if (i === 0) {
                  node.textContent = text;
                } else {
                  node.textContent = '';
                }
              });
              console.log('[DOMSelector] Case 4b: Replaced all text nodes');
            }
          }
        }
        
        console.log('[DOMSelector] Text modified successfully:', selector, 'to:', text);
        
        window.parent.postMessage({ 
          type: 'dom-selector-text-applied', 
          selector, 
          text,
          success: true
        }, '*');
      } else {
        console.error('[DOMSelector] Element not found for selector:', selector);
        window.parent.postMessage({ 
          type: 'dom-selector-text-applied', 
          selector, 
          text,
          success: false,
          error: 'Element not found'
        }, '*');
      }
    } else if (e.data.type === 'dom-selector-undo') {
      // Annuler la dernière modification
      const last = modificationHistory.pop();
      if (last) {
        const element = document.querySelector(last.selector);
        if (element) {
          if (last.type === 'style') {
            for (const [key, value] of Object.entries(last.previous)) {
              element.style[key] = value;
            }
          } else if (last.type === 'text') {
            // Restore innerHTML to get back original structure
            element.innerHTML = last.previous;
          }
          console.log('[DOMSelector] Undo applied');
          window.parent.postMessage({ type: 'dom-selector-undo-applied' }, '*');
        }
      }
    } else if (e.data.type === 'dom-selector-get-computed-styles') {
      // Récupérer les styles calculés d'un élément
      const { selector } = e.data;
      const element = document.querySelector(selector);
      if (element) {
        const computed = window.getComputedStyle(element);
        const styles = {
          display: computed.display,
          position: computed.position,
          width: computed.width,
          height: computed.height,
          padding: computed.padding,
          margin: computed.margin,
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          fontSize: computed.fontSize,
          fontWeight: computed.fontWeight,
          fontFamily: computed.fontFamily,
          lineHeight: computed.lineHeight,
          textAlign: computed.textAlign,
          borderRadius: computed.borderRadius,
          border: computed.border,
          boxShadow: computed.boxShadow,
          opacity: computed.opacity,
          flexDirection: computed.flexDirection,
          justifyContent: computed.justifyContent,
          alignItems: computed.alignItems,
          gap: computed.gap,
        };
        window.parent.postMessage({ 
          type: 'dom-selector-computed-styles', 
          selector, 
          styles 
        }, '*');
      }
    }
  });

  // Attacher les listeners avec capture pour intercepter avant tout
  document.addEventListener('mousemove', handleMouseMove, { capture: true, passive: true });
  document.addEventListener('click', handleClick, { capture: true });
  document.addEventListener('keydown', handleKeyDown, { capture: true });

  // Notifier le parent que le script est prêt
  window.parent.postMessage({ type: 'dom-selector-ready' }, '*');
  console.log('[DOMSelector] Script injected and ready');
})();
`;

/**
 * Hook de sélection DOM cross-origin utilisant postMessage
 */
export function useDOMSelectorPostMessage({
  iframeRef,
  enabled = true,
  onElementSelect,
}: UseDOMSelectorOptions) {
  const [hoveredBounds, setHoveredBounds] = useState<ElementBounds | null>(null);
  const [selectedBounds, setSelectedBounds] = useState<ElementBounds | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [iframeOffset, setIframeOffset] = useState({ x: 0, y: 0 });

  const injectedRef = useRef(false);

  /**
   * Injecter le script dans l'iframe
   */
  const injectScript = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return false;

    try {
      // Essayer d'accéder directement (same-origin)
      const iframeDoc = iframe.contentDocument;
      if (iframeDoc && iframeDoc.body) {
        const script = iframeDoc.createElement('script');
        script.textContent = INJECTION_SCRIPT;
        iframeDoc.body.appendChild(script);
        console.log('[useDOMSelector] Script injected via contentDocument');
        return true;
      }
    } catch (e) {
      // Cross-origin - utiliser une autre méthode
      console.log('[useDOMSelector] Cannot access contentDocument, using src injection');
    }

    // Pour cross-origin, on doit utiliser postMessage après le chargement
    // Le script doit être inclus dans l'app cible ou via un proxy
    // Pour l'instant, on envoie juste le message et espère que l'app écoute
    iframe.contentWindow?.postMessage({ type: 'dom-selector-inject', script: INJECTION_SCRIPT }, '*');
    
    return false;
  }, [iframeRef]);

  /**
   * Mise à jour de l'offset de l'iframe
   */
  const updateIframeOffset = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const rect = iframe.getBoundingClientRect();
    setIframeOffset({ x: rect.left, y: rect.top });
  }, [iframeRef]);

  /**
   * Écouter les messages de l'iframe
   */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data.type !== 'string') return;
      if (!event.data.type.startsWith('dom-selector-')) return;

      console.log('[useDOMSelector] Received message:', event.data.type);

      switch (event.data.type) {
        case 'dom-selector-ready':
          setIsReady(true);
          console.log('[useDOMSelector] Iframe selector ready');
          break;

        case 'dom-selector-hover':
          if (event.data.bounds) {
            updateIframeOffset();
            setHoveredBounds({
              ...event.data.bounds,
              x: event.data.bounds.x + iframeOffset.x,
              y: event.data.bounds.y + iframeOffset.y,
            });
          } else {
            setHoveredBounds(null);
          }
          break;

        case 'dom-selector-select':
          if (event.data.bounds) {
            updateIframeOffset();
            const bounds = {
              ...event.data.bounds,
              x: event.data.bounds.x + iframeOffset.x,
              y: event.data.bounds.y + iframeOffset.y,
            };
            setSelectedBounds(bounds);
            onElementSelect?.(bounds);
          }
          break;

        case 'dom-selector-cancel':
          setHoveredBounds(null);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [iframeOffset, onElementSelect, updateIframeOffset]);

  /**
   * Gérer l'injection et l'activation
   */
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      console.log('[useDOMSelector] Iframe loaded, injecting script...');
      injectedRef.current = false;
      setIsReady(false);
      
      // Attendre un peu que l'iframe soit vraiment prête
      setTimeout(() => {
        injectScript();
        injectedRef.current = true;
      }, 100);
    };

    iframe.addEventListener('load', handleLoad);
    
    // Si l'iframe est déjà chargée
    if (iframe.contentWindow) {
      handleLoad();
    }

    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, [iframeRef, injectScript]);

  /**
   * Activer/désactiver le mode inspection
   */
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    console.log('[useDOMSelector] Sending enable/disable:', enabled);
    
    if (enabled) {
      iframe.contentWindow.postMessage({ type: 'dom-selector-enable' }, '*');
      updateIframeOffset();
    } else {
      iframe.contentWindow.postMessage({ type: 'dom-selector-disable' }, '*');
      setHoveredBounds(null);
    }
  }, [enabled, iframeRef, updateIframeOffset]);

  const clearSelection = useCallback(() => {
    setSelectedBounds(null);
    setHoveredBounds(null);
  }, []);

  /**
   * Modifier les styles d'un élément dans l'iframe
   */
  const modifyElementStyle = useCallback((selector: string, styles: Record<string, string>) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    iframe.contentWindow.postMessage({
      type: 'dom-selector-modify-style',
      selector,
      styles
    }, '*');
  }, [iframeRef]);

  /**
   * Modifier le texte d'un élément dans l'iframe
   */
  const modifyElementText = useCallback((selector: string, text: string) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    iframe.contentWindow.postMessage({
      type: 'dom-selector-modify-text',
      selector,
      text
    }, '*');
  }, [iframeRef]);

  /**
   * Annuler la dernière modification
   */
  const undoLastModification = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    iframe.contentWindow.postMessage({
      type: 'dom-selector-undo'
    }, '*');
  }, [iframeRef]);

  /**
   * Récupérer les styles calculés d'un élément
   */
  const getComputedStyles = useCallback((selector: string) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    iframe.contentWindow.postMessage({
      type: 'dom-selector-get-computed-styles',
      selector
    }, '*');
  }, [iframeRef]);

  return {
    hoveredBounds,
    selectedBounds,
    clearSelection,
    isReady,
    iframeOffset,
    // Modification functions
    modifyElementStyle,
    modifyElementText,
    undoLastModification,
    getComputedStyles,
  };
}
