'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
  LayersIcon,
  CodeIcon,
  CopyIcon,
  CheckIcon,
  RotateCcwIcon,
  SendIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  className 
}: ElementEditorProps) {
  const [localStyles, setLocalStyles] = useState<ElementStyles>({});
  const [localText, setLocalText] = useState('');
  const [copied, setCopied] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const textDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastSelectorRef = useRef<string>('');

  // Sync local state with element
  useEffect(() => {
    if (element) {
      setLocalStyles(element.styles || {});
      // For complex elements (with children), prefer direct text content
      // This avoids showing all nested text which would be confusing
      const textToEdit = element.isComplexText && element.directTextContent 
        ? element.directTextContent 
        : (element.textContent || '');
      setLocalText(textToEdit);
      setHasChanges(false);
      lastSelectorRef.current = element.selector;
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
    if (!element) return;
    
    const changes: ElementChanges = {};
    
    // Compare styles
    const styleChanges: Partial<ElementStyles> = {};
    for (const [key, value] of Object.entries(localStyles)) {
      if (value !== element.styles[key as keyof ElementStyles]) {
        styleChanges[key as keyof ElementStyles] = value;
      }
    }
    if (Object.keys(styleChanges).length > 0) {
      changes.styles = styleChanges;
    }
    
    // Compare text
    if (localText !== element.textContent) {
      changes.textContent = localText;
    }
    
    if (Object.keys(changes).length > 0) {
      onApplyToCode(element.selector, changes);
      setHasChanges(false);
    }
  }, [element, localStyles, localText, onApplyToCode]);

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
        <div className="flex items-center gap-1">
          {hasChanges && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-6 px-2 text-xs"
              >
                <RotateCcwIcon className="size-3 mr-1" />
                Reset
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleApplyToCode}
                className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700"
              >
                <SendIcon className="size-3 mr-1" />
                Apply to Code
              </Button>
            </>
          )}
        </div>
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
                placeholder="Enter text..."
                className="w-full h-20 p-2 text-xs font-mono bg-zinc-800 border border-zinc-700 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (element) {
                    console.log('[ElementEditor] Manual apply text:', element.selector, localText);
                    onTextChange(element.selector, localText);
                  }
                }}
                className="w-full h-7 text-xs"
              >
                Apply Text Change
              </Button>
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
        </div>
      </Tabs>
    </div>
  );
}

export default ElementEditor;
