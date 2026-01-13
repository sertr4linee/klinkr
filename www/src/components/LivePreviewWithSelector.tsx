"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  XIcon,
  MousePointerClickIcon,
  LayersIcon,
  CopyIcon,
  CodeIcon,
  RefreshCwIcon,
  MaximizeIcon,
  MinimizeIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  EyeIcon,
  EyeOffIcon,
  TargetIcon,
  BoxSelectIcon,
  PencilIcon,
  ExternalLinkIcon,
} from "lucide-react";
import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useDOMSelectorPostMessage, ElementBounds } from "@/hooks/useDOMSelectorPostMessage";
import { DOMOverlay } from "@/components/DOMOverlay";
import { ElementEditor, type ElementData, type ElementStyles, type ElementChanges } from "@/components/ElementEditor";
import { useVSCodeBridge } from "@/hooks/useVSCodeBridge";
import type { RealmID } from "@/realm/types";

// Types
interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  fullTextContent?: string;
  directTextContent?: string;
  hasChildren?: boolean;
  childCount?: number;
  isComplexText?: boolean;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  computedStyles: {
    display: string;
    position: string;
    backgroundColor: string;
    color: string;
    fontSize: string;
    fontFamily: string;
    padding: string;
    margin: string;
    border: string;
    borderRadius: string;
    width: string;
    height: string;
  };
  path: string[]; // DOM path
  attributes: Record<string, string>;
  children: number;
}

interface ElementSelectorContextValue {
  isSelecting: boolean;
  setIsSelecting: (value: boolean) => void;
  selectedElement: ElementInfo | null;
  setSelectedElement: (element: ElementInfo | null) => void;
  hoveredElement: ElementInfo | null;
  setHoveredElement: (element: ElementInfo | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean) => void;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

const ElementSelectorContext = createContext<ElementSelectorContextValue | null>(null);

const useElementSelector = () => {
  const context = useContext(ElementSelectorContext);
  if (!context) {
    throw new Error("useElementSelector must be used within an ElementSelectorProvider");
  }
  return context;
};

// Main component
interface LivePreviewWithSelectorProps {
  url: string;
  onClose?: () => void;
  onRefresh?: () => void;
  className?: string;
}

export function LivePreviewWithSelector({
  url,
  onClose,
  onRefresh,
  className,
}: LivePreviewWithSelectorProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [hoveredElement, setHoveredElement] = useState<ElementInfo | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  
  // Pending changes tracking for REALM integration
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [currentRealmId, setCurrentRealmId] = useState<RealmID | null>(null);
  
  // Store accumulated pending changes for legacy fallback (when REALM not connected)
  const [pendingStyleChanges, setPendingStyleChanges] = useState<Partial<ElementStyles>>({});
  const [pendingTextChange, setPendingTextChange] = useState<string | null>(null);

  // VS Code bridge for applying changes to code - with REALM API
  const { 
    applyElementChanges: applyChangesToCode,
    // REALM Protocol API
    realmConnectionState,
    isRealmConnected,
    selectedRealmElement,
    sendRealmStyleChange,
    sendRealmTextChange,
    commitRealmChanges,
    rollbackRealmChanges,
  } = useVSCodeBridge();

  // Utiliser le nouveau sélecteur DOM cross-origin avec postMessage
  const {
    hoveredBounds,
    selectedBounds,
    clearSelection: clearDOMSelection,
    isReady: selectorReady,
    modifyElementStyle,
    modifyElementText,
    undoLastModification,
  } = useDOMSelectorPostMessage({
    iframeRef,
    enabled: isSelecting && iframeLoaded,
    onElementSelect: (bounds: ElementBounds) => {
      console.log('[LivePreview] Element selected:', bounds);
      
      const elementInfo: ElementInfo = {
        tagName: bounds.tagName,
        id: bounds.id || undefined,
        className: bounds.className || undefined,
        textContent: bounds.textContent,
        fullTextContent: bounds.fullTextContent,
        directTextContent: bounds.directTextContent,
        hasChildren: bounds.hasChildren,
        childCount: bounds.childCount,
        isComplexText: bounds.isComplexText,
        rect: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        },
        computedStyles: bounds.computedStyles ? {
          display: bounds.computedStyles.display || '',
          position: bounds.computedStyles.position || '',
          backgroundColor: bounds.computedStyles.backgroundColor || '',
          color: bounds.computedStyles.color || '',
          fontSize: bounds.computedStyles.fontSize || '',
          fontFamily: bounds.computedStyles.fontFamily || '',
          padding: bounds.computedStyles.padding || '',
          margin: bounds.computedStyles.margin || '',
          border: bounds.computedStyles.border || '',
          borderRadius: bounds.computedStyles.borderRadius || '',
          width: bounds.computedStyles.width || `${bounds.width}px`,
          height: bounds.computedStyles.height || `${bounds.height}px`,
        } : {
          display: 'block',
          position: 'relative',
          backgroundColor: '',
          color: '',
          fontSize: '',
          fontFamily: '',
          padding: '',
          margin: '',
          border: '',
          borderRadius: '',
          width: `${bounds.width}px`,
          height: `${bounds.height}px`,
        },
        path: [bounds.selector],
        attributes: bounds.attributes || {},
        children: bounds.children || 0,
      };
      
      setSelectedElement(elementInfo);
      setIsSelecting(false);
    },
  });

