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

  // VS Code bridge for applying changes to code
  const { applyElementChanges: applyChangesToCode } = useVSCodeBridge();

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
  }, [modifyElementStyle]);

  // Handle text changes - apply live to iframe
  const handleTextChange = useCallback((selector: string, text: string) => {
    console.log('[LivePreview] Text change:', selector, text);
    modifyElementText(selector, text);
  }, [modifyElementText]);

  // Handle applying changes to actual code files
  const handleApplyToCode = useCallback((selector: string, changes: ElementChanges) => {
    console.log('[LivePreview] Apply to code:', selector, changes);
    
    // Send to VS Code extension to apply changes to source files
    applyChangesToCode(selector, changes as Record<string, unknown>, url);
  }, [applyChangesToCode, url]);

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
          <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2">
            <div className="flex items-center gap-2">
              <Button
                variant={isSelecting ? "default" : "outline"}
                size="sm"
                onClick={() => setIsSelecting(!isSelecting)}
                className={cn(
                  "gap-2",
                  isSelecting && "bg-blue-600 hover:bg-blue-700"
                )}
                disabled={!iframeLoaded}
              >
                <MousePointerClickIcon className="size-4" />
                {isSelecting ? "Inspecting..." : "Select Element"}
              </Button>
              
              {!iframeLoaded && (
                <span className="text-xs text-zinc-500">Loading...</span>
              )}
              
              {hoveredElement && isSelecting && (
                <span className="text-xs text-blue-400">
                  Hovering: <code className="rounded bg-zinc-800 px-1 py-0.5">{hoveredElement.tagName}</code>
                </span>
              )}
              
              {selectedElement && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="gap-2 text-zinc-400"
                >
                  <XIcon className="size-4" />
                  Clear
                </Button>
              )}
              
              {selectedElement && (
                <Button
                  variant={isEditing ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                  className={cn(
                    "gap-2",
                    isEditing && "bg-green-600 hover:bg-green-700"
                  )}
                >
                  <PencilIcon className="size-4" />
                  {isEditing ? "Editing..." : "Edit Element"}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300">
                {url}
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
              >
                <RefreshCwIcon className="size-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <LayersIcon className="size-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? (
                  <MinimizeIcon className="size-4" />
                ) : (
                  <MaximizeIcon className="size-4" />
                )}
              </Button>
              
              {onClose && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                >
                  <XIcon className="size-4" />
                </Button>
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
      <div className="border-b border-zinc-800 p-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <BoxSelectIcon className="size-5" />
          Element Inspector
        </h2>
        <p className="text-sm text-zinc-500 mt-1">
          {selectedElement
            ? "Element selected"
            : hoveredElement
            ? "Hovering element"
            : "Click to select an element"}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {currentElement ? (
          <div className="divide-y divide-zinc-800">
            {/* Element Info */}
            <SidebarSection
              title="Element"
              icon={<TargetIcon className="size-4" />}
              isExpanded={expandedSections.has("info")}
              onToggle={() => toggleSection("info")}
            >
              <div className="space-y-3">
                <InfoRow
                  label="Tag"
                  value={currentElement.tagName}
                  onCopy={() => copyToClipboard(currentElement.tagName)}
                />
                {currentElement.id && (
                  <InfoRow
                    label="ID"
                    value={`#${currentElement.id}`}
                    onCopy={() => copyToClipboard(currentElement.id!)}
                  />
                )}
                {currentElement.className && (
                  <InfoRow
                    label="Classes"
                    value={currentElement.className}
                    onCopy={() => copyToClipboard(currentElement.className!)}
                    multiline
                  />
                )}
                <InfoRow
                  label="Selector"
                  value={generateSelector(currentElement)}
                  onCopy={() => copyToClipboard(generateSelector(currentElement))}
                  highlight
                />
                <InfoRow
                  label="Children"
                  value={String(currentElement.children)}
                />

                {/* Path */}
                <div className="pt-2">
                  <span className="text-xs text-zinc-500 uppercase tracking-wider">
                    DOM Path
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1 text-xs">
                    {currentElement.path.map((segment, i) => (
                      <span key={i} className="flex items-center">
                        <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
                          {segment}
                        </code>
                        {i < currentElement.path.length - 1 && (
                          <ChevronRightIcon className="size-3 text-zinc-600 mx-1" />
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </SidebarSection>

            {/* Dimensions */}
            <SidebarSection
              title="Dimensions"
              icon={<MaximizeIcon className="size-4" />}
              isExpanded={expandedSections.has("dimensions")}
              onToggle={() => toggleSection("dimensions")}
            >
              <div className="grid grid-cols-2 gap-2">
                <InfoRow
                  label="Width"
                  value={`${Math.round(currentElement.rect.width)}px`}
                />
                <InfoRow
                  label="Height"
                  value={`${Math.round(currentElement.rect.height)}px`}
                />
                <InfoRow
                  label="X"
                  value={`${Math.round(currentElement.rect.x)}px`}
                />
                <InfoRow
                  label="Y"
                  value={`${Math.round(currentElement.rect.y)}px`}
                />
              </div>
            </SidebarSection>

            {/* Styles */}
            <SidebarSection
              title="Computed Styles"
              icon={<CodeIcon className="size-4" />}
              isExpanded={expandedSections.has("styles")}
              onToggle={() => toggleSection("styles")}
            >
              <div className="space-y-2">
                {Object.entries(currentElement.computedStyles).map(
                  ([key, value]) => (
                    <InfoRow
                      key={key}
                      label={key.replace(/([A-Z])/g, "-$1").toLowerCase()}
                      value={value}
                      onCopy={() => copyToClipboard(`${key}: ${value}`)}
                    />
                  )
                )}
              </div>
            </SidebarSection>

            {/* Attributes */}
            <SidebarSection
              title="Attributes"
              icon={<LayersIcon className="size-4" />}
              isExpanded={expandedSections.has("attributes")}
              onToggle={() => toggleSection("attributes")}
            >
              {Object.keys(currentElement.attributes).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(currentElement.attributes).map(
                    ([key, value]) => (
                      <InfoRow
                        key={key}
                        label={key}
                        value={value || "(empty)"}
                        onCopy={() => copyToClipboard(`${key}="${value}"`)}
                      />
                    )
                  )}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No attributes</p>
              )}
            </SidebarSection>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <MousePointerClickIcon className="size-12 text-zinc-700 mb-4" />
            <p className="text-zinc-400 font-medium">No element selected</p>
            <p className="text-zinc-500 text-sm mt-1">
              Click "Select Element" and hover over the preview to inspect
              elements
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
    <div>
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          {icon}
          {title}
        </div>
        {isExpanded ? (
          <ChevronDownIcon className="size-4 text-zinc-500" />
        ) : (
          <ChevronRightIcon className="size-4 text-zinc-500" />
        )}
      </button>
      {isExpanded && <div className="px-4 pb-4">{children}</div>}
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
}

function InfoRow({ label, value, onCopy, multiline, highlight }: InfoRowProps) {
  return (
    <div className={cn("group", multiline && "flex flex-col gap-1")}>
      <span className="text-xs text-zinc-500 uppercase tracking-wider">
        {label}
      </span>
      <div className="flex items-start gap-2">
        <code
          className={cn(
            "flex-1 rounded px-2 py-1 text-xs",
            highlight
              ? "bg-blue-900/30 text-blue-300 border border-blue-800"
              : "bg-zinc-800 text-zinc-300",
            multiline && "break-all"
          )}
        >
          {value}
        </code>
        {onCopy && (
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-zinc-700 rounded"
            onClick={onCopy}
          >
            <CopyIcon className="size-3 text-zinc-400" />
          </button>
        )}
      </div>
    </div>
  );
}

export default LivePreviewWithSelector;
