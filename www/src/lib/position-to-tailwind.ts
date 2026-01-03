/**
 * Position to Tailwind Converter
 * Convertit les valeurs de positionnement en classes Tailwind
 */

// Spacing scale Tailwind (en pixels)
const spacingMap: Record<number, string> = {
  0: '0',
  1: 'px',
  2: '0.5',
  4: '1',
  6: '1.5',
  8: '2',
  10: '2.5',
  12: '3',
  14: '3.5',
  16: '4',
  20: '5',
  24: '6',
  28: '7',
  32: '8',
  36: '9',
  40: '10',
  44: '11',
  48: '12',
  56: '14',
  64: '16',
  72: '18',
  80: '20',
  96: '24',
};

// Reverse map pour lookup rapide
const pxToTailwind = new Map(Object.entries(spacingMap).map(([px, tw]) => [Number(px), tw]));

// Grid sizes disponibles
export const GRID_SIZES = [1, 2, 4, 8, 16] as const;
export type GridSize = typeof GRID_SIZES[number];

// Modes de positionnement
export type PositionMode = 'margin' | 'transform' | 'absolute';

export interface PositionValues {
  top: number;
  right: number | 'auto';
  bottom: number | 'auto';
  left: number;
  translateX?: number;
  translateY?: number;
}

export interface PositionConversionResult {
  classes: string[];
  cssProperties: Record<string, string>;
  unconverted: { property: string; value: string }[];
}

/**
 * Snap une valeur au grid le plus proche
 */
export function snapToGrid(value: number, gridSize: GridSize): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Convertit une valeur en pixels vers la classe Tailwind correspondante
 * Retourne la classe ou une valeur arbitraire si pas dans la scale
 */
export function pxToTailwindSpacing(px: number): string {
  const absPx = Math.abs(px);
  
  // Chercher dans la map
  const tailwindValue = pxToTailwind.get(absPx);
  if (tailwindValue) {
    return tailwindValue;
  }
  
  // Trouver la valeur la plus proche
  const sortedPx = Array.from(pxToTailwind.keys()).sort((a, b) => a - b);
  for (let i = 0; i < sortedPx.length; i++) {
    if (sortedPx[i] >= absPx) {
      // Choisir entre la valeur courante et la précédente
      const current = sortedPx[i];
      const previous = sortedPx[i - 1] || 0;
      const closest = (absPx - previous) < (current - absPx) ? previous : current;
      return pxToTailwind.get(closest) || `[${absPx}px]`;
    }
  }
  
  // Valeur arbitraire pour les grandes valeurs
  return `[${absPx}px]`;
}

/**
 * Génère une classe margin Tailwind
 */
function marginClass(direction: 'top' | 'right' | 'bottom' | 'left', px: number): string | null {
  if (px === 0) return null;
  
  const prefix = direction === 'top' ? 'mt' : 
                 direction === 'right' ? 'mr' : 
                 direction === 'bottom' ? 'mb' : 'ml';
  
  const isNegative = px < 0;
  const tailwindValue = pxToTailwindSpacing(px);
  
  return isNegative ? `-${prefix}-${tailwindValue}` : `${prefix}-${tailwindValue}`;
}

/**
 * Génère une classe translate Tailwind
 */
function translateClass(axis: 'x' | 'y', px: number): string | null {
  if (px === 0) return null;
  
  const isNegative = px < 0;
  const tailwindValue = pxToTailwindSpacing(px);
  
  return isNegative 
    ? `-translate-${axis}-${tailwindValue}` 
    : `translate-${axis}-${tailwindValue}`;
}

/**
 * Génère une classe position Tailwind (top, left, right, bottom)
 */
function positionClass(direction: 'top' | 'right' | 'bottom' | 'left', px: number | 'auto'): string | null {
  if (px === 'auto') return null;
  if (px === 0) return `${direction}-0`;
  
  const isNegative = px < 0;
  const tailwindValue = pxToTailwindSpacing(px);
  
  return isNegative 
    ? `-${direction}-${tailwindValue}` 
    : `${direction}-${tailwindValue}`;
}

/**
 * Convertit les valeurs de position en classes Tailwind selon le mode
 */