  // Mettre à jour hoveredElement à partir des bounds
  useEffect(() => {
    if (hoveredBounds) {
      const mockElement: ElementInfo = {
        tagName: hoveredBounds.tagName,
        id: hoveredBounds.id || undefined,
        className: hoveredBounds.className || undefined,
        textContent: hoveredBounds.textContent?.substring(0, 50),
        rect: {
          x: hoveredBounds.x,
          y: hoveredBounds.y,
          width: hoveredBounds.width,
          height: hoveredBounds.height,
        },
        computedStyles: hoveredBounds.computedStyles ? {
          display: hoveredBounds.computedStyles.display || 'block',
          position: hoveredBounds.computedStyles.position || 'relative',
          backgroundColor: hoveredBounds.computedStyles.backgroundColor || '',
          color: hoveredBounds.computedStyles.color || '',
          fontSize: hoveredBounds.computedStyles.fontSize || '',
          fontFamily: hoveredBounds.computedStyles.fontFamily || '',
          padding: hoveredBounds.computedStyles.padding || '',
          margin: hoveredBounds.computedStyles.margin || '',
          border: hoveredBounds.computedStyles.border || '',
          borderRadius: hoveredBounds.computedStyles.borderRadius || '',
          width: hoveredBounds.computedStyles.width || '',
          height: hoveredBounds.computedStyles.height || '',
        } : {
          display: 'block',
          position: 'relative',
          backgroundColor: '',
          color: '',
          fontSize: '',
          fontFamily: '',
          padding: '',
          margin: '',
          border: '',
          borderRadius: '',
          width: '',
          height: '',
        },
        path: [hoveredBounds.selector],
        attributes: hoveredBounds.attributes || {},
        children: hoveredBounds.children || 0,
      };
      setHoveredElement(mockElement);
    } else {
      setHoveredElement(null);
    }
  }, [hoveredBounds]);

  const contextValue: ElementSelectorContextValue = {
    isSelecting,
    setIsSelecting,
    selectedElement,
    setSelectedElement,
    hoveredElement,
    setHoveredElement,
    sidebarOpen,
    setSidebarOpen,
    iframeRef,
  };

  const handleIframeLoad = () => {
    console.log('[LivePreview] Iframe loaded');
    // With postMessage system, we don't need contentDocument access
    // Just mark as loaded - the script will inject itself
    setIframeLoaded(true);
  };

