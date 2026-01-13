'use client';

import { useEffect } from 'react';

export function DOMSelectorBridge() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).__DOM_SELECTOR_INJECTED__) return;
    (window as any).__DOM_SELECTOR_INJECTED__ = true;

    console.log('[DOMSelectorBridge] Initializing...');

    let isInspecting = false;
    let hoverOverlay: HTMLDivElement | null = null;
    let currentElement: Element | null = null;

    function createOverlay() {
      if (hoverOverlay) return;
      hoverOverlay = document.createElement('div');
      hoverOverlay.id = '__dom-selector-overlay__';
      hoverOverlay.style.cssText = 'position: fixed; pointer-events: none; z-index: 999999; background: rgba(59, 130, 246, 0.15); border: 2px solid rgba(59, 130, 246, 0.8); transition: all 0.05s ease-out; display: none;';
      document.body.appendChild(hoverOverlay);
    }

    function removeOverlay() {
      if (hoverOverlay) {
        hoverOverlay.remove();
        hoverOverlay = null;
      }
    }

    function getUniqueSelector(element: Element): string {
      if (element.id) return '#' + element.id;
      const path: string[] = [];
      let current: Element | null = element;
      while (current && current !== document.body && current !== document.documentElement) {
        let selector = current.tagName.toLowerCase();
        if (current.className && typeof current.className === 'string') {
          const classes = current.className.trim().split(/\s+/).filter((c: string) => c && !c.startsWith('hover')).slice(0, 2);
          if (classes.length) selector += '.' + classes.join('.');
        }
        if (current.parentElement) {
          const siblings = Array.from(current.parentElement.children);
          const sameTag = siblings.filter(s => s.tagName === current!.tagName);
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

    function getDirectTextContent(element: Element): string {
      let text = '';
      for (let i = 0; i < element.childNodes.length; i++) {
        const node = element.childNodes[i];
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent || '';
        }
      }
      return text.trim();
    }

    function sendBounds(element: Element | null, type: string) {
      if (!element) {
        window.parent.postMessage({ type: 'dom-selector-' + type, bounds: null }, '*');
        return;
      }
      const rect = element.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(element);
      const directText = getDirectTextContent(element);
      const fullText = element.textContent?.trim() || '';
      const hasChildren = element.children.length > 0;
      const isComplexText = hasChildren && directText !== fullText;
      
      const styles = {
        display: computedStyle.display, position: computedStyle.position, backgroundColor: computedStyle.backgroundColor,
        color: computedStyle.color, fontSize: computedStyle.fontSize, fontFamily: computedStyle.fontFamily,
        fontWeight: computedStyle.fontWeight, lineHeight: computedStyle.lineHeight,
        padding: computedStyle.padding, paddingTop: computedStyle.paddingTop, paddingRight: computedStyle.paddingRight,
        paddingBottom: computedStyle.paddingBottom, paddingLeft: computedStyle.paddingLeft,
        margin: computedStyle.margin, marginTop: computedStyle.marginTop, marginRight: computedStyle.marginRight,
        marginBottom: computedStyle.marginBottom, marginLeft: computedStyle.marginLeft,
        border: computedStyle.border, borderRadius: computedStyle.borderRadius,
        width: computedStyle.width, height: computedStyle.height, maxWidth: computedStyle.maxWidth, maxHeight: computedStyle.maxHeight,
        minWidth: computedStyle.minWidth, minHeight: computedStyle.minHeight, boxSizing: computedStyle.boxSizing,
        flexDirection: computedStyle.flexDirection, flexWrap: computedStyle.flexWrap, justifyContent: computedStyle.justifyContent,
        alignItems: computedStyle.alignItems, gap: computedStyle.gap, gridTemplateColumns: computedStyle.gridTemplateColumns,
        gridTemplateRows: computedStyle.gridTemplateRows, textAlign: computedStyle.textAlign, textDecoration: computedStyle.textDecoration,
        textTransform: computedStyle.textTransform, letterSpacing: computedStyle.letterSpacing,
        opacity: computedStyle.opacity, transform: computedStyle.transform, transition: computedStyle.transition,
        cursor: computedStyle.cursor, overflow: computedStyle.overflow, zIndex: computedStyle.zIndex,
      };
      const attributes: Record<string, string> = {};
      if (element instanceof HTMLElement) {
        Array.from(element.attributes).forEach(attr => { attributes[attr.name] = attr.value; });
      }
      
      window.parent.postMessage({
        type: 'dom-selector-' + type,
        bounds: {
          x: rect.left, y: rect.top, width: rect.width, height: rect.height,
          selector: getUniqueSelector(element), tagName: element.tagName.toLowerCase(),
          id: element.id || undefined, className: element.className || undefined,
          computedStyles: styles, attributes: attributes,
          textContent: isComplexText ? directText : fullText.substring(0, 200),
          fullTextContent: fullText.substring(0, 500),
          directTextContent: directText,
          hasChildren: hasChildren,
          childCount: element.children.length,
          isComplexText: isComplexText,
        }
      }, '*');
    }

    function updateOverlay(element: Element | null) {
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

    function handleMouseMove(e: MouseEvent) {
      if (!isInspecting) return;
      const element = document.elementFromPoint(e.clientX, e.clientY);
      if (!element || element === hoverOverlay || element === document.body || element === document.documentElement) return;
      if (element !== currentElement) {
        currentElement = element;
        updateOverlay(element);
        sendBounds(element, 'hover');
      }
    }

    function handleClick(e: MouseEvent) {
      if (!isInspecting) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const element = document.elementFromPoint(e.clientX, e.clientY);
      if (element && element !== hoverOverlay) {
        sendBounds(element, 'select');
      }
      return false;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isInspecting) {
        window.parent.postMessage({ type: 'dom-selector-cancel' }, '*');
      }
    }

    // Helper function to find element by complex selector path
    function findElementByPath(selectorPath: string): Element | null {
      try {
        const direct = document.querySelector(selectorPath);
        if (direct) return direct;
      } catch (e) {}

      const parts = selectorPath.split(' > ').map(s => s.trim()).filter(s => s);
      if (parts.length === 0) return null;

      let current: Element | null = document.body;
      
      for (const part of parts) {
        if (!current) return null;
        
        const nthMatch = part.match(/:nth-of-type\((\d+)\)$/);
        const nthIndex = nthMatch ? parseInt(nthMatch[1]) : null;
        const cleanPart = part.replace(/:nth-of-type\(\d+\)$/, '');
        
        const tagMatch = cleanPart.match(/^([a-z0-9]+)/i);
        const tag = tagMatch ? tagMatch[1].toUpperCase() : null;
        const classMatch = cleanPart.match(/\.([^.]+)/g);
        const classes = classMatch ? classMatch.map(c => c.slice(1)) : [];
        
        const childElements: Element[] = Array.from(current.children);
        const matching: Element[] = childElements.filter((child: Element) => {
          if (tag && child.tagName !== tag) return false;
          if (classes.length > 0) {
            const childClasses = (child.className as string)?.split?.(/\s+/) || [];
            if (!classes.some(c => childClasses.includes(c))) return false;
          }
          return true;
        });
        
        if (nthIndex !== null && nthIndex >= 1 && nthIndex <= matching.length) {
          current = matching[nthIndex - 1];
        } else if (matching.length > 0) {
          current = matching[0];
        } else {
          try {
            current = current.querySelector(cleanPart);
          } catch {
            return null;
          }
        }
      }
      
      return current;
    }

    function handleMessage(e: MessageEvent) {
      const { type, selector, styles, text } = e.data || {};
      
      if (type === 'dom-selector-enable') {
        isInspecting = true;
        createOverlay();
        document.body.style.cursor = 'crosshair';
      } else if (type === 'dom-selector-disable') {
        isInspecting = false;
        removeOverlay();
        currentElement = null;
        document.body.style.cursor = '';
      } else if (type === 'dom-selector-modify-style') {
        const element = findElementByPath(selector);
        if (element && element instanceof HTMLElement) {
          Object.entries(styles || {}).forEach(([key, value]) => {
            (element as HTMLElement).style[key as any] = value as string;
          });
          window.parent.postMessage({ type: 'dom-selector-style-applied', selector, styles }, '*');
        }
      } else if (type === 'dom-selector-modify-text') {
        const element = findElementByPath(selector);
        if (element) {
          const hasChildElements = element.children.length > 0;
          if (!hasChildElements) {
            element.textContent = text;
          } else {
            const textNodes: ChildNode[] = [];
            for (let i = 0; i < element.childNodes.length; i++) {
              const node = element.childNodes[i];
              if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
                textNodes.push(node);
              }
            }
            if (textNodes.length === 0) {
              const firstChild = element.children[0];
              if (firstChild && firstChild.children.length === 0) {
                firstChild.textContent = text;
              } else {
                element.textContent = text;
              }
            } else {
              textNodes[0].textContent = text;
            }
          }
          window.parent.postMessage({ type: 'dom-selector-text-applied', selector, text }, '*');
          sendBounds(element, 'select');
        }
      }
    }

    window.addEventListener('message', handleMessage);
    document.addEventListener('mousemove', handleMouseMove, { capture: true, passive: true });
    document.addEventListener('click', handleClick, { capture: true });
    document.addEventListener('keydown', handleKeyDown, { capture: true });

    window.parent.postMessage({ type: 'dom-selector-ready' }, '*');

    return () => {
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('mousemove', handleMouseMove, { capture: true } as any);
      document.removeEventListener('click', handleClick, { capture: true } as any);
      document.removeEventListener('keydown', handleKeyDown, { capture: true } as any);
      removeOverlay();
      (window as any).__DOM_SELECTOR_INJECTED__ = false;
    };
  }, []);

  return null;
}
