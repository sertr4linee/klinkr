'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  PaintbrushIcon, 
  TypeIcon, 
  BoxIcon, 
  CodeIcon,
  CopyIcon,
  CheckIcon,
  RotateCcwIcon,
  SparklesIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  SaveIcon,
  MoveIcon,
  GridIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { cssToTailwind, mergeClasses, type FullConversionResult } from '@/lib/css-to-tailwind';
import { PositionModeSelector, PositionControls, DraggablePreview } from '@/components/position-editor';
import { 
  type PositionMode, 
  type PositionValues, 
  type GridSize,
  GRID_SIZES,
  positionToTailwind 
} from '@/lib/position-to-tailwind';

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
  // Effects
  boxShadow?: string;
  opacity?: string;
  // Flex
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
  gap?: string;
}

export interface ElementData {
  selector: string;
  tagName: string;
  id?: string;
  className?: string;
  textContent?: string;
  fullTextContent?: string;
  directTextContent?: string;
  hasChildren?: boolean;
  childCount?: number;
  isComplexText?: boolean;
  styles: ElementStyles;
  attributes?: Record<string, string>;
}

interface ElementEditorProps {
  element: ElementData | null;
  onStyleChange: (selector: string, styles: Partial<ElementStyles>) => void;
  onTextChange: (selector: string, text: string) => void;
  onApplyToCode: (selector: string, changes: ElementChanges) => void;
  onSaveComplete?: () => void;
  className?: string;
}

export interface ElementChanges {
  styles?: Partial<ElementStyles>;
  textContent?: string;
  className?: string;
}

// Color presets
const colorPresets = [
  '#ffffff', '#000000', '#ef4444', '#f97316', '#eab308', 
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'
];

// Common values
const displayOptions = ['block', 'flex', 'grid', 'inline', 'inline-block', 'none'];
const positionOptions = ['relative', 'absolute', 'fixed', 'sticky', 'static'];
const fontWeightOptions = ['400', '500', '600', '700', '800'];
const textAlignOptions = ['left', 'center', 'right', 'justify'];
const flexDirectionOptions = ['row', 'column', 'row-reverse', 'column-reverse'];
const justifyOptions = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around'];
const alignOptions = ['flex-start', 'center', 'flex-end', 'stretch', 'baseline'];