  const handleRefresh = () => {
    console.log('[LivePreview] Refresh clicked');
    setIframeLoaded(false);
    setSelectedElement(null);
    setHoveredElement(null);
    clearDOMSelection();
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
    onRefresh?.();
  };

  const clearSelection = () => {
    console.log('[LivePreview] Clear selection clicked');
    setSelectedElement(null);
    setHoveredElement(null);
    clearDOMSelection();
    setIsEditing(false);
  };

  // Convert ElementInfo to ElementData for the editor
  const getElementData = useCallback((): ElementData | null => {
    if (!selectedElement) return null;
    
    // Use the original selector from DOMSelectorBridge which includes the full path with nth-of-type
    // This is critical for distinguishing between similar elements
    const selector = selectedElement.path?.[0] || (() => {
      // Fallback: generate a basic selector
      if (selectedElement.id) return `#${selectedElement.id}`;
      if (selectedElement.className) {
        const classes = selectedElement.className.split(' ').slice(0, 3).join('.');
        return `${selectedElement.tagName}.${classes}`;
      }
      return selectedElement.tagName;
    })();
    
    console.log('[LivePreview] Using selector:', selector);
    
    return {
      selector,
      tagName: selectedElement.tagName,
      id: selectedElement.id,
      className: selectedElement.className,
      textContent: selectedElement.textContent,
      fullTextContent: selectedElement.fullTextContent,
      directTextContent: selectedElement.directTextContent,
      hasChildren: selectedElement.hasChildren,
      childCount: selectedElement.childCount,
      isComplexText: selectedElement.isComplexText,
      styles: {
        display: selectedElement.computedStyles.display,
        position: selectedElement.computedStyles.position,
        backgroundColor: selectedElement.computedStyles.backgroundColor,
        color: selectedElement.computedStyles.color,
        fontSize: selectedElement.computedStyles.fontSize,
        fontFamily: selectedElement.computedStyles.fontFamily,
        padding: selectedElement.computedStyles.padding,
        margin: selectedElement.computedStyles.margin,
        border: selectedElement.computedStyles.border,
        borderRadius: selectedElement.computedStyles.borderRadius,
        width: selectedElement.computedStyles.width,
        height: selectedElement.computedStyles.height,
      },
      attributes: selectedElement.attributes,
    };
  }, [selectedElement]);

  // Handle style changes - apply live to iframe
  const handleStyleChange = useCallback((selector: string, styles: Partial<ElementStyles>) => {
    console.log('[LivePreview] Style change:', selector, styles);
    // Convert to Record<string, string>
    const styleRecord: Record<string, string> = {};
    for (const [key, value] of Object.entries(styles)) {
      if (value) styleRecord[key] = value;
    }
    modifyElementStyle(selector, styleRecord);
    
    // Mark pending changes for REALM
    setHasPendingChanges(true);
    
    // Accumulate style changes for legacy fallback
    setPendingStyleChanges(prev => ({ ...prev, ...styles }));
    
    // If REALM is connected and we have a realmId, use REALM protocol (preview mode)
    if (isRealmConnected && currentRealmId) {
      sendRealmStyleChange(currentRealmId, styles as Record<string, string>, true);
    }
  }, [modifyElementStyle, isRealmConnected, currentRealmId, sendRealmStyleChange]);

  // Handle text changes - apply live to iframe
  const handleTextChange = useCallback((selector: string, text: string) => {
    console.log('[LivePreview] Text change:', selector, text);
    modifyElementText(selector, text);
    
    // Mark pending changes for REALM
    setHasPendingChanges(true);
    
    // Store text change for legacy fallback
    setPendingTextChange(text);
    
    // If REALM is connected and we have a realmId, use REALM protocol (preview mode)
    if (isRealmConnected && currentRealmId) {
      sendRealmTextChange(currentRealmId, text, true);
    }
  }, [modifyElementText, isRealmConnected, currentRealmId, sendRealmTextChange]);