export function positionToTailwind(
  mode: PositionMode,
  values: PositionValues
): PositionConversionResult {
  const classes: string[] = [];
  const cssProperties: Record<string, string> = {};
  const unconverted: { property: string; value: string }[] = [];

  if (mode === 'margin') {
    // Mode Margin - utilise mt, mr, mb, ml
    const mtClass = marginClass('top', values.top);
    const mrClass = values.right !== 'auto' ? marginClass('right', values.right) : null;
    const mbClass = values.bottom !== 'auto' ? marginClass('bottom', values.bottom) : null;
    const mlClass = marginClass('left', values.left);
    
    if (mtClass) classes.push(mtClass);
    if (mrClass) classes.push(mrClass);
    if (mbClass) classes.push(mbClass);
    if (mlClass) classes.push(mlClass);
    
    // CSS pour preview live
    cssProperties.marginTop = `${values.top}px`;
    cssProperties.marginLeft = `${values.left}px`;
    if (values.right !== 'auto') cssProperties.marginRight = `${values.right}px`;
    if (values.bottom !== 'auto') cssProperties.marginBottom = `${values.bottom}px`;
    
  } else if (mode === 'transform') {
    // Mode Transform - utilise translate-x, translate-y
    const tx = values.translateX ?? values.left;
    const ty = values.translateY ?? values.top;
    
    const txClass = translateClass('x', tx);
    const tyClass = translateClass('y', ty);
    
    if (txClass) classes.push(txClass);
    if (tyClass) classes.push(tyClass);
    
    // CSS pour preview live
    cssProperties.transform = `translate(${tx}px, ${ty}px)`;
    
  } else if (mode === 'absolute') {
    // Mode Absolute - utilise absolute + top/left/right/bottom
    classes.push('absolute');
    
    const topClass = positionClass('top', values.top);
    const leftClass = positionClass('left', values.left);
    const rightClass = positionClass('right', values.right);
    const bottomClass = positionClass('bottom', values.bottom);
    
    if (topClass) classes.push(topClass);
    if (leftClass) classes.push(leftClass);
    if (rightClass) classes.push(rightClass);
    if (bottomClass) classes.push(bottomClass);
    
    // CSS pour preview live
    cssProperties.position = 'absolute';
    cssProperties.top = `${values.top}px`;
    cssProperties.left = `${values.left}px`;
    if (values.right !== 'auto') cssProperties.right = `${values.right}px`;
    if (values.bottom !== 'auto') cssProperties.bottom = `${values.bottom}px`;
  }

  return { classes, cssProperties, unconverted };
}

/**
 * Parse une classe Tailwind de position et retourne la valeur en pixels
 */
export function parseTailwindPosition(className: string): Partial<PositionValues> | null {
  const values: Partial<PositionValues> = {};
  const classes = className.split(/\s+/);
  
  for (const cls of classes) {
    // Margin classes
    const marginMatch = cls.match(/^(-)?m([trbl])-(.+)$/);
    if (marginMatch) {
      const [, negative, dir, value] = marginMatch;
      const px = tailwindSpacingToPx(value);
      if (px !== null) {
        const direction = dir === 't' ? 'top' : dir === 'r' ? 'right' : dir === 'b' ? 'bottom' : 'left';
        (values as Record<string, number>)[direction] = negative ? -px : px;
      }
    }
    
    // Translate classes
    const translateMatch = cls.match(/^(-)?translate-([xy])-(.+)$/);
    if (translateMatch) {
      const [, negative, axis, value] = translateMatch;
      const px = tailwindSpacingToPx(value);
      if (px !== null) {
        const key = axis === 'x' ? 'translateX' : 'translateY';
        (values as Record<string, number>)[key] = negative ? -px : px;
      }
    }
    
    // Position classes (top, left, right, bottom)
    const posMatch = cls.match(/^(-)?(top|right|bottom|left)-(.+)$/);
    if (posMatch) {
      const [, negative, dir, value] = posMatch;
      const px = tailwindSpacingToPx(value);
      if (px !== null && dir) {
        (values as Record<string, number>)[dir] = negative ? -px : px;
      }
    }
  }
  
  return Object.keys(values).length > 0 ? values : null;
}

/**
 * Convertit une valeur Tailwind spacing en pixels
 */
function tailwindSpacingToPx(value: string): number | null {
  // Valeur arbitraire [Xpx]
  const arbitraryMatch = value.match(/^\[(\d+)px\]$/);
  if (arbitraryMatch) {
    return parseInt(arbitraryMatch[1], 10);
  }
  
  // Chercher dans la map inversée
  for (const [px, tw] of pxToTailwind.entries()) {
    if (tw === value) return px;
  }
  
  return null;
}

/**
 * Merge les nouvelles classes de position avec les classes existantes
 * Remplace les classes de même type (ex: mt-4 remplace mt-2)
 */
export function mergePositionClasses(existingClasses: string, newClasses: string[]): string {
  const existing = existingClasses.split(/\s+/).filter(Boolean);
  const result = [...existing];
  
  for (const newClass of newClasses) {
    // Déterminer le type de classe
    const prefix = newClass.replace(/^-/, '').match(/^[a-z]+-?[a-z]*/)?.[0];
    
    if (prefix) {
      // Retirer les classes du même type
      const regex = new RegExp(`^-?${prefix}-`);
      const index = result.findIndex(cls => regex.test(cls));
      if (index !== -1) {
        result.splice(index, 1);
      }
    }
    
    result.push(newClass);
  }
  
  return result.join(' ');
}
