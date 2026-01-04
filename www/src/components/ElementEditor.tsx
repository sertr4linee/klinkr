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
  ChevronDownIcon,
  BlendIcon,
  SquareIcon,
  CircleDotIcon,
  CaseSensitiveIcon,
  BoldIcon,
  LineChartIcon,
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
  AlignJustifyIcon,
  LayoutDashboardIcon,
  RectangleHorizontalIcon,
  RectangleVerticalIcon,
  SquareDashedBottomIcon,
  FrameIcon,
  ArrowRightIcon,
  ArrowDownIcon,
  AlignHorizontalJustifyStartIcon,
  AlignHorizontalJustifyCenterIcon,
  AlignHorizontalJustifyEndIcon,
  AlignHorizontalSpaceBetweenIcon,
  AlignHorizontalSpaceAroundIcon,
  AlignVerticalJustifyStartIcon,
  AlignVerticalJustifyCenterIcon,
  AlignVerticalJustifyEndIcon,
  StretchHorizontalIcon,
  MinusIcon,
  UnfoldHorizontalIcon,
  UnfoldVerticalIcon,
  LockIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  BanIcon
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/toast';
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

const Section = ({ title, icon: Icon, children, className, action }: { title: string; icon?: any; children: React.ReactNode; className?: string; action?: React.ReactNode }) => (
  <div className={cn("space-y-3 py-1", className)}>
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2 text-zinc-400">
        {Icon && <Icon className="size-3.5" />}
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{title}</span>
      </div>
      {action}
    </div>
    <div className="space-y-2.5 px-1">
      {children}
    </div>
  </div>
);

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
  textDecoration?: string;
  fontStyle?: string;
  letterSpacing?: string;
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
  const { addToast } = useToast();
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
    
    try {
      const newStyles = { ...localStyles, [key]: value };
      setLocalStyles(newStyles);
      setHasChanges(true);
      
      console.log(`[ElementEditor] handleStyleChange: ${key} = ${value}`);
      
      // Apply live to preview
      onStyleChange(element.selector, { [key]: value });
    } catch (error) {
      console.error('[ElementEditor] Error changing style:', error);
      addToast({
        title: 'Error changing style',
        description: error instanceof Error ? error.message : 'Unknown error',
        type: 'error'
      });
    }
  }, [element, localStyles, onStyleChange, addToast]);

  const handleMultiStyleChange = useCallback((changes: Partial<ElementStyles>) => {
    if (!element) return;
    
    try {
      const newStyles = { ...localStyles, ...changes };
      setLocalStyles(newStyles);
      setHasChanges(true);
      
      console.log(`[ElementEditor] handleMultiStyleChange:`, changes);
      
      // Apply live to preview
      onStyleChange(element.selector, changes);
    } catch (error) {
      console.error('[ElementEditor] Error changing styles:', error);
      addToast({
        title: 'Error changing styles',
        description: error instanceof Error ? error.message : 'Unknown error',
        type: 'error'
      });
    }
  }, [element, localStyles, onStyleChange, addToast]);

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
      
      // Add converted classes
      if (conversionResult.classes.length > 0) {
        allTailwindClasses.push(...conversionResult.classes);
      }
      
      // Always keep unconverted styles as inline
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
        
        addToast({
          title: 'Changes applied',
          description: 'Your changes have been applied to the code.',
          type: 'success'
        });
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
      
      addToast({
        title: 'Reset',
        description: 'Changes have been reset.',
        type: 'info'
      });
    }
  }, [element, onStyleChange, onTextChange, addToast]);

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
        <p className="text-[11px] opacity-50 mt-1">Click on any element in the preview</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full max-h-screen bg-zinc-900 text-zinc-200", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/50 bg-zinc-800 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center size-7 rounded-md bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20">
            <CodeIcon className="size-3.5" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-semibold text-zinc-200 truncate leading-tight">
              {element.tagName.toLowerCase()}
            </span>
            <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 truncate leading-tight font-mono">
              {element.id && <span>#{element.id}</span>}
              {element.className && <span>.{element.className.split(' ')[0]}</span>}
            </div>
          </div>
        </div>
        <button
          onClick={() => setSaveAsTailwind(!saveAsTailwind)}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium transition-all border",
            saveAsTailwind 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
              : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-400 hover:border-zinc-700"
          )}
        >
          <SparklesIcon className="size-3" />
          <span>{saveAsTailwind ? 'Tailwind' : 'CSS'}</span>
        </button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="styles" className="flex-1 flex flex-col min-h-0">
        <div className="px-3 border-b border-zinc-800/50 bg-zinc-900/30">
          <TabsList className="w-full justify-start bg-transparent h-9 p-0 gap-4">
            <TabsTrigger value="styles" className="text-[11px] font-medium h-full data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-[1.5px] data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 rounded-none px-1 text-zinc-500 hover:text-zinc-300 transition-colors">
              Design
            </TabsTrigger>
            <TabsTrigger value="position" className="text-[11px] font-medium h-full data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-[1.5px] data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 rounded-none px-1 text-zinc-500 hover:text-zinc-300 transition-colors">
              Layout
            </TabsTrigger>
            <TabsTrigger value="export" className="text-[11px] font-medium h-full data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-[1.5px] data-[state=active]:border-blue-500 data-[state=active]:text-blue-400 rounded-none px-1 text-zinc-500 hover:text-zinc-300 transition-colors">
              Code
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-6">
            <TabsContent value="styles" className="m-0 space-y-6 outline-none">
              
              {/* Typography Section */}
              <Section title="Typography" icon={TypeIcon}>
                {/* Font Family */}
                <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-8 justify-between px-2.5 text-[11px] bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700">
                        <span className="truncate">{localStyles.fontFamily || 'Font Family'}</span>
                        <ChevronDownIcon className="size-3 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 bg-zinc-900 border-zinc-800">
                      {[
                        { label: 'System', value: 'system-ui, -apple-system, sans-serif' },
                        { label: 'Sans Serif', value: 'ui-sans-serif, sans-serif' },
                        { label: 'Serif', value: 'ui-serif, serif' },
                        { label: 'Monospace', value: 'ui-monospace, monospace' },
                        { label: 'Inter', value: 'Inter, sans-serif' },
                        { label: 'Roboto', value: 'Roboto, sans-serif' },
                      ].map(({ label, value }) => (
                        <DropdownMenuItem key={value} onClick={() => handleStyleChange('fontFamily', value)} className="text-[11px]">
                          {label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Size & Weight Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-zinc-500 font-medium">Size</Label>
                    <div className="relative">
                      <Input 
                        value={localStyles.fontSize || ''} 
                        onChange={(e) => handleStyleChange('fontSize', e.target.value)}
                        className="h-8 pl-2 pr-6 text-[11px] bg-zinc-900 border-zinc-800 focus:border-blue-500/50" 
                        placeholder="16px"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600">px</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-zinc-500 font-medium">Weight</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full h-8 justify-between px-2 text-[11px] bg-zinc-900 border-zinc-800">
                          <span>{localStyles.fontWeight || '400'}</span>
                          <ChevronDownIcon className="size-3 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-32 bg-zinc-900 border-zinc-800">
                        {['400', '500', '600', '700', '800'].map(w => (
                          <DropdownMenuItem key={w} onClick={() => handleStyleChange('fontWeight', w)} className="text-[11px]">
                            {w}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Align & Color */}
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <div className="flex bg-zinc-900 rounded-md border border-zinc-800 p-0.5">
                    {['left', 'center', 'right', 'justify'].map((align) => (
                      <button
                        key={align}
                        onClick={() => handleStyleChange('textAlign', align)}
                        className={cn(
                          "p-1.5 rounded hover:bg-zinc-800 transition-colors",
                          localStyles.textAlign === align && "bg-zinc-800 text-blue-400"
                        )}
                      >
                        {align === 'left' && <AlignLeftIcon className="size-3.5" />}
                        {align === 'center' && <AlignCenterIcon className="size-3.5" />}
                        {align === 'right' && <AlignRightIcon className="size-3.5" />}
                        {align === 'justify' && <AlignJustifyIcon className="size-3.5" />}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <div className="relative cursor-pointer group">
                          <div 
                            className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 rounded border border-zinc-700 shadow-sm group-hover:scale-110 transition-transform"
                            style={{ backgroundColor: localStyles.color || 'transparent' }}
                          />
                          <Input 
                            value={localStyles.color || ''}
                            onChange={(e) => handleStyleChange('color', e.target.value)}
                            className="h-8 pl-8 text-[11px] bg-zinc-900 border-zinc-800 group-hover:border-zinc-700 transition-colors cursor-pointer"
                            placeholder="Color..."
                            readOnly
                          />
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-64 bg-zinc-900 border-zinc-800 p-2" align="end">
                        <div className="space-y-3">
                          <div className="grid grid-cols-8 gap-1">
                            {SPECIAL_COLORS.map((c) => (
                              <button
                                key={c.name}
                                className="size-6 rounded-md border border-zinc-800 hover:scale-110 transition-transform"
                                style={{ backgroundColor: c.hex }}
                                onClick={() => handleStyleChange('color', c.hex)}
                                title={c.name}
                              />
                            ))}
                          </div>
                          <div className="space-y-1">
                            {TAILWIND_COLORS.map((family) => (
                              <div key={family.name} className="flex gap-0.5">
                                {family.shades.map((shade) => (
                                  <button
                                    key={shade.value}
                                    className="flex-1 h-4 first:rounded-l-sm last:rounded-r-sm hover:scale-110 hover:z-10 transition-transform"
                                    style={{ backgroundColor: shade.hex }}
                                    onClick={() => handleStyleChange('color', shade.hex)}
                                    title={`${family.name}-${shade.value}`}
                                  />
                                ))}
                              </div>
                            ))}
                          </div>
                          <div className="pt-2 border-t border-zinc-800">
                            <Input 
                              value={localStyles.color || ''}
                              onChange={(e) => handleStyleChange('color', e.target.value)}
                              className="h-7 text-[10px] bg-zinc-950 border-zinc-800"
                              placeholder="#000000"
                            />
                          </div>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Decoration & Spacing */}
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-zinc-500 font-medium">Decoration</Label>
                    <div className="flex bg-zinc-900 rounded-md border border-zinc-800 p-0.5">
                      <button
                        onClick={() => handleStyleChange('fontStyle', localStyles.fontStyle === 'italic' ? 'normal' : 'italic')}
                        className={cn(
                          "p-1.5 rounded hover:bg-zinc-800 transition-colors",
                          localStyles.fontStyle === 'italic' && "bg-zinc-800 text-blue-400"
                        )}
                        title="Italic"
                      >
                        <ItalicIcon className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleStyleChange('textDecoration', localStyles.textDecoration?.includes('underline') ? 'none' : 'underline')}
                        className={cn(
                          "p-1.5 rounded hover:bg-zinc-800 transition-colors",
                          localStyles.textDecoration?.includes('underline') && "bg-zinc-800 text-blue-400"
                        )}
                        title="Underline"
                      >
                        <UnderlineIcon className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleStyleChange('textDecoration', localStyles.textDecoration?.includes('line-through') ? 'none' : 'line-through')}
                        className={cn(
                          "p-1.5 rounded hover:bg-zinc-800 transition-colors",
                          localStyles.textDecoration?.includes('line-through') && "bg-zinc-800 text-blue-400"
                        )}
                        title="Strikethrough"
                      >
                        <StrikethroughIcon className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleMultiStyleChange({ textDecoration: 'none', fontStyle: 'normal' })}
                        className="p-1.5 rounded hover:bg-zinc-800 transition-colors"
                        title="Clear Decoration"
                      >
                        <BanIcon className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-zinc-500 font-medium">Spacing</Label>
                    <div className="relative">
                      <Input 
                        value={localStyles.letterSpacing || ''}
                        onChange={(e) => handleStyleChange('letterSpacing', e.target.value)}
                        className="h-8 pl-2 pr-6 text-[11px] bg-zinc-900 border-zinc-800"
                        placeholder="0px"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600">px</span>
                    </div>
                  </div>
                </div>
              </Section>

              {/* Appearance Section */}
              <Section title="Appearance" icon={PaletteIcon}>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-zinc-500 font-medium">Background</Label>
                    <div className="relative group">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <div className="relative cursor-pointer group">
                            <div 
                              className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 rounded border border-zinc-700 shadow-sm group-hover:scale-110 transition-transform"
                              style={{ backgroundColor: localStyles.backgroundColor || 'transparent' }}
                            />
                            <Input 
                              value={localStyles.backgroundColor || ''}
                              onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                              className="h-8 pl-8 text-[11px] bg-zinc-900 border-zinc-800 group-hover:border-zinc-700 transition-colors cursor-pointer"
                              placeholder="Transparent"
                              readOnly
                            />
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64 bg-zinc-900 border-zinc-800 p-2" align="start">
                          <div className="space-y-3">
                            <div className="grid grid-cols-8 gap-1">
                              {SPECIAL_COLORS.map((c) => (
                                <button
                                  key={c.name}
                                  className="size-6 rounded-md border border-zinc-800 hover:scale-110 transition-transform"
                                  style={{ backgroundColor: c.hex }}
                                  onClick={() => handleStyleChange('backgroundColor', c.hex)}
                                  title={c.name}
                                />
                              ))}
                            </div>
                            <div className="space-y-1">
                              {TAILWIND_COLORS.map((family) => (
                                <div key={family.name} className="flex gap-0.5">
                                  {family.shades.map((shade) => (
                                    <button
                                      key={shade.value}
                                      className="flex-1 h-4 first:rounded-l-sm last:rounded-r-sm hover:scale-110 hover:z-10 transition-transform"
                                      style={{ backgroundColor: shade.hex }}
                                      onClick={() => handleStyleChange('backgroundColor', shade.hex)}
                                      title={`${family.name}-${shade.value}`}
                                    />
                                  ))}
                                </div>
                              ))}
                            </div>
                            <div className="pt-2 border-t border-zinc-800">
                              <Input 
                                value={localStyles.backgroundColor || ''}
                                onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                                className="h-7 text-[10px] bg-zinc-950 border-zinc-800"
                                placeholder="#000000"
                              />
                            </div>
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-zinc-500 font-medium">Opacity</Label>
                    <div className="relative">
                      <Input 
                        type="number"
                        min="0"
                        max="100"
                        value={Math.round((parseFloat(localStyles.opacity || '1')) * 100)}
                        onChange={(e) => handleStyleChange('opacity', (parseInt(e.target.value) / 100).toString())}
                        className="h-8 pl-2 pr-6 text-[11px] bg-zinc-900 border-zinc-800"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600">%</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-zinc-500 font-medium">Radius</Label>
                    <Input 
                      value={localStyles.borderRadius || ''}
                      onChange={(e) => handleStyleChange('borderRadius', e.target.value)}
                      className="h-8 text-[11px] bg-zinc-900 border-zinc-800"
                      placeholder="0px"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-zinc-500 font-medium">Shadow</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full h-8 justify-between px-2 text-[11px] bg-zinc-900 border-zinc-800">
                          <span className="truncate">{localStyles.boxShadow ? 'Custom' : 'None'}</span>
                          <ChevronDownIcon className="size-3 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-40 bg-zinc-900 border-zinc-800">
                        <DropdownMenuItem onClick={() => handleStyleChange('boxShadow', 'none')} className="text-[11px]">None</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStyleChange('boxShadow', '0 1px 2px rgba(0,0,0,0.1)')} className="text-[11px]">Small</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStyleChange('boxShadow', '0 4px 6px rgba(0,0,0,0.1)')} className="text-[11px]">Medium</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStyleChange('boxShadow', '0 10px 15px rgba(0,0,0,0.1)')} className="text-[11px]">Large</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </Section>

              {/* Layout Section */}
              <Section title="Layout" icon={LayoutDashboardIcon}>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <Label className="text-[10px] text-zinc-500 font-medium mb-1 block">Display</Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full h-8 justify-between px-2 text-[11px] bg-zinc-900 border-zinc-800">
                            <span>{localStyles.display || 'block'}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-32 bg-zinc-900 border-zinc-800">
                          {displayOptions.map(d => (
                            <DropdownMenuItem key={d} onClick={() => handleStyleChange('display', d)} className="text-[11px]">{d}</DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="col-span-1">
                      <Label className="text-[10px] text-zinc-500 font-medium mb-1 block">Width</Label>
                      <Input 
                        value={localStyles.width || ''}
                        onChange={(e) => handleStyleChange('width', e.target.value)}
                        className="h-8 text-[11px] bg-zinc-900 border-zinc-800"
                        placeholder="auto"
                      />
                    </div>
                    <div className="col-span-1">
                      <Label className="text-[10px] text-zinc-500 font-medium mb-1 block">Height</Label>
                      <Input 
                        value={localStyles.height || ''}
                        onChange={(e) => handleStyleChange('height', e.target.value)}
                        className="h-8 text-[11px] bg-zinc-900 border-zinc-800"
                        placeholder="auto"
                      />
                    </div>
                  </div>

                  {/* Flex Controls */}
                  {localStyles.display === 'flex' && (
                    <div className="p-2 bg-zinc-900/50 rounded border border-zinc-800/50 space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-zinc-500 font-medium">Direction</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant={localStyles.flexDirection === 'row' || !localStyles.flexDirection ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleStyleChange('flexDirection', 'row')}
                            className={cn("h-7 text-[10px]", localStyles.flexDirection === 'row' || !localStyles.flexDirection ? "bg-zinc-800 text-blue-400 border-zinc-700" : "bg-zinc-900 border-zinc-800")}
                          >
                            <ArrowRightIcon className="size-3 mr-1.5" /> Row
                          </Button>
                          <Button
                            variant={localStyles.flexDirection === 'column' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleStyleChange('flexDirection', 'column')}
                            className={cn("h-7 text-[10px]", localStyles.flexDirection === 'column' ? "bg-zinc-800 text-blue-400 border-zinc-700" : "bg-zinc-900 border-zinc-800")}
                          >
                            <ArrowDownIcon className="size-3 mr-1.5" /> Column
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-zinc-500 font-medium">Align</Label>
                          <div className="flex bg-zinc-900 rounded border border-zinc-800 p-0.5">
                            {[
                              { v: 'flex-start', i: AlignVerticalJustifyStartIcon },
                              { v: 'center', i: AlignVerticalJustifyCenterIcon },
                              { v: 'flex-end', i: AlignVerticalJustifyEndIcon },
                              { v: 'stretch', i: StretchHorizontalIcon }
                            ].map(({ v, i: Icon }) => (
                              <button
                                key={v}
                                onClick={() => handleStyleChange('alignItems', v)}
                                className={cn(
                                  "flex-1 flex items-center justify-center p-1 rounded hover:bg-zinc-800 transition-colors",
                                  localStyles.alignItems === v && "bg-zinc-800 text-blue-400"
                                )}
                              >
                                <Icon className="size-3.5" />
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] text-zinc-500 font-medium">Justify</Label>
                          <div className="flex bg-zinc-900 rounded border border-zinc-800 p-0.5">
                            {[
                              { v: 'flex-start', i: AlignHorizontalJustifyStartIcon },
                              { v: 'center', i: AlignHorizontalJustifyCenterIcon },
                              { v: 'flex-end', i: AlignHorizontalJustifyEndIcon },
                              { v: 'space-between', i: AlignHorizontalSpaceBetweenIcon }
                            ].map(({ v, i: Icon }) => (
                              <button
                                key={v}
                                onClick={() => handleStyleChange('justifyContent', v)}
                                className={cn(
                                  "flex-1 flex items-center justify-center p-1 rounded hover:bg-zinc-800 transition-colors",
                                  localStyles.justifyContent === v && "bg-zinc-800 text-blue-400"
                                )}
                              >
                                <Icon className="size-3.5" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-zinc-500 font-medium">Gap</Label>
                        <div className="relative">
                          <MinusIcon className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-zinc-500" />
                          <Input 
                            value={localStyles.gap || ''}
                            onChange={(e) => handleStyleChange('gap', e.target.value)}
                            className="h-7 pl-7 text-[11px] bg-zinc-900 border-zinc-800"
                            placeholder="0px"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    {/* Padding Control */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] text-zinc-500 font-medium">Padding</Label>
                        <Input 
                          value={localStyles.padding || ''}
                          onChange={(e) => handleStyleChange('padding', e.target.value)}
                          className="h-5 w-12 text-[9px] bg-zinc-900 border-zinc-800 text-center px-1 focus:border-blue-500/50"
                          placeholder="All"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-1 p-1.5 bg-zinc-900/30 rounded border border-zinc-800/50">
                        <div />
                        <Input 
                          value={localStyles.paddingTop || ''}
                          onChange={(e) => handleStyleChange('paddingTop', e.target.value)}
                          className="h-6 text-[9px] bg-zinc-900 border-zinc-800 text-center px-0 focus:border-blue-500/50 focus:z-10"
                          placeholder="T"
                        />
                        <div />
                        <Input 
                          value={localStyles.paddingLeft || ''}
                          onChange={(e) => handleStyleChange('paddingLeft', e.target.value)}
                          className="h-6 text-[9px] bg-zinc-900 border-zinc-800 text-center px-0 focus:border-blue-500/50 focus:z-10"
                          placeholder="L"
                        />
                        <div className="flex items-center justify-center">
                          <div className="size-1 rounded-full bg-zinc-700" />
                        </div>
                        <Input 
                          value={localStyles.paddingRight || ''}
                          onChange={(e) => handleStyleChange('paddingRight', e.target.value)}
                          className="h-6 text-[9px] bg-zinc-900 border-zinc-800 text-center px-0 focus:border-blue-500/50 focus:z-10"
                          placeholder="R"
                        />
                        <div />
                        <Input 
                          value={localStyles.paddingBottom || ''}
                          onChange={(e) => handleStyleChange('paddingBottom', e.target.value)}
                          className="h-6 text-[9px] bg-zinc-900 border-zinc-800 text-center px-0 focus:border-blue-500/50 focus:z-10"
                          placeholder="B"
                        />
                        <div />
                      </div>
                    </div>

                    {/* Margin Control */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] text-zinc-500 font-medium">Margin</Label>
                        <Input 
                          value={localStyles.margin || ''}
                          onChange={(e) => handleStyleChange('margin', e.target.value)}
                          className="h-5 w-12 text-[9px] bg-zinc-900 border-zinc-800 text-center px-1 focus:border-blue-500/50"
                          placeholder="All"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-1 p-1.5 bg-zinc-900/30 rounded border border-zinc-800/50">
                        <div />
                        <Input 
                          value={localStyles.marginTop || ''}
                          onChange={(e) => handleStyleChange('marginTop', e.target.value)}
                          className="h-6 text-[9px] bg-zinc-900 border-zinc-800 text-center px-0 focus:border-blue-500/50 focus:z-10"
                          placeholder="T"
                        />
                        <div />
                        <Input 
                          value={localStyles.marginLeft || ''}
                          onChange={(e) => handleStyleChange('marginLeft', e.target.value)}
                          className="h-6 text-[9px] bg-zinc-900 border-zinc-800 text-center px-0 focus:border-blue-500/50 focus:z-10"
                          placeholder="L"
                        />
                        <div className="flex items-center justify-center">
                          <div className="size-2 border border-zinc-700 rounded-[1px]" />
                        </div>
                        <Input 
                          value={localStyles.marginRight || ''}
                          onChange={(e) => handleStyleChange('marginRight', e.target.value)}
                          className="h-6 text-[9px] bg-zinc-900 border-zinc-800 text-center px-0 focus:border-blue-500/50 focus:z-10"
                          placeholder="R"
                        />
                        <div />
                        <Input 
                          value={localStyles.marginBottom || ''}
                          onChange={(e) => handleStyleChange('marginBottom', e.target.value)}
                          className="h-6 text-[9px] bg-zinc-900 border-zinc-800 text-center px-0 focus:border-blue-500/50 focus:z-10"
                          placeholder="B"
                        />
                        <div />
                      </div>
                    </div>
                  </div>
                </div>
              </Section>

              {/* Content Section */}
              <Section title="Content" icon={CodeIcon}>
                <textarea
                  value={localText}
                  onChange={(e) => {
                    setLocalText(e.target.value);
                    setHasChanges(true);
                  }}
                  onBlur={() => {
                    if (element && localText !== element.textContent) {
                      onTextChange(element.selector, localText);
                    }
                  }}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      if (element) {
                        onTextChange(element.selector, localText);
                      }
                    }
                  }}
                  placeholder="Enter text content..."
                  className="w-full h-24 p-3 text-[11px] font-mono bg-zinc-900 border border-zinc-800 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                />
                <div className="flex items-center justify-between text-[9px] text-zinc-500 px-1">
                  <span>{localText.length} characters</span>
                  <span>⌘+Enter to apply</span>
                </div>
              </Section>

            </TabsContent>

            <TabsContent value="position" className="m-0 space-y-4 outline-none">
              <PositionModeSelector
                value={positionMode}
                onChange={setPositionMode}
              />
              <div className="flex justify-center py-4 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
                <DraggablePreview
                  position={positionValues}
                  onPositionChange={handlePositionChange}
                  mode={positionMode}
                  gridSize={gridSize}
                  showGrid={true}
                />
              </div>
              <PositionControls
                values={positionValues}
                onChange={handlePositionChange}
                mode={positionMode}
                gridSize={gridSize}
              />
              <div className="space-y-2">
                <Label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Grid Size</Label>
                <div className="flex gap-1">
                  {GRID_SIZES.map(size => (
                    <Button
                      key={size}
                      variant={gridSize === size ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setGridSize(size)}
                      className={cn(
                        "h-6 px-0 flex-1 text-[10px]",
                        gridSize === size ? "bg-blue-600 hover:bg-blue-700" : "bg-zinc-900 border-zinc-800"
                      )}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="export" className="m-0 space-y-4 outline-none">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Tailwind Classes</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await navigator.clipboard.writeText(tailwindResult.classes.join(' '));
                      setCopiedTailwind(true);
                      setTimeout(() => setCopiedTailwind(false), 2000);
                    }}
                    className="h-5 px-2 text-[10px] hover:bg-zinc-800"
                  >
                    {copiedTailwind ? <CheckIcon className="size-3 mr-1 text-emerald-500" /> : <CopyIcon className="size-3 mr-1" />}
                    {copiedTailwind ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-md font-mono text-[11px] text-emerald-400 break-all leading-relaxed">
                  {tailwindResult.classes.length > 0 
                    ? tailwindResult.classes.join(' ')
                    : <span className="text-zinc-600 italic">No styles to convert</span>
                  }
                </div>
              </div>

              {element.className && (
                <div className="space-y-2">
                  <Label className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Merged Classes</Label>
                  <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-md font-mono text-[11px] text-blue-400 break-all leading-relaxed">
                    {mergedClasses}
                  </div>
                </div>
              )}
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>

      {/* Bottom Bar */}
      {hasChanges && (
        <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/95 backdrop-blur-sm px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <div className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="font-medium">Unsaved changes</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="h-7 px-3 text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              >
                <RotateCcwIcon className="size-3 mr-1.5" />
                Reset
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleApplyToCode}
                disabled={isSaving}
                className={cn(
                  "h-7 px-4 text-[11px] text-white font-medium shadow-sm transition-all",
                  saveAsTailwind 
                    ? "bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-500/20" 
                    : "bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/20"
                )}
              >
                {isSaving ? (
                  <CheckIcon className="size-3 animate-pulse" />
                ) : (
                  <>
                    <SaveIcon className="size-3 mr-1.5" />
                    Save Changes
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