  // Handle applying changes to actual code files
  const handleApplyToCode = useCallback((selector: string, changes: ElementChanges) => {
    console.log('[LivePreview] Apply to code:', selector, changes);
    
    // If REALM is connected and we have a realmId, commit via REALM
    if (isRealmConnected && currentRealmId) {
      console.log('[LivePreview/REALM] Committing changes via REALM protocol');
      commitRealmChanges(currentRealmId);
      setHasPendingChanges(false);
      setPendingStyleChanges({});
      setPendingTextChange(null);
    } else {
      // Fallback: Send to VS Code extension to apply changes to source files
      // Build the changes object from accumulated pending changes
      const accumulatedChanges: ElementChanges = {
        ...changes,
      };
      
      // Add pending style changes
      if (Object.keys(pendingStyleChanges).length > 0) {
        accumulatedChanges.styles = pendingStyleChanges;
      }
      
      // Add pending text change
      if (pendingTextChange !== null) {
        accumulatedChanges.textContent = pendingTextChange;
      }
      
      console.log('[LivePreview] Fallback: Using legacy applyElementChanges with accumulated changes:', accumulatedChanges);
      applyChangesToCode(selector, accumulatedChanges as Record<string, unknown>, url);
      
      // Clear pending changes after sending
      setHasPendingChanges(false);
      setPendingStyleChanges({});
      setPendingTextChange(null);
    }
  }, [applyChangesToCode, url, isRealmConnected, currentRealmId, commitRealmChanges, pendingStyleChanges, pendingTextChange]);
  
  // Handle rollback (undo pending changes)
  const handleRollback = useCallback(() => {
    if (currentRealmId && isRealmConnected) {
      console.log('[LivePreview/REALM] Rolling back changes');
      rollbackRealmChanges(currentRealmId);
    }
    // Clear pending changes
    setHasPendingChanges(false);
    setPendingStyleChanges({});
    setPendingTextChange(null);
    // Also undo the visual changes in iframe
    undoLastModification?.();
  }, [currentRealmId, isRealmConnected, rollbackRealmChanges, undoLastModification]);

  // Debug: Log quand isSelecting change
  useEffect(() => {
    console.log('[LivePreview] isSelecting changed:', isSelecting);
    console.log('[LivePreview] iframeLoaded:', iframeLoaded);
    console.log('[LivePreview] iframeRef.current:', iframeRef.current);
  }, [isSelecting, iframeLoaded]);

