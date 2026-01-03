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
  GridIcon,
  PaletteIcon,
  ChevronDownIcon
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { TAILWIND_COLORS, SPECIAL_COLORS } from '@/lib/tailwind-colors';
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

/**
 * Normalize color values for comparison (rgb -> hex)
 */
function normalizeColorForComparison(color: string | undefined): string {
  if (!color) return '';
  
  const normalized = color.trim().toLowerCase();
  
  // Already hex
  if (normalized.startsWith('#')) {
    // Convert #rgb to #rrggbb
    if (normalized.length === 4) {
      return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
    }
    return normalized;
  }
  
  // rgb/rgba
  const rgbMatch = normalized.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  
  return normalized;
}

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
  
  // Position editor state
  const [positionMode, setPositionMode] = useState<PositionMode>('margin');
  const [gridSize, setGridSize] = useState<GridSize>(4);
  const [positionValues, setPositionValues] = useState<PositionValues>({
    top: 0,
    right: 'auto',
    bottom: 'auto',
    left: 0,
    translateX: 0,
    translateY: 0,
  });
  
  // Store original values when element is selected
  const originalStylesRef = useRef<ElementStyles>({});
  const originalTextRef = useRef<string>('');
  const originalPositionRef = useRef<PositionValues>({
    top: 0,
    right: 'auto',
    bottom: 'auto',
    left: 0,
    translateX: 0,
    translateY: 0,
  });
  const [hasPositionChanges, setHasPositionChanges] = useState(false);

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
        setHasPositionChanges(false);
        lastSelectorRef.current = element.selector;
        
        // Reset position values
        const defaultPosition: PositionValues = {
          top: 0,
          right: 'auto',
          bottom: 'auto',
          left: 0,
          translateX: 0,
          translateY: 0,
        };
        setPositionValues(defaultPosition);
        originalPositionRef.current = { ...defaultPosition };
        
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

  // Handle position changes from drag or controls
  const handlePositionChange = useCallback((newPosition: PositionValues) => {
    if (!element) return;
    
    setPositionValues(newPosition);
    setHasChanges(true);
    
    // Check if position actually changed from original
    const posChanged = 
      newPosition.top !== originalPositionRef.current.top ||
      newPosition.left !== originalPositionRef.current.left ||
      newPosition.translateX !== originalPositionRef.current.translateX ||
      newPosition.translateY !== originalPositionRef.current.translateY;
    setHasPositionChanges(posChanged);
    
    // Apply live to preview
    const result = positionToTailwind(positionMode, newPosition);
    onStyleChange(element.selector, result.cssProperties as Partial<ElementStyles>);
  }, [element, positionMode, onStyleChange]);

  const handleStyleChange = useCallback((key: keyof ElementStyles, value: string) => {
    if (!element) return;
    
    const newStyles = { ...localStyles, [key]: value };
    setLocalStyles(newStyles);
    setHasChanges(true);
    
    console.log(`[ElementEditor] handleStyleChange: ${key} = ${value}`);
    
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
      const originalValue = originalStylesRef.current[key as keyof ElementStyles];
      
      // Special comparison for color properties (normalize rgb vs hex)
      if (key === 'color' || key === 'backgroundColor' || key === 'borderColor') {
        const normalizedNew = normalizeColorForComparison(value);
        const normalizedOriginal = normalizeColorForComparison(originalValue);
        if (normalizedNew !== normalizedOriginal) {
          styleChanges[key as keyof ElementStyles] = value;
          console.log(`[ElementEditor] Color change detected: ${key} "${originalValue}" (${normalizedOriginal}) -> "${value}" (${normalizedNew})`);
        }
      } else {
        // Normal comparison for non-color properties
        if (value !== originalValue) {
          styleChanges[key as keyof ElementStyles] = value;
        }
      }
    }
    
    // Collect all Tailwind classes to add
    let allTailwindClasses: string[] = [];
    
    // If saving as Tailwind, convert styles to classes
    if (saveAsTailwind && Object.keys(styleChanges).length > 0) {
      // Convert changed styles to Tailwind classes
      console.log('[ElementEditor] Converting styles to Tailwind:', styleChanges);
      const conversionResult = cssToTailwind(styleChanges as Record<string, string>);
      console.log('[ElementEditor] Conversion result:', {
        classes: conversionResult.classes,
        conversions: conversionResult.conversions,
        unconverted: conversionResult.unconverted
      });
      
      if (conversionResult.classes.length > 0) {
        allTailwindClasses.push(...conversionResult.classes);
        
        // Only keep unconverted styles as inline
        if (conversionResult.unconverted.length > 0) {
          const unconvertedStyles: Partial<ElementStyles> = {};
          for (const item of conversionResult.unconverted) {
            unconvertedStyles[item.property as keyof ElementStyles] = item.value;
          }
          changes.styles = unconvertedStyles;
        }
        
        console.log('[ElementEditor] Style Tailwind conversion:', {
          classes: conversionResult.classes,
          unconvertedStyles: changes.styles
        });
      }
    } else if (Object.keys(styleChanges).length > 0) {
      // Save as inline styles
      changes.styles = styleChanges;
    }
    
    // Handle position changes
    if (hasPositionChanges) {
      const positionResult = positionToTailwind(positionMode, positionValues);
      if (positionResult.classes.length > 0) {
        allTailwindClasses.push(...positionResult.classes);
        console.log('[ElementEditor] Position Tailwind conversion:', {
          classes: positionResult.classes,
          mode: positionMode
        });
      }
    }
    
    // Send the new Tailwind classes to add/merge (backend will handle the merge)
    if (allTailwindClasses.length > 0) {
      // Send new classes to add - backend will merge with existing source classes
      (changes as Record<string, unknown>).tailwindClassesToAdd = allTailwindClasses;
      console.log('[ElementEditor] Tailwind classes to add:', allTailwindClasses);
    }
    
    // Compare text with ORIGINAL value
    if (localText !== originalTextRef.current) {
      changes.textContent = localText;
    }
    
    console.log('[ElementEditor] ===== APPLYING TO CODE =====');
    console.log('[ElementEditor] Selector:', element.selector);
    console.log('[ElementEditor] Style changes detected:', styleChanges);
    console.log('[ElementEditor] All Tailwind classes to add:', allTailwindClasses);
    console.log('[ElementEditor] Final changes object:', JSON.stringify(changes, null, 2));
    console.log('[ElementEditor] Has position changes:', hasPositionChanges);
    console.log('[ElementEditor] Save as Tailwind:', saveAsTailwind);
    console.log('[ElementEditor] ===============================');
    
    if (Object.keys(changes).length > 0) {
      setIsSaving(true);
      onApplyToCode(element.selector, changes);
      // Update original refs since we've saved
      originalStylesRef.current = { ...localStyles };
      originalTextRef.current = localText;
      originalPositionRef.current = { ...positionValues };
      setHasPositionChanges(false);
      setTimeout(() => {
        setIsSaving(false);
        setHasChanges(false);
        // Deselect element after save
        onSaveComplete?.();
      }, 800);
    } else {
      console.log('[ElementEditor] No changes to apply');
    }
  }, [element, localStyles, localText, saveAsTailwind, hasPositionChanges, positionMode, positionValues, onApplyToCode]);

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
        <TabsList className="w-full justify-start rounded-none border-b border-zinc-800 bg-transparent h-9 shrink-0 overflow-x-auto">
          <TabsTrigger value="styles" className="text-xs data-[state=active]:bg-zinc-800">
            <PaintbrushIcon className="size-3 mr-1" />
            Styles
          </TabsTrigger>
          <TabsTrigger value="position" className="text-xs data-[state=active]:bg-zinc-800">
            <MoveIcon className="size-3 mr-1" />
            Position
          </TabsTrigger>
          <TabsTrigger value="layout" className="text-xs data-[state=active]:bg-zinc-800">
            <BoxIcon className="size-3 mr-1" />
            Layout
          </TabsTrigger>
          <TabsTrigger value="text" className="text-xs data-[state=active]:bg-zinc-800">
            <TypeIcon className="size-3 mr-1" />
            Text
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center justify-between h-10 px-3 rounded-md bg-zinc-800 border border-zinc-700 hover:bg-zinc-750 hover:border-zinc-600 transition-colors">
                    <div className="flex items-center gap-2">
                      <div 
                        className="size-5 rounded border border-zinc-600"
                        style={{ backgroundColor: localStyles.backgroundColor || 'transparent' }}
                      />
                      <span className="text-xs text-zinc-300 font-mono">
                        {localStyles.backgroundColor || 'Select color'}
                      </span>
                    </div>
                    <PaletteIcon className="size-4 text-zinc-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80 max-h-[500px] overflow-y-auto bg-zinc-900 border-zinc-800">
                  <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-2">
                    <Input
                      type="text"
                      value={localStyles.backgroundColor || ''}
                      onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                      placeholder="#hex or rgb() or transparent"
                      className="h-8 text-xs font-mono bg-zinc-800 border-zinc-700"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  
                  <div className="p-2">
                    <DropdownMenuLabel className="text-zinc-400 text-xs mb-2">Quick Colors</DropdownMenuLabel>
                    <div className="grid grid-cols-8 gap-1.5 mb-3">
                      {SPECIAL_COLORS.map((color) => (
                        <button
                          key={color.tailwindClass}
                          onClick={() => handleStyleChange('backgroundColor', color.hex)}
                          className="size-8 rounded border-2 border-zinc-700 hover:border-blue-500 hover:scale-110 transition-all"
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                        />
                      ))}
                      {colorPresets.map(color => (
                        <button
                          key={color}
                          onClick={() => handleStyleChange('backgroundColor', color)}
                          className="size-8 rounded border-2 border-zinc-700 hover:border-blue-500 hover:scale-110 transition-all"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    
                    <DropdownMenuSeparator className="bg-zinc-800 my-2" />
                    
                    {TAILWIND_COLORS.map((colorFamily) => (
                      <div key={colorFamily.name} className="mb-3">
                        <DropdownMenuLabel className="text-zinc-500 text-[10px] uppercase font-semibold mb-1">
                          {colorFamily.name}
                        </DropdownMenuLabel>
                        <div className="grid grid-cols-11 gap-1">
                          {colorFamily.shades.map((shade) => (
                            <button
                              key={shade.tailwindClass}
                              onClick={() => handleStyleChange('backgroundColor', shade.hex)}
                              className={cn(
                                "size-6 rounded transition-all hover:scale-125 hover:z-10",
                                localStyles.backgroundColor === shade.hex
                                  ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-zinc-900"
                                  : "border border-zinc-700 hover:border-blue-500"
                              )}
                              style={{ backgroundColor: shade.hex }}
                              title={`${colorFamily.name} ${shade.value}`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Text Color */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Text Color</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center justify-between h-10 px-3 rounded-md bg-zinc-800 border border-zinc-700 hover:bg-zinc-750 hover:border-zinc-600 transition-colors">
                    <div className="flex items-center gap-2">
                      <div 
                        className="size-5 rounded border border-zinc-600"
                        style={{ backgroundColor: localStyles.color || 'transparent' }}
                      />
                      <span className="text-xs text-zinc-300 font-mono">
                        {localStyles.color || 'Select color'}
                      </span>
                    </div>
                    <PaletteIcon className="size-4 text-zinc-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80 max-h-[500px] overflow-y-auto bg-zinc-900 border-zinc-800">
                  <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-2">
                    <Input
                      type="text"
                      value={localStyles.color || ''}
                      onChange={(e) => handleStyleChange('color', e.target.value)}
                      placeholder="#hex or rgb() or inherit"
                      className="h-8 text-xs font-mono bg-zinc-800 border-zinc-700"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  
                  <div className="p-2">
                    <DropdownMenuLabel className="text-zinc-400 text-xs mb-2">Quick Colors</DropdownMenuLabel>
                    <div className="grid grid-cols-8 gap-1.5 mb-3">
                      {SPECIAL_COLORS.map((color) => (
                        <button
                          key={color.tailwindClass}
                          onClick={() => handleStyleChange('color', color.hex)}
                          className="size-8 rounded border-2 border-zinc-700 hover:border-blue-500 hover:scale-110 transition-all"
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                        />
                      ))}
                      {colorPresets.map(color => (
                        <button
                          key={color}
                          onClick={() => handleStyleChange('color', color)}
                          className="size-8 rounded border-2 border-zinc-700 hover:border-blue-500 hover:scale-110 transition-all"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    
                    <DropdownMenuSeparator className="bg-zinc-800 my-2" />
                    
                    {TAILWIND_COLORS.map((colorFamily) => (
                      <div key={colorFamily.name} className="mb-3">
                        <DropdownMenuLabel className="text-zinc-500 text-[10px] uppercase font-semibold mb-1">
                          {colorFamily.name}
                        </DropdownMenuLabel>
                        <div className="grid grid-cols-11 gap-1">
                          {colorFamily.shades.map((shade) => (
                            <button
                              key={shade.tailwindClass}
                              onClick={() => handleStyleChange('color', shade.hex)}
                              className={cn(
                                "size-6 rounded transition-all hover:scale-125 hover:z-10",
                                localStyles.color === shade.hex
                                  ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-zinc-900"
                                  : "border border-zinc-700 hover:border-blue-500"
                              )}
                              style={{ backgroundColor: shade.hex }}
                              title={`${colorFamily.name} ${shade.value}`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Separator className="bg-zinc-800" />

            {/* Border Radius */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Radius</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center justify-between h-10 px-3 rounded-md bg-zinc-800 border border-zinc-700 hover:bg-zinc-750 hover:border-zinc-600 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="size-5 rounded-md border border-zinc-600" style={{ borderRadius: localStyles.borderRadius || '0' }} />
                      <span className="text-xs text-zinc-300">
                        {localStyles.borderRadius === '0' || localStyles.borderRadius === '0px' ? 'None' :
                         localStyles.borderRadius === '2px' ? 'Extra Small' :
                         localStyles.borderRadius === '4px' ? 'Small' :
                         localStyles.borderRadius === '8px' ? 'Medium' :
                         localStyles.borderRadius === '12px' || localStyles.borderRadius === '0.75rem' ? 'Large' :
                         localStyles.borderRadius === '16px' || localStyles.borderRadius === '1rem' ? 'Extra Large' :
                         localStyles.borderRadius === '24px' || localStyles.borderRadius === '1.5rem' ? 'Double Extra Large' :
                         localStyles.borderRadius === '32px' || localStyles.borderRadius === '2rem' ? 'Triple Extra Large' :
                         localStyles.borderRadius === '48px' || localStyles.borderRadius === '3rem' ? 'Quadruple Extra Large' :
                         localStyles.borderRadius === '9999px' || localStyles.borderRadius === '50%' ? 'Full' :
                         localStyles.borderRadius || 'Select'}
                      </span>
                    </div>
                    <ChevronDownIcon className="size-4 text-zinc-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 bg-zinc-900 border-zinc-800">
                  {[
                    { label: 'None', value: '0' },
                    { label: 'Extra Small', value: '2px' },
                    { label: 'Small', value: '4px' },
                    { label: 'Medium', value: '8px' },
                    { label: 'Large', value: '12px' },
                    { label: 'Extra Large', value: '16px' },
                    { label: 'Double Extra Large', value: '24px' },
                    { label: 'Triple Extra Large', value: '32px' },
                    { label: 'Quadruple Extra Large', value: '48px' },
                    { label: 'Full', value: '9999px' },
                  ].map(({ label, value }) => (
                    <DropdownMenuItem
                      key={value}
                      onClick={() => handleStyleChange('borderRadius', value)}
                      className="flex items-center gap-3 cursor-pointer py-2"
                    >
                      <div className="size-5 rounded border border-zinc-600 bg-zinc-800" style={{ borderRadius: value }} />
                      <span className="text-xs flex-1">{label}</span>
                      {localStyles.borderRadius === value && <CheckIcon className="size-4 text-blue-500" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
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
              <div className="flex items-center justify-between">
                <Label className="text-xs text-zinc-400">Opacity</Label>
                <div className="flex items-center gap-2 px-3 h-8 rounded-md bg-zinc-800 border border-zinc-700">
                  <div className="size-4 rounded-full" style={{ 
                    background: `radial-gradient(circle, rgba(255,255,255,${localStyles.opacity || 1}) 0%, rgba(255,255,255,${(parseFloat(localStyles.opacity || '1') * 0.5).toFixed(2)}) 100%)` 
                  }} />
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={Math.round((parseFloat(localStyles.opacity || '1')) * 100)}
                    onChange={(e) => {
                      const percentage = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                      handleStyleChange('opacity', (percentage / 100).toString());
                    }}
                    className="h-6 w-12 px-1 text-xs text-right bg-transparent border-0 focus:ring-0"
                  />
                  <span className="text-xs text-zinc-500">%</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={Math.round((parseFloat(localStyles.opacity || '1')) * 100)}
                onChange={(e) => handleStyleChange('opacity', (parseInt(e.target.value) / 100).toString())}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </TabsContent>

          {/* Position Tab - NEW Figma-style positioning */}
          <TabsContent value="position" className="m-0 p-3 space-y-4">
            {/* Mode selector */}
            <PositionModeSelector
              value={positionMode}
              onChange={setPositionMode}
            />

            <Separator className="bg-zinc-800" />

            {/* Draggable Preview Canvas */}
            <div className="flex justify-center">
              <DraggablePreview
                position={positionValues}
                onPositionChange={handlePositionChange}
                mode={positionMode}
                gridSize={gridSize}
                showGrid={true}
              />
            </div>

            <Separator className="bg-zinc-800" />

            {/* Position Controls */}
            <PositionControls
              values={positionValues}
              onChange={handlePositionChange}
              mode={positionMode}
              gridSize={gridSize}
            />

            <Separator className="bg-zinc-800" />

            {/* Grid Size Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-zinc-400 flex items-center gap-1">
                  <GridIcon className="size-3" />
                  Grid Size
                </Label>
              </div>
              <div className="flex gap-1">
                {GRID_SIZES.map(size => (
                  <Button
                    key={size}
                    variant={gridSize === size ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setGridSize(size)}
                    className="h-6 px-2 text-xs flex-1"
                  >
                    {size}px
                  </Button>
                ))}
              </div>
            </div>

            {/* Tailwind Output */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-400">Generated Classes</Label>
              <div className="flex items-center gap-2 bg-zinc-800/50 rounded-md p-2">
                <code className="text-xs text-emerald-400 font-mono flex-1 truncate">
                  {positionToTailwind(positionMode, positionValues).classes.join(' ') || 'No classes'}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => {
                    const classes = positionToTailwind(positionMode, positionValues).classes.join(' ');
                    navigator.clipboard.writeText(classes);
                  }}
                >
                  <CopyIcon className="size-3" />
                </Button>
              </div>
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