export function ElementEditor({ 
  element, 
  onStyleChange, 
  onTextChange,
  onApplyToCode,
  onSaveComplete,
  className 
}: ElementEditorProps) {
  const [localStyles, setLocalStyles] = useState<ElementStyles>({});
  const [localText, setLocalText] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedTailwind, setCopiedTailwind] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveAsTailwind, setSaveAsTailwind] = useState(true); // Default to Tailwind
  const textDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastSelectorRef = useRef<string>('');
  
  // Store original values when element is selected
  const originalStylesRef = useRef<ElementStyles>({});
  const originalTextRef = useRef<string>('');

  // Tailwind conversion result
  const tailwindResult = useMemo<FullConversionResult>(() => {
    return cssToTailwind(localStyles as Record<string, string>);
  }, [localStyles]);

  // Merged classes (existing + new Tailwind)
  const mergedClasses = useMemo(() => {
    if (!element?.className) return tailwindResult.classes.join(' ');
    return mergeClasses(element.className, tailwindResult.classes.join(' '));
  }, [element?.className, tailwindResult.classes]);
  
  // Sync local state with element - only reset originals when selecting a NEW element
  useEffect(() => {
    if (element) {
      const isNewElement = element.selector !== lastSelectorRef.current;
      
      if (isNewElement) {
        // New element selected - reset everything
        setLocalStyles(element.styles || {});
        const textToEdit = element.isComplexText && element.directTextContent 
          ? element.directTextContent 
          : (element.textContent || '');
        setLocalText(textToEdit);
        setHasChanges(false);
        setIsSaving(false);
        lastSelectorRef.current = element.selector;
        // Store original values ONLY for new elements
        originalStylesRef.current = { ...element.styles };
        originalTextRef.current = textToEdit;
        console.log('[ElementEditor] New element selected:', element.selector, 'Original text:', textToEdit);
      } else {
        // Same element updated (e.g., after preview update) - DON'T reset originals
        // Just update styles from element but keep tracking changes
        console.log('[ElementEditor] Same element updated, keeping original refs');
      }
    }
  }, [element]);

  const handleStyleChange = useCallback((key: keyof ElementStyles, value: string) => {
    if (!element) return;
    
    const newStyles = { ...localStyles, [key]: value };
    setLocalStyles(newStyles);
    setHasChanges(true);
    
    // Apply live to preview
    onStyleChange(element.selector, { [key]: value });
  }, [element, localStyles, onStyleChange]);

  const handleTextChange = useCallback((text: string) => {
    if (!element) return;
    
    setLocalText(text);
    setHasChanges(true);
    
    // Debounce the actual update to iframe - wait 300ms after typing stops
    if (textDebounceRef.current) {
      clearTimeout(textDebounceRef.current);
    }
    
    textDebounceRef.current = setTimeout(() => {
      // Use stored selector in case element reference changed
      const selector = lastSelectorRef.current || element.selector;
      console.log('[ElementEditor] Applying text change:', selector, text);
      onTextChange(selector, text);
    }, 300);
  }, [element, onTextChange]);

  const handleApplyToCode = useCallback(() => {
    if (!element) {
      console.log('[ElementEditor] No element selected');
      return;
    }
    
    const changes: ElementChanges = {};
    
    // Compare styles with ORIGINAL values (not current element which might have been updated)
    const styleChanges: Partial<ElementStyles> = {};
    for (const [key, value] of Object.entries(localStyles)) {
      if (value !== originalStylesRef.current[key as keyof ElementStyles]) {
        styleChanges[key as keyof ElementStyles] = value;
      }
    }
    
    // If saving as Tailwind, convert styles to classes
    if (saveAsTailwind && Object.keys(styleChanges).length > 0) {
      // Convert changed styles to Tailwind classes
      const conversionResult = cssToTailwind(styleChanges as Record<string, string>);
      if (conversionResult.classes.length > 0) {
        // Merge with existing classes
        const newClasses = element.className 
          ? mergeClasses(element.className, conversionResult.classes.join(' '))
          : conversionResult.classes.join(' ');
        changes.className = newClasses;
        
        // Only keep unconverted styles as inline
        if (conversionResult.unconverted.length > 0) {
          const unconvertedStyles: Partial<ElementStyles> = {};
          for (const item of conversionResult.unconverted) {
            unconvertedStyles[item.property as keyof ElementStyles] = item.value;
          }
          changes.styles = unconvertedStyles;
        }
        
        console.log('[ElementEditor] Tailwind conversion:', {
          classes: conversionResult.classes,
          mergedClassName: changes.className,
          unconvertedStyles: changes.styles
        });
      }
    } else if (Object.keys(styleChanges).length > 0) {
      // Save as inline styles
      changes.styles = styleChanges;
    }
    
    // Compare text with ORIGINAL value
    if (localText !== originalTextRef.current) {
      changes.textContent = localText;
    }
    
    console.log('[ElementEditor] Applying to code:', { 
      selector: element.selector, 
      changes,
      saveAsTailwind,
      localText,
      originalText: originalTextRef.current,
      hasTextChange: localText !== originalTextRef.current
    });
    
    if (Object.keys(changes).length > 0) {
      setIsSaving(true);
      onApplyToCode(element.selector, changes);
      // Update original refs since we've saved
      originalStylesRef.current = { ...localStyles };
      originalTextRef.current = localText;
      setTimeout(() => {
        setIsSaving(false);
        setHasChanges(false);
        // Deselect element after save
        onSaveComplete?.();
      }, 800);
    } else {
      console.log('[ElementEditor] No changes to apply');
    }
  }, [element, localStyles, localText, saveAsTailwind, onApplyToCode]);

  const handleReset = useCallback(() => {
    if (element) {
      setLocalStyles(element.styles || {});
      setLocalText(element.textContent || '');
      setHasChanges(false);
      // Reset preview
      onStyleChange(element.selector, element.styles);
      if (element.textContent) {
        onTextChange(element.selector, element.textContent);
      }
    }
  }, [element, onStyleChange, onTextChange]);

  const generateCSS = useCallback(() => {
    const css = Object.entries(localStyles)
      .filter(([_, value]) => value)
      .map(([key, value]) => {
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `  ${cssKey}: ${value};`;
      })
      .join('\n');
    return `{\n${css}\n}`;
  }, [localStyles]);

  const handleCopyCSS = useCallback(async () => {
    const css = generateCSS();
    await navigator.clipboard.writeText(css);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generateCSS]);

  if (!element) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-zinc-500", className)}>
        <BoxIcon className="size-12 mb-3 opacity-30" />
        <p className="text-sm">Select an element to edit</p>
        <p className="text-xs opacity-50 mt-1">Click on any element in the preview</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full max-h-screen bg-zinc-900", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-blue-400 truncate">
            &lt;{element.tagName}&gt;
          </span>
          {element.id && (
            <span className="text-xs text-zinc-500">#{element.id}</span>
          )}
        </div>
        {/* Tailwind mode toggle - always visible */}
        <button
          onClick={() => setSaveAsTailwind(!saveAsTailwind)}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded text-[10px] transition-colors",
            saveAsTailwind 
              ? "bg-emerald-500/20 text-emerald-400" 
              : "bg-zinc-800 text-zinc-500"
          )}
          title={saveAsTailwind ? "Saving as Tailwind classes" : "Saving as inline styles"}
        >
          <SparklesIcon className="size-3" />
          <span>TW</span>
        </button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="styles" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start rounded-none border-b border-zinc-800 bg-transparent h-9 shrink-0">
          <TabsTrigger value="styles" className="text-xs data-[state=active]:bg-zinc-800">
            <PaintbrushIcon className="size-3 mr-1" />
            Styles
          </TabsTrigger>
          <TabsTrigger value="layout" className="text-xs data-[state=active]:bg-zinc-800">
            <BoxIcon className="size-3 mr-1" />
            Layout
          </TabsTrigger>
          <TabsTrigger value="text" className="text-xs data-[state=active]:bg-zinc-800">
            <TypeIcon className="size-3 mr-1" />
            Text
          </TabsTrigger>
          <TabsTrigger value="code" className="text-xs data-[state=active]:bg-zinc-800">
            <CodeIcon className="size-3 mr-1" />
            Code
          </TabsTrigger>
          <TabsTrigger value="export" className="text-xs data-[state=active]:bg-zinc-800">
            <SparklesIcon className="size-3 mr-1" />
            Export
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Styles Tab */}
          <TabsContent value="styles" className="m-0 p-3 space-y-4">
            {/* Colors */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Background Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={localStyles.backgroundColor || '#000000'}
                  onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                  className="w-10 h-8 p-0 border-0"
                />
                <Input
                  type="text"
                  value={localStyles.backgroundColor || ''}
                  onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                  placeholder="transparent"
                  className="flex-1 h-8 text-xs font-mono"
                />
              </div>
              <div className="flex gap-1">
                {colorPresets.map(color => (
                  <button
                    key={color}
                    onClick={() => handleStyleChange('backgroundColor', color)}
                    className="size-5 rounded border border-zinc-700 hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Text Color */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Text Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={localStyles.color || '#ffffff'}
                  onChange={(e) => handleStyleChange('color', e.target.value)}
                  className="w-10 h-8 p-0 border-0"
                />
                <Input
                  type="text"
                  value={localStyles.color || ''}
                  onChange={(e) => handleStyleChange('color', e.target.value)}
                  placeholder="inherit"
                  className="flex-1 h-8 text-xs font-mono"
                />
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Border Radius */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Border Radius</Label>
              <Input
                type="text"
                value={localStyles.borderRadius || ''}
                onChange={(e) => handleStyleChange('borderRadius', e.target.value)}
                placeholder="0px"
                className="h-8 text-xs font-mono"
              />
              <div className="flex gap-1">
                {['0', '4px', '8px', '12px', '16px', '9999px'].map(value => (
                  <Button
                    key={value}
                    variant="outline"
                    size="sm"
                    onClick={() => handleStyleChange('borderRadius', value)}
                    className="h-6 px-2 text-xs"
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Box Shadow */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Box Shadow</Label>
              <Input
                type="text"
                value={localStyles.boxShadow || ''}
                onChange={(e) => handleStyleChange('boxShadow', e.target.value)}
                placeholder="none"
                className="h-8 text-xs font-mono"
              />
              <div className="flex gap-1 flex-wrap">
                {[
                  { label: 'None', value: 'none' },
                  { label: 'SM', value: '0 1px 2px rgba(0,0,0,0.1)' },
                  { label: 'MD', value: '0 4px 6px rgba(0,0,0,0.1)' },
                  { label: 'LG', value: '0 10px 15px rgba(0,0,0,0.1)' },
                ].map(({ label, value }) => (
                  <Button
                    key={label}
                    variant="outline"
                    size="sm"
                    onClick={() => handleStyleChange('boxShadow', value)}
                    className="h-6 px-2 text-xs"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Opacity */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Opacity</Label>
              <Input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={localStyles.opacity || '1'}
                onChange={(e) => handleStyleChange('opacity', e.target.value)}
                className="h-8"
              />
              <span className="text-xs text-zinc-500">{localStyles.opacity || '1'}</span>
            </div>
          </TabsContent>

          {/* Layout Tab */}
          <TabsContent value="layout" className="m-0 p-3 space-y-4">
            {/* Display */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Display</Label>
              <div className="flex gap-1 flex-wrap">
                {displayOptions.map(value => (
                  <Button
                    key={value}
                    variant={localStyles.display === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleStyleChange('display', value)}
                    className="h-6 px-2 text-xs"
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Position */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Position</Label>
              <div className="flex gap-1 flex-wrap">
                {positionOptions.map(value => (
                  <Button
                    key={value}
                    variant={localStyles.position === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleStyleChange('position', value)}
                    className="h-6 px-2 text-xs"
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Width & Height */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Width</Label>
                <Input
                  type="text"
                  value={localStyles.width || ''}
                  onChange={(e) => handleStyleChange('width', e.target.value)}
                  placeholder="auto"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-zinc-400">Height</Label>
                <Input
                  type="text"
                  value={localStyles.height || ''}
                  onChange={(e) => handleStyleChange('height', e.target.value)}
                  placeholder="auto"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Padding */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Padding</Label>
              <Input
                type="text"
                value={localStyles.padding || ''}
                onChange={(e) => handleStyleChange('padding', e.target.value)}
                placeholder="0px"
                className="h-8 text-xs font-mono"
              />
              <div className="grid grid-cols-4 gap-1">
                {['0', '4px', '8px', '16px', '24px', '32px'].map(value => (
                  <Button
                    key={value}
                    variant="outline"
                    size="sm"
                    onClick={() => handleStyleChange('padding', value)}
                    className="h-6 px-1 text-xs"
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Margin */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Margin</Label>
              <Input
                type="text"
                value={localStyles.margin || ''}
                onChange={(e) => handleStyleChange('margin', e.target.value)}
                placeholder="0px"
                className="h-8 text-xs font-mono"
              />
            </div>

            {/* Flex options (if display is flex) */}
            {localStyles.display === 'flex' && (
              <>
                <Separator className="bg-zinc-800" />
                <div className="space-y-2">
                  <Label className="text-xs text-zinc-400">Flex Direction</Label>
                  <div className="flex gap-1 flex-wrap">
                    {flexDirectionOptions.map(value => (
                      <Button
                        key={value}
                        variant={localStyles.flexDirection === value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleStyleChange('flexDirection', value)}
                        className="h-6 px-2 text-xs"
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-zinc-400">Justify Content</Label>
                  <div className="flex gap-1 flex-wrap">
                    {justifyOptions.map(value => (
                      <Button
                        key={value}
                        variant={localStyles.justifyContent === value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleStyleChange('justifyContent', value)}
                        className="h-6 px-2 text-xs"
                      >
                        {value.replace('flex-', '')}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-zinc-400">Align Items</Label>
                  <div className="flex gap-1 flex-wrap">
                    {alignOptions.map(value => (
                      <Button
                        key={value}
                        variant={localStyles.alignItems === value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleStyleChange('alignItems', value)}
                        className="h-6 px-2 text-xs"
                      >
                        {value.replace('flex-', '')}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-zinc-400">Gap</Label>
                  <Input
                    type="text"
                    value={localStyles.gap || ''}
                    onChange={(e) => handleStyleChange('gap', e.target.value)}
                    placeholder="0px"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </>
            )}
          </TabsContent>

          {/* Text Tab */}
          <TabsContent value="text" className="m-0 p-3 space-y-4">
            {/* Text Content */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Text Content</Label>
              
              {/* Warning for complex elements */}
              {element.isComplexText && (
                <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-md text-xs text-amber-300">
                  <p className="font-medium">⚠️ Complex element</p>
                  <p className="opacity-80 mt-1">
                    This element contains {element.childCount} child element(s). 
                    Text changes will only affect direct text content, not nested elements.
                  </p>
                </div>
              )}
              
              {/* Show different text representations */}
              {element.isComplexText && element.directTextContent && (
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-500">Direct text only:</span>
                  <div className="p-2 bg-zinc-800/50 rounded text-xs font-mono text-zinc-300 max-h-16 overflow-auto">
                    {element.directTextContent || '(no direct text)'}
                  </div>
                </div>
              )}
              
              <textarea
                value={localText}
                onChange={(e) => {
                  setLocalText(e.target.value);
                  setHasChanges(true);
                }}
                onBlur={() => {
                  // Apply on blur (when user clicks away)
                  if (element && localText !== element.textContent) {
                    console.log('[ElementEditor] Applying text on blur:', element.selector);
                    onTextChange(element.selector, localText);
                  }
                }}
                onKeyDown={(e) => {
                  // Apply on Ctrl/Cmd + Enter
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    if (element) {
                      onTextChange(element.selector, localText);
                    }
                  }
                }}
                placeholder="Enter text..."
                className="w-full h-20 p-2 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-[10px] text-zinc-600">Press ⌘+Enter to preview • Changes auto-apply</p>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Font Size */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Font Size</Label>
              <Input
                type="text"
                value={localStyles.fontSize || ''}
                onChange={(e) => handleStyleChange('fontSize', e.target.value)}
                placeholder="inherit"
                className="h-8 text-xs font-mono"
              />
              <div className="flex gap-1 flex-wrap">
                {['12px', '14px', '16px', '18px', '24px', '32px', '48px'].map(value => (
                  <Button
                    key={value}
                    variant="outline"
                    size="sm"
                    onClick={() => handleStyleChange('fontSize', value)}
                    className="h-6 px-2 text-xs"
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Font Weight */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Font Weight</Label>
              <div className="flex gap-1 flex-wrap">
                {fontWeightOptions.map(value => (
                  <Button
                    key={value}
                    variant={localStyles.fontWeight === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleStyleChange('fontWeight', value)}
                    className="h-6 px-2 text-xs"
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Text Align */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Text Align</Label>
              <div className="flex gap-1">
                {textAlignOptions.map(value => (
                  <Button
                    key={value}
                    variant={localStyles.textAlign === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleStyleChange('textAlign', value)}
                    className="h-6 px-2 text-xs"
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Line Height */}
            <div className="space-y-1">
              <Label className="text-xs text-zinc-400">Line Height</Label>
              <Input
                type="text"
                value={localStyles.lineHeight || ''}
                onChange={(e) => handleStyleChange('lineHeight', e.target.value)}
                placeholder="normal"
                className="h-8 text-xs font-mono"
              />
            </div>
          </TabsContent>

          {/* Code Tab */}
          <TabsContent value="code" className="m-0 p-3 space-y-4">
            {/* Selector */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">CSS Selector</Label>
              <div className="p-2 bg-zinc-800 rounded-md font-mono text-xs text-blue-400 break-all">
                {element.selector}
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Generated CSS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-zinc-400">Generated CSS</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyCSS}
                  className="h-6 px-2 text-xs"
                >
                  {copied ? (
                    <CheckIcon className="size-3 mr-1 text-green-500" />
                  ) : (
                    <CopyIcon className="size-3 mr-1" />
                  )}
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <pre className="p-3 bg-zinc-800 rounded-md font-mono text-xs text-zinc-300 overflow-x-auto">
                {generateCSS()}
              </pre>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Element Info */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Element Info</Label>
              <div className="p-2 bg-zinc-800 rounded-md space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Tag:</span>
                  <span className="font-mono text-zinc-300">{element.tagName}</span>
                </div>
                {element.id && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">ID:</span>
                    <span className="font-mono text-zinc-300">#{element.id}</span>
                  </div>
                )}
                {element.className && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Classes:</span>
                    <span className="font-mono text-zinc-300 truncate max-w-[200px]">
                      .{element.className.split(' ').join(' .')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Export Tab - CSS to Tailwind */}
          <TabsContent value="export" className="m-0 p-3 space-y-4">
            {/* Tailwind Classes Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-zinc-400">Tailwind Classes</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(tailwindResult.classes.join(' '));
                    setCopiedTailwind(true);
                    setTimeout(() => setCopiedTailwind(false), 2000);
                  }}
                  className="h-6 px-2 text-xs"
                >
                  {copiedTailwind ? (
                    <CheckIcon className="size-3 mr-1 text-green-500" />
                  ) : (
                    <CopyIcon className="size-3 mr-1" />
                  )}
                  {copiedTailwind ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <div className="p-3 bg-zinc-800 rounded-md font-mono text-xs text-emerald-400 break-all">
                {tailwindResult.classes.length > 0 
                  ? tailwindResult.classes.join(' ')
                  : <span className="text-zinc-500 italic">No styles to convert</span>
                }
              </div>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Merged with existing classes */}
            {element.className && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs text-zinc-400">Merged with Existing Classes</Label>
                  <div className="p-3 bg-zinc-800 rounded-md font-mono text-xs text-blue-400 break-all">
                    {mergedClasses}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await navigator.clipboard.writeText(`className="${mergedClasses}"`);
                      setCopiedTailwind(true);
                      setTimeout(() => setCopiedTailwind(false), 2000);
                    }}
                    className="w-full h-7 text-xs"
                  >
                    <CopyIcon className="size-3 mr-1" />
                    Copy Merged className
                  </Button>
                </div>
                <Separator className="bg-zinc-800" />
              </>
            )}

            {/* Conversion Details */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Conversion Details</Label>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {tailwindResult.conversions.map((conv, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-2 p-2 bg-zinc-800/50 rounded text-xs"
                  >
                    {conv.exact ? (
                      <CheckCircleIcon className="size-3 text-green-500 shrink-0" />
                    ) : (
                      <AlertCircleIcon className="size-3 text-amber-500 shrink-0" />
                    )}
                    <span className="text-zinc-500 truncate">{conv.property}:</span>
                    <span className="text-zinc-400 truncate">{conv.originalValue}</span>
                    <span className="text-zinc-600">→</span>
                    <span className="text-emerald-400 font-mono truncate">{conv.tailwindClass}</span>
                  </div>
                ))}
                {tailwindResult.conversions.length === 0 && (
                  <div className="text-xs text-zinc-500 italic p-2">
                    No inline styles to convert
                  </div>
                )}
              </div>
            </div>

            {/* Unconverted properties */}
            {tailwindResult.unconverted.length > 0 && (
              <>
                <Separator className="bg-zinc-800" />
                <div className="space-y-2">
                  <Label className="text-xs text-amber-400">⚠️ Not Converted</Label>
                  <div className="space-y-1">
                    {tailwindResult.unconverted.map((item, idx) => (
                      <div 
                        key={idx}
                        className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs"
                      >
                        <span className="text-zinc-400">{item.property}:</span>
                        <span className="text-zinc-300 font-mono truncate">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator className="bg-zinc-800" />

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <div className="flex items-center gap-1">
                <CheckCircleIcon className="size-3 text-green-500" />
                <span>{tailwindResult.conversions.filter(c => c.exact).length} exact</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertCircleIcon className="size-3 text-amber-500" />
                <span>{tailwindResult.conversions.filter(c => !c.exact).length} approximate</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-zinc-600">{tailwindResult.unconverted.length} skipped</span>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* Fixed bottom action bar */}
      {hasChanges && (
        <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-sm px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <div className="size-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Unsaved</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-7 px-2 text-xs text-zinc-400"
              >
                <RotateCcwIcon className="size-3" />
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleApplyToCode}
                disabled={isSaving}
                className={cn(
                  "h-7 px-3 text-xs text-white font-medium",
                  saveAsTailwind 
                    ? "bg-emerald-600 hover:bg-emerald-700" 
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {isSaving ? (
                  <CheckIcon className="size-3 animate-pulse" />
                ) : (
                  <>
                    <SaveIcon className="size-3 mr-1" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ElementEditor;