  return (
    <ElementSelectorContext.Provider value={contextValue}>
      <div
        className={cn(
          "flex h-screen w-full bg-zinc-950",
          isFullscreen && "fixed inset-0 z-50",
          className
        )}
      >
        {/* Main Preview Area */}
        <div className="flex flex-1 flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm px-4 py-3 gap-4">
            {/* Left: Tools */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                <Button
                  variant={isSelecting ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setIsSelecting(!isSelecting)}
                  className={cn(
                    "h-7 px-3 text-xs gap-2 transition-all",
                    isSelecting && "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                  )}
                  disabled={!iframeLoaded}
                  title="Select Element (Cmd+Click)"
                >
                  <MousePointerClickIcon className="size-3.5" />
                  <span className="font-medium">Select</span>
                </Button>
                
                {selectedElement && (
                  <>
                    <div className="w-px h-4 bg-zinc-800 mx-1" />
                    <Button
                      variant={isEditing ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setIsEditing(!isEditing)}
                      className={cn(
                        "h-7 px-3 text-xs gap-2 transition-all",
                        isEditing && "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      )}
                    >
                      <PencilIcon className="size-3.5" />
                      <span className="font-medium">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                      className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-300"
                      title="Clear Selection"
                    >
                      <XIcon className="size-3.5" />
                    </Button>
                  </>
                )}
              </div>

              {/* Status Indicators */}
              {!iframeLoaded && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-500 rounded-md text-xs font-medium border border-amber-500/20">
                  <RefreshCwIcon className="size-3 animate-spin" />
                  Loading...
                </div>
              )}
              
              {hoveredElement && isSelecting && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-md text-xs border border-blue-500/20 animate-in fade-in slide-in-from-left-2 duration-200">
                  <TargetIcon className="size-3" />
                  <span className="font-mono font-medium">{hoveredElement.tagName.toLowerCase()}</span>
                  {hoveredElement.className && (
                    <span className="opacity-50 truncate max-w-[100px]">.{hoveredElement.className.split(' ')[0]}</span>
                  )}
                </div>
              )}
            </div>

            {/* Center: Address Bar */}
            <div className="flex-1 max-w-xl mx-auto">
              <div className="relative group">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <div className={cn(
                    "size-2 rounded-full transition-colors",
                    realmConnectionState === 'connected' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" :
                    realmConnectionState === 'connecting' ? "bg-amber-500 animate-pulse" :
                    "bg-zinc-600"
                  )} />
                </div>
                <div className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 pl-8 pr-16 text-xs text-zinc-400 font-mono flex items-center transition-colors group-hover:border-zinc-700">
                  <span className="truncate">{url}</span>
                </div>
                <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRefresh}
                    className="size-6 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-md"
                    title="Refresh Preview"
                  >
                    <RefreshCwIcon className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(url, '_blank')}
                    className="size-6 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-md"
                    title="Open in new tab"
                  >
                    <ExternalLinkIcon className="size-3" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Right: Window Controls */}
            <div className="flex items-center gap-1">
              <Button
                variant={sidebarOpen ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={cn(
                  "h-8 w-8 p-0 transition-colors",
                  sidebarOpen ? "bg-zinc-800 text-zinc-200" : "text-zinc-500 hover:text-zinc-300"
                )}
                title="Toggle Sidebar"
              >
                <LayersIcon className="size-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-300"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? (
                  <MinimizeIcon className="size-4" />
                ) : (
                  <MaximizeIcon className="size-4" />
                )}
              </Button>
              
              {onClose && (
                <>
                  <div className="w-px h-4 bg-zinc-800 mx-2" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="h-8 w-8 p-0 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                    title="Close Preview"
                  >
                    <XIcon className="size-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Preview Iframe */}
          <div className="relative flex-1 bg-white">
            <iframe
              ref={iframeRef}
              src={url}
              className="size-full border-none"
              onLoad={handleIframeLoad}
              title="Live Preview"
            />
            
            {/* Production-grade DOM Overlay */}
            {isSelecting && iframeLoaded && (
              <DOMOverlay
                hoveredBounds={hoveredBounds}
                selectedBounds={selectedBounds}
                showLabel={true}
              />
            )}
            
            {!iframeLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                <div className="flex flex-col items-center gap-3">
                  <RefreshCwIcon className="size-8 animate-spin text-blue-500" />
                  <span className="text-zinc-400">Loading preview...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        {sidebarOpen && (
          isEditing && selectedElement ? (
            <ElementEditor
              element={getElementData()}
              onStyleChange={handleStyleChange}
              onTextChange={handleTextChange}
              onApplyToCode={handleApplyToCode}
              onSaveComplete={() => {
                setSelectedElement(null);
                setIsEditing(false);
              }}
              className="w-96 border-l border-zinc-800 h-full max-h-screen"
            />
          ) : (
            <ElementSelectorSidebar
              selectedElement={selectedElement}
              hoveredElement={hoveredElement}
            />
          )
        )}
      </div>
    </ElementSelectorContext.Provider>
  );
}

// Sidebar Component
interface ElementSelectorSidebarProps {
  selectedElement: ElementInfo | null;
  hoveredElement: ElementInfo | null;
}

function ElementSelectorSidebar({
  selectedElement,
  hoveredElement,
}: ElementSelectorSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["info", "styles", "attributes"])
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const currentElement = selectedElement || hoveredElement;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const generateSelector = (element: ElementInfo): string => {
    if (element.id) return `#${element.id}`;
    if (element.className) {
      const classes = element.className.split(' ').slice(0, 3).join('.');
      return `${element.tagName}.${classes}`;
    }
    return element.tagName;
  };

  return (
    <div className="flex w-80 flex-col border-l border-zinc-800 bg-zinc-900">
      {/* Header */}
      <div className="border-b border-zinc-800 p-4 bg-zinc-800">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="flex items-center justify-center size-6 rounded bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
            <BoxSelectIcon className="size-3.5" />
          </div>
          <h2 className="text-xs font-semibold text-zinc-100 uppercase tracking-wide">
            Inspector
          </h2>
        </div>
        <p className="text-[11px] text-zinc-500 pl-[34px]">
          {selectedElement
            ? "Viewing selected element details"
            : hoveredElement
            ? "Hovering element details"
            : "Select an element to inspect"}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {currentElement ? (
          <div className="divide-y divide-zinc-800/50">
            {/* Element Info */}
            <SidebarSection
              title="Identity"
              icon={<TargetIcon className="size-3.5" />}
              isExpanded={expandedSections.has("info")}
              onToggle={() => toggleSection("info")}
            >
              <div className="space-y-4">
                <InfoRow
                  label="Tag Name"
                  value={currentElement.tagName.toLowerCase()}
                  onCopy={() => copyToClipboard(currentElement.tagName)}
                  isCode
                />
                {currentElement.id && (
                  <InfoRow
                    label="ID"
                    value={`#${currentElement.id}`}
                    onCopy={() => copyToClipboard(currentElement.id!)}
                    isCode
                    textColor="text-amber-400"
                  />
                )}
                {currentElement.className && (
                  <InfoRow
                    label="Classes"
                    value={currentElement.className}
                    onCopy={() => copyToClipboard(currentElement.className!)}
                    multiline
                    isCode
                    textColor="text-blue-300"
                  />
                )}
                <InfoRow
                  label="Selector"
                  value={generateSelector(currentElement)}
                  onCopy={() => copyToClipboard(generateSelector(currentElement))}
                  highlight
                  isCode
                />
                
                {/* Path */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    Hierarchy
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {currentElement.path.map((segment, i) => (
                      <div key={i} className="flex items-center text-[10px]">
                        <code className={cn(
                          "px-1.5 py-0.5 rounded border",
                          i === currentElement.path.length - 1 
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20" 
                            : "bg-zinc-900 text-zinc-400 border-zinc-800"
                        )}>
                          {segment.split(':')[0]}
                        </code>
                        {i < currentElement.path.length - 1 && (
                          <ChevronRightIcon className="size-3 text-zinc-700 mx-0.5" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SidebarSection>

            {/* Dimensions */}
            <SidebarSection
              title="Layout & Geometry"
              icon={<MaximizeIcon className="size-3.5" />}
              isExpanded={expandedSections.has("dimensions")}
              onToggle={() => toggleSection("dimensions")}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2 rounded bg-zinc-900/50 border border-zinc-800/50 space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase">Size</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-mono text-zinc-300">{Math.round(currentElement.rect.width)}</span>
                    <span className="text-[10px] text-zinc-600">×</span>
                    <span className="text-xs font-mono text-zinc-300">{Math.round(currentElement.rect.height)}</span>
                  </div>
                </div>
                <div className="p-2 rounded bg-zinc-900/50 border border-zinc-800/50 space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase">Position</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] text-zinc-500">x:</span>
                    <span className="text-xs font-mono text-zinc-300">{Math.round(currentElement.rect.x)}</span>
                    <span className="text-[10px] text-zinc-500">y:</span>
                    <span className="text-xs font-mono text-zinc-300">{Math.round(currentElement.rect.y)}</span>
                  </div>
                </div>
              </div>
            </SidebarSection>

            {/* Styles */}
            <SidebarSection
              title="Computed Styles"
              icon={<CodeIcon className="size-3.5" />}
              isExpanded={expandedSections.has("styles")}
              onToggle={() => toggleSection("styles")}
            >
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(currentElement.computedStyles).map(
                  ([key, value]) => value && (
                    <div key={key} className="grid grid-cols-[100px_1fr] items-center gap-2 text-[11px]">
                      <span className="text-zinc-500 truncate" title={key}>
                        {key.replace(/([A-Z])/g, "-$1").toLowerCase()}
                      </span>
                      <code className="font-mono text-zinc-300 truncate bg-zinc-900/50 px-1.5 py-0.5 rounded border border-zinc-800/50" title={value}>
                        {value}
                      </code>
                    </div>
                  )
                )}
              </div>
            </SidebarSection>

            {/* Attributes */}
            <SidebarSection
              title="Attributes"
              icon={<LayersIcon className="size-3.5" />}
              isExpanded={expandedSections.has("attributes")}
              onToggle={() => toggleSection("attributes")}
            >
              {Object.keys(currentElement.attributes).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(currentElement.attributes).map(
                    ([key, value]) => (
                      <div key={key} className="flex flex-col gap-1">
                        <span className="text-[10px] text-zinc-500 font-mono">{key}</span>
                        <code className="text-[11px] bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-300 break-all">
                          {value || '""'}
                        </code>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="text-center py-2">
                  <span className="text-[10px] text-zinc-600 italic">No attributes found</span>
                </div>
              )}
            </SidebarSection>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center opacity-50">
            <div className="size-12 rounded-full bg-zinc-900 flex items-center justify-center mb-4 ring-1 ring-zinc-800">
              <MousePointerClickIcon className="size-5 text-zinc-600" />
            </div>
            <p className="text-zinc-400 font-medium text-sm">No Selection</p>
            <p className="text-zinc-600 text-xs mt-1 max-w-[180px]">
              Click an element in the preview to inspect its properties
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Section Component
interface SidebarSectionProps {
  title: string;
  icon: ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function SidebarSection({
  title,
  icon,
  isExpanded,
  onToggle,
  children,
}: SidebarSectionProps) {
  return (
    <div className="group">
      <button
        className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-zinc-900 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-400 group-hover:text-zinc-200 uppercase tracking-wider">
          {icon}
          {title}
        </div>
        {isExpanded ? (
          <ChevronDownIcon className="size-3.5 text-zinc-600 group-hover:text-zinc-400" />
        ) : (
          <ChevronRightIcon className="size-3.5 text-zinc-600 group-hover:text-zinc-400" />
        )}
      </button>
      {isExpanded && <div className="px-4 pb-4 pt-1 animate-in slide-in-from-top-1 duration-200">{children}</div>}
    </div>
  );
}

// Info Row Component
interface InfoRowProps {
  label: string;
  value: string;
  onCopy?: () => void;
  multiline?: boolean;
  highlight?: boolean;
  isCode?: boolean;
  textColor?: string;
}

function InfoRow({ label, value, onCopy, multiline, highlight, isCode, textColor }: InfoRowProps) {
  return (
    <div className={cn("group/row space-y-1.5", multiline && "flex flex-col")}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
          {label}
        </span>
        {onCopy && (
          <button
            className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-zinc-300"
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
            title="Copy value"
          >
            <CopyIcon className="size-3" />
          </button>
        )}
      </div>
      <div className={cn(
        "relative rounded-md border transition-colors",
        highlight 
          ? "bg-blue-500/10 border-blue-500/20" 
          : "bg-zinc-900 border-zinc-800 group-hover/row:border-zinc-700"
      )}>
        <div className={cn(
          "px-2.5 py-1.5 text-[11px]",
          isCode && "font-mono",
          textColor || (highlight ? "text-blue-300" : "text-zinc-300"),
          multiline && "break-all leading-relaxed"
        )}>
          {value}
        </div>
      </div>
    </div>
  );
}

export default LivePreviewWithSelector;
