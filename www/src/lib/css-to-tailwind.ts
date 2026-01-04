/**
 * CSS to Tailwind Converter
 * Convertit les styles CSS inline en classes Tailwind
 */

// Palette de couleurs Tailwind avec leurs valeurs hex
const tailwindColors: Record<string, string> = {
  // Slate
  '#f8fafc': 'slate-50', '#f1f5f9': 'slate-100', '#e2e8f0': 'slate-200',
  '#cbd5e1': 'slate-300', '#94a3b8': 'slate-400', '#64748b': 'slate-500',
  '#475569': 'slate-600', '#334155': 'slate-700', '#1e293b': 'slate-800',
  '#0f172a': 'slate-900', '#020617': 'slate-950',
  // Gray
  '#f9fafb': 'gray-50', '#f3f4f6': 'gray-100', '#e5e7eb': 'gray-200',
  '#d1d5db': 'gray-300', '#9ca3af': 'gray-400', '#6b7280': 'gray-500',
  '#4b5563': 'gray-600', '#374151': 'gray-700', '#1f2937': 'gray-800',
  '#111827': 'gray-900', '#030712': 'gray-950',
  // Zinc
  '#fafafa': 'zinc-50', '#f4f4f5': 'zinc-100', '#e4e4e7': 'zinc-200',
  '#d4d4d8': 'zinc-300', '#a1a1aa': 'zinc-400', '#71717a': 'zinc-500',
  '#52525b': 'zinc-600', '#3f3f46': 'zinc-700', '#27272a': 'zinc-800',
  '#18181b': 'zinc-900', '#09090b': 'zinc-950',
  // Red
  '#fef2f2': 'red-50', '#fee2e2': 'red-100', '#fecaca': 'red-200',
  '#fca5a5': 'red-300', '#f87171': 'red-400', '#ef4444': 'red-500',
  '#dc2626': 'red-600', '#b91c1c': 'red-700', '#991b1b': 'red-800',
  '#7f1d1d': 'red-900', '#450a0a': 'red-950',
  // Orange
  '#fff7ed': 'orange-50', '#ffedd5': 'orange-100', '#fed7aa': 'orange-200',
  '#fdba74': 'orange-300', '#fb923c': 'orange-400', '#f97316': 'orange-500',
  '#ea580c': 'orange-600', '#c2410c': 'orange-700', '#9a3412': 'orange-800',
  '#7c2d12': 'orange-900', '#431407': 'orange-950',
  // Yellow
  '#fefce8': 'yellow-50', '#fef9c3': 'yellow-100', '#fef08a': 'yellow-200',
  '#fde047': 'yellow-300', '#facc15': 'yellow-400', '#eab308': 'yellow-500',
  '#ca8a04': 'yellow-600', '#a16207': 'yellow-700', '#854d0e': 'yellow-800',
  '#713f12': 'yellow-900', '#422006': 'yellow-950',
  // Green
  '#f0fdf4': 'green-50', '#dcfce7': 'green-100', '#bbf7d0': 'green-200',
  '#86efac': 'green-300', '#4ade80': 'green-400', '#22c55e': 'green-500',
  '#16a34a': 'green-600', '#15803d': 'green-700', '#166534': 'green-800',
  '#14532d': 'green-900', '#052e16': 'green-950',
  // Blue
  '#eff6ff': 'blue-50', '#dbeafe': 'blue-100', '#bfdbfe': 'blue-200',
  '#93c5fd': 'blue-300', '#60a5fa': 'blue-400', '#3b82f6': 'blue-500',
  '#2563eb': 'blue-600', '#1d4ed8': 'blue-700', '#1e40af': 'blue-800',
  '#1e3a8a': 'blue-900', '#172554': 'blue-950',
  // Indigo
  '#eef2ff': 'indigo-50', '#e0e7ff': 'indigo-100', '#c7d2fe': 'indigo-200',
  '#a5b4fc': 'indigo-300', '#818cf8': 'indigo-400', '#6366f1': 'indigo-500',
  '#4f46e5': 'indigo-600', '#4338ca': 'indigo-700', '#3730a3': 'indigo-800',
  '#312e81': 'indigo-900', '#1e1b4b': 'indigo-950',
  // Violet
  '#f5f3ff': 'violet-50', '#ede9fe': 'violet-100', '#ddd6fe': 'violet-200',
  '#c4b5fd': 'violet-300', '#a78bfa': 'violet-400', '#8b5cf6': 'violet-500',
  '#7c3aed': 'violet-600', '#6d28d9': 'violet-700', '#5b21b6': 'violet-800',
  '#4c1d95': 'violet-900', '#2e1065': 'violet-950',
  // Purple
  '#faf5ff': 'purple-50', '#f3e8ff': 'purple-100', '#e9d5ff': 'purple-200',
  '#d8b4fe': 'purple-300', '#c084fc': 'purple-400', '#a855f7': 'purple-500',
  '#9333ea': 'purple-600', '#7e22ce': 'purple-700', '#6b21a8': 'purple-800',
  '#581c87': 'purple-900', '#3b0764': 'purple-950',
  // Pink
  '#fdf2f8': 'pink-50', '#fce7f3': 'pink-100', '#fbcfe8': 'pink-200',
  '#f9a8d4': 'pink-300', '#f472b6': 'pink-400', '#ec4899': 'pink-500',
  '#db2777': 'pink-600', '#be185d': 'pink-700', '#9d174d': 'pink-800',
  '#831843': 'pink-900', '#500724': 'pink-950',
  // Base colors
  '#ffffff': 'white', '#000000': 'black', 'transparent': 'transparent',
};

// Reverse mapping pour recherche rapide
const hexToTailwind = new Map(Object.entries(tailwindColors));

// Spacing scale (Tailwind default: 1 unit = 0.25rem = 4px)
const spacingScale: Record<number, string> = {
  0: '0', 1: 'px', 2: '0.5', 4: '1', 6: '1.5', 8: '2', 10: '2.5',
  12: '3', 14: '3.5', 16: '4', 20: '5', 24: '6', 28: '7', 32: '8',
  36: '9', 40: '10', 44: '11', 48: '12', 56: '14', 64: '16',
  72: '18', 80: '20', 96: '24', 112: '28', 128: '32', 144: '36',
  160: '40', 176: '44', 192: '48', 208: '52', 224: '56', 240: '60',
  256: '64', 288: '72', 320: '80', 384: '96',
};

// Font sizes
const fontSizeScale: Record<string, string> = {
  '12px': 'text-xs', '14px': 'text-sm', '16px': 'text-base',
  '18px': 'text-lg', '20px': 'text-xl', '24px': 'text-2xl',
  '30px': 'text-3xl', '36px': 'text-4xl', '48px': 'text-5xl',
  '60px': 'text-6xl', '72px': 'text-7xl', '96px': 'text-8xl',
  '128px': 'text-9xl',
  // rem equivalents
  '0.75rem': 'text-xs', '0.875rem': 'text-sm', '1rem': 'text-base',
  '1.125rem': 'text-lg', '1.25rem': 'text-xl', '1.5rem': 'text-2xl',
  '1.875rem': 'text-3xl', '2.25rem': 'text-4xl', '3rem': 'text-5xl',
  '3.75rem': 'text-6xl', '4.5rem': 'text-7xl', '6rem': 'text-8xl',
  '8rem': 'text-9xl',
};

// Font weights
const fontWeightScale: Record<string, string> = {
  '100': 'font-thin', '200': 'font-extralight', '300': 'font-light',
  '400': 'font-normal', '500': 'font-medium', '600': 'font-semibold',
  '700': 'font-bold', '800': 'font-extrabold', '900': 'font-black',
  'normal': 'font-normal', 'bold': 'font-bold',
};

// Border radius
const borderRadiusScale: Record<string, string> = {
  '0': 'rounded-none', '0px': 'rounded-none',
  '2px': 'rounded-sm', '0.125rem': 'rounded-sm',
  '4px': 'rounded', '0.25rem': 'rounded',
  '6px': 'rounded-md', '0.375rem': 'rounded-md',
  '8px': 'rounded-lg', '0.5rem': 'rounded-lg',
  '12px': 'rounded-xl', '0.75rem': 'rounded-xl',
  '16px': 'rounded-2xl', '1rem': 'rounded-2xl',
  '24px': 'rounded-3xl', '1.5rem': 'rounded-3xl',
  '9999px': 'rounded-full', '50%': 'rounded-full',
};

// Box shadows
const boxShadowScale: Record<string, string> = {
  'none': 'shadow-none',
  '0 1px 2px 0 rgb(0 0 0 / 0.05)': 'shadow-sm',
  '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)': 'shadow',
  '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)': 'shadow-md',
  '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)': 'shadow-lg',
  '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)': 'shadow-xl',
  '0 25px 50px -12px rgb(0 0 0 / 0.25)': 'shadow-2xl',
};

// Display values
const displayScale: Record<string, string> = {
  'block': 'block', 'inline-block': 'inline-block', 'inline': 'inline',
  'flex': 'flex', 'inline-flex': 'inline-flex',
  'grid': 'grid', 'inline-grid': 'inline-grid',
  'none': 'hidden', 'contents': 'contents',
};

// Position values
const positionScale: Record<string, string> = {
  'static': 'static', 'relative': 'relative', 'absolute': 'absolute',
  'fixed': 'fixed', 'sticky': 'sticky',
};

// Text align
const textAlignScale: Record<string, string> = {
  'left': 'text-left', 'center': 'text-center',
  'right': 'text-right', 'justify': 'text-justify',
};

// Flex direction
const flexDirectionScale: Record<string, string> = {
  'row': 'flex-row', 'row-reverse': 'flex-row-reverse',
  'column': 'flex-col', 'column-reverse': 'flex-col-reverse',
};

// Justify content
const justifyContentScale: Record<string, string> = {
  'flex-start': 'justify-start', 'flex-end': 'justify-end',
  'center': 'justify-center', 'space-between': 'justify-between',
  'space-around': 'justify-around', 'space-evenly': 'justify-evenly',
  'start': 'justify-start', 'end': 'justify-end',
};

// Align items
const alignItemsScale: Record<string, string> = {
  'flex-start': 'items-start', 'flex-end': 'items-end',
  'center': 'items-center', 'baseline': 'items-baseline',
  'stretch': 'items-stretch', 'start': 'items-start', 'end': 'items-end',
};

// Opacity
const opacityScale: Record<string, string> = {
  '0': 'opacity-0', '0.05': 'opacity-5', '0.1': 'opacity-10',
  '0.2': 'opacity-20', '0.25': 'opacity-25', '0.3': 'opacity-30',
  '0.4': 'opacity-40', '0.5': 'opacity-50', '0.6': 'opacity-60',
  '0.7': 'opacity-70', '0.75': 'opacity-75', '0.8': 'opacity-80',
  '0.9': 'opacity-90', '0.95': 'opacity-95', '1': 'opacity-100',
};

// Text decoration
const textDecorationScale: Record<string, string> = {
  'none': 'no-underline',
  'underline': 'underline',
  'line-through': 'line-through',
  'overline': 'overline',
};

// Font style
const fontStyleScale: Record<string, string> = {
  'normal': 'not-italic',
  'italic': 'italic',
};

// Letter spacing
const letterSpacingScale: Record<string, string> = {
  '-0.05em': 'tracking-tighter',
  '-0.025em': 'tracking-tight',
  '0': 'tracking-normal',
  '0em': 'tracking-normal',
  '0.025em': 'tracking-wide',
  '0.05em': 'tracking-wider',
  '0.1em': 'tracking-widest',
};

/**
 * Parse une valeur de couleur et retourne le format hex normalisé
 */
function normalizeColor(color: string): string {
  color = color.trim().toLowerCase();
  
  // Déjà en hex
  if (color.startsWith('#')) {
    // Convertir #rgb en #rrggbb
    if (color.length === 4) {
      return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
    }
    return color;
  }
  
  // rgb/rgba
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  
  return color;
}

/**
 * Calcule la distance entre deux couleurs (pour trouver la plus proche)
 */
function colorDistance(hex1: string, hex2: string): number {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  
  return Math.sqrt(
    Math.pow(r1 - r2, 2) + 
    Math.pow(g1 - g2, 2) + 
    Math.pow(b1 - b2, 2)
  );
}

/**
 * Trouve la couleur Tailwind la plus proche
 */
function findClosestTailwindColor(hex: string): { name: string; exact: boolean } {
  const normalized = normalizeColor(hex);
  
  // Match exact
  const exact = hexToTailwind.get(normalized);
  if (exact) {
    return { name: exact, exact: true };
  }
  
  // Trouver la plus proche
  let closest = 'gray-500';
  let minDistance = Infinity;
  
  for (const [tailwindHex, tailwindName] of hexToTailwind.entries()) {
    const distance = colorDistance(normalized, tailwindHex);
    if (distance < minDistance) {
      minDistance = distance;
      closest = tailwindName;
    }
  }
  
  // Si la distance est trop grande, utiliser arbitrary value
  if (minDistance > 50) {
    return { name: `[${normalized}]`, exact: false };
  }
  
  return { name: closest, exact: false };
}

/**
 * Convertit une valeur de spacing en classe Tailwind
 */
function convertSpacing(value: string, prefix: string): string {
  const px = parseInt(value);
  if (isNaN(px)) return `${prefix}-[${value}]`;
  
  // Chercher dans la scale
  const tailwindValue = spacingScale[px];
  if (tailwindValue) {
    return `${prefix}-${tailwindValue}`;
  }
  
  // Valeur custom avec arbitrary
  return `${prefix}-[${px}px]`;
}

/**
 * Convertit un shadow en classe Tailwind
 */
function convertBoxShadow(value: string): string {
  // Normaliser
  const normalized = value.toLowerCase().replace(/\s+/g, ' ').trim();
  
  // Check exact match
  for (const [shadowValue, className] of Object.entries(boxShadowScale)) {
    if (normalized.includes(shadowValue) || shadowValue.includes(normalized.slice(0, 20))) {
      return className;
    }
  }
  
  // Heuristiques basées sur les valeurs
  if (normalized.includes('10px 15px') || normalized.includes('0.1)')) {
    return 'shadow-lg';
  }
  if (normalized.includes('4px 6px')) {
    return 'shadow-md';
  }
  if (normalized.includes('1px 2px') || normalized.includes('1px 3px')) {
    return 'shadow-sm';
  }
  if (normalized.includes('20px 25px') || normalized.includes('25px 50px')) {
    return 'shadow-xl';
  }
  
  // Arbitrary value pour les shadows custom
  return `shadow-[${value.replace(/\s+/g, '_')}]`;
}

export interface ConversionResult {
  property: string;
  originalValue: string;
  tailwindClass: string;
  exact: boolean;
  note?: string;
}

export interface FullConversionResult {
  classes: string[];
  conversions: ConversionResult[];
  unconverted: Array<{ property: string; value: string }>;
}

/**
 * Convertit un objet de styles CSS en classes Tailwind
 */
export function cssToTailwind(styles: Record<string, string>): FullConversionResult {
  const conversions: ConversionResult[] = [];
  const unconverted: Array<{ property: string; value: string }> = [];
  const classes: string[] = [];

  for (const [property, value] of Object.entries(styles)) {
    if (!value || value === 'undefined' || value === 'inherit' || value === 'initial') {
      continue;
    }

    let result: ConversionResult | null = null;

    switch (property) {
      // Colors
      case 'backgroundColor': {
        const color = findClosestTailwindColor(value);
        result = {
          property,
          originalValue: value,
          tailwindClass: `bg-${color.name}`,
          exact: color.exact,
        };
        break;
      }
      case 'color': {
        const color = findClosestTailwindColor(value);
        result = {
          property,
          originalValue: value,
          tailwindClass: `text-${color.name}`,
          exact: color.exact,
        };
        break;
      }

      // Typography
      case 'fontSize': {
        const tw = fontSizeScale[value];
        if (tw) {
          result = { property, originalValue: value, tailwindClass: tw, exact: true };
        } else {
          result = { property, originalValue: value, tailwindClass: `text-[${value}]`, exact: false };
        }
        break;
      }
      case 'fontWeight': {
        const tw = fontWeightScale[value];
        if (tw) {
          result = { property, originalValue: value, tailwindClass: tw, exact: true };
        } else {
          result = { property, originalValue: value, tailwindClass: `font-[${value}]`, exact: false };
        }
        break;
      }
      case 'textAlign': {
        const tw = textAlignScale[value];
        if (tw) {
          result = { property, originalValue: value, tailwindClass: tw, exact: true };
        }
        break;
      }

      // Spacing
      case 'padding': {
        const tailwind = convertSpacing(value, 'p');
        result = { property, originalValue: value, tailwindClass: tailwind, exact: !tailwind.includes('[') };
        break;
      }
      case 'paddingTop': {
        const tailwind = convertSpacing(value, 'pt');
        result = { property, originalValue: value, tailwindClass: tailwind, exact: !tailwind.includes('[') };
        break;
      }
      case 'paddingRight': {
        const tailwind = convertSpacing(value, 'pr');
        result = { property, originalValue: value, tailwindClass: tailwind, exact: !tailwind.includes('[') };
        break;
      }
      case 'paddingBottom': {
        const tailwind = convertSpacing(value, 'pb');
        result = { property, originalValue: value, tailwindClass: tailwind, exact: !tailwind.includes('[') };
        break;
      }
      case 'paddingLeft': {
        const tailwind = convertSpacing(value, 'pl');
        result = { property, originalValue: value, tailwindClass: tailwind, exact: !tailwind.includes('[') };
        break;
      }
      case 'margin': {
        const tailwind = convertSpacing(value, 'm');
        result = { property, originalValue: value, tailwindClass: tailwind, exact: !tailwind.includes('[') };
        break;
      }
      case 'marginTop': {
        const tailwind = convertSpacing(value, 'mt');
        result = { property, originalValue: value, tailwindClass: tailwind, exact: !tailwind.includes('[') };
        break;
      }
      case 'marginRight': {
        const tailwind = convertSpacing(value, 'mr');
        result = { property, originalValue: value, tailwindClass: tailwind, exact: !tailwind.includes('[') };
        break;
      }
      case 'marginBottom': {
        const tailwind = convertSpacing(value, 'mb');
        result = { property, originalValue: value, tailwindClass: tailwind, exact: !tailwind.includes('[') };
        break;
      }
      case 'marginLeft': {
        const tailwind = convertSpacing(value, 'ml');
        result = { property, originalValue: value, tailwindClass: tailwind, exact: !tailwind.includes('[') };
        break;
      }
      case 'gap': {
        const tailwind = convertSpacing(value, 'gap');
        result = { property, originalValue: value, tailwindClass: tailwind, exact: !tailwind.includes('[') };
        break;
      }

      // Sizing
      case 'width': {
        if (value === '100%') {
          result = { property, originalValue: value, tailwindClass: 'w-full', exact: true };
        } else if (value === 'auto') {
          result = { property, originalValue: value, tailwindClass: 'w-auto', exact: true };
        } else {
          const tailwind = convertSpacing(value, 'w');
          result = { property, originalValue: value, tailwindClass: tailwind, exact: !tailwind.includes('[') };
        }
        break;
      }
      case 'height': {
        if (value === '100%') {
          result = { property, originalValue: value, tailwindClass: 'h-full', exact: true };
        } else if (value === 'auto') {
          result = { property, originalValue: value, tailwindClass: 'h-auto', exact: true };
        } else {
          const tailwind = convertSpacing(value, 'h');
          result = { property, originalValue: value, tailwindClass: tailwind, exact: !tailwind.includes('[') };
        }
        break;
      }

      // Border
      case 'borderRadius': {
        const tw = borderRadiusScale[value];
        if (tw) {
          result = { property, originalValue: value, tailwindClass: tw, exact: true };
        } else {
          result = { property, originalValue: value, tailwindClass: `rounded-[${value}]`, exact: false };
        }
        break;
      }

      // Layout
      case 'display': {
        const tw = displayScale[value];
        if (tw) {
          result = { property, originalValue: value, tailwindClass: tw, exact: true };
        }
        break;
      }
      case 'position': {
        const tw = positionScale[value];
        if (tw) {
          result = { property, originalValue: value, tailwindClass: tw, exact: true };
        }
        break;
      }
      case 'flexDirection': {
        const tw = flexDirectionScale[value];
        if (tw) {
          result = { property, originalValue: value, tailwindClass: tw, exact: true };
        }
        break;
      }
      case 'justifyContent': {
        const tw = justifyContentScale[value];
        if (tw) {
          result = { property, originalValue: value, tailwindClass: tw, exact: true };
        }
        break;
      }
      case 'alignItems': {
        const tw = alignItemsScale[value];
        if (tw) {
          result = { property, originalValue: value, tailwindClass: tw, exact: true };
        }
        break;
      }

      // Effects
      case 'boxShadow': {
        const tw = convertBoxShadow(value);
        result = { property, originalValue: value, tailwindClass: tw, exact: !tw.includes('[') };
        break;
      }
      case 'opacity': {
        const tw = opacityScale[value];
        if (tw) {
          result = { property, originalValue: value, tailwindClass: tw, exact: true };
        } else {
          const percent = Math.round(parseFloat(value) * 100);
          result = { property, originalValue: value, tailwindClass: `opacity-[${percent}%]`, exact: false };
        }
        break;
      }

      // Text decoration
      case 'textDecoration':
      case 'text-decoration': {
        const tw = textDecorationScale[value];
        if (tw) {
          result = { property, originalValue: value, tailwindClass: tw, exact: true };
        }
        break;
      }

      // Font style
      case 'fontStyle':
      case 'font-style': {
        const tw = fontStyleScale[value];
        if (tw) {
          result = { property, originalValue: value, tailwindClass: tw, exact: true };
        }
        break;
      }

      // Letter spacing
      case 'letterSpacing':
      case 'letter-spacing': {
        const tw = letterSpacingScale[value];
        if (tw) {
          result = { property, originalValue: value, tailwindClass: tw, exact: true };
        } else {
          // Try to convert px to em
          const pxMatch = value.match(/^(-?\d+(?:\.\d+)?)px$/);
          if (pxMatch) {
            const px = parseFloat(pxMatch[1]);
            const em = (px / 16).toFixed(3);
            if (letterSpacingScale[`${em}em`]) {
              result = { property, originalValue: value, tailwindClass: letterSpacingScale[`${em}em`], exact: false };
            } else {
              result = { property, originalValue: value, tailwindClass: `tracking-[${value}]`, exact: false };
            }
          }
        }
        break;
      }

      default:
        unconverted.push({ property, value });
    }

    if (result) {
      conversions.push(result);
      classes.push(result.tailwindClass);
    }
  }

  return { classes, conversions, unconverted };
}

/**
 * Génère une string de classes Tailwind à partir des styles
 */
export function stylesToTailwindString(styles: Record<string, string>): string {
  const result = cssToTailwind(styles);
  return result.classes.join(' ');
}

/**
 * Groupes de classes Tailwind qui sont mutuellement exclusives
 */
const classGroups: Record<string, RegExp> = {
  // Colors (including arbitrary values like text-[#ff0000])
  textColor: /^text-(\[.+?\]|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-\d+)?)$/,
  bgColor: /^bg-(\[.+?\]|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black|transparent)(-\d+)?)$/,
  borderColor: /^border-(\[.+?\]|(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black|transparent)(-\d+)?)$/,
  
  // Typography
  fontSize: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)$/,
  fontWeight: /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/,
  textAlign: /^text-(left|center|right|justify|start|end)$/,
  lineHeight: /^leading-/,
  fontFamily: /^font-(sans|serif|mono)$/,
  
  // Spacing
  padding: /^p-/,
  paddingX: /^px-/,
  paddingY: /^py-/,
  paddingTop: /^pt-/,
  paddingRight: /^pr-/,
  paddingBottom: /^pb-/,
  paddingLeft: /^pl-/,
  margin: /^m-/,
  marginX: /^mx-/,
  marginY: /^my-/,
  marginTop: /^mt-/,
  marginRight: /^mr-/,
  marginBottom: /^mb-/,
  marginLeft: /^ml-/,
  
  // Sizing
  width: /^w-/,
  height: /^h-/,
  minWidth: /^min-w-/,
  maxWidth: /^max-w-/,
  minHeight: /^min-h-/,
  maxHeight: /^max-h-/,
  
  // Layout
  display: /^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden|contents)$/,
  position: /^(static|relative|absolute|fixed|sticky)$/,
  overflow: /^overflow-/,
  
  // Flexbox
  flexDirection: /^flex-(row|row-reverse|col|col-reverse)$/,
  flexWrap: /^flex-(wrap|wrap-reverse|nowrap)$/,
  justifyContent: /^justify-/,
  alignItems: /^items-/,
  alignSelf: /^self-/,
  gap: /^gap-/,
  
  // Border
  borderRadius: /^rounded-/,
  borderWidth: /^border-/,
  
  // Effects
  shadow: /^shadow-/,
  opacity: /^opacity-/,
};

/**
 * Détermine le groupe d'une classe Tailwind
 */
function getClassGroup(cls: string): string | null {
  for (const [group, pattern] of Object.entries(classGroups)) {
    if (pattern.test(cls)) {
      return group;
    }
  }
  return null;
}

/**
 * Merge des classes existantes avec les nouvelles classes Tailwind
 * en évitant les doublons et conflits
 */
export function mergeClasses(existingClasses: string, newClasses: string): string {
  const existing = existingClasses.split(/\s+/).filter(Boolean);
  const newOnes = newClasses.split(/\s+/).filter(Boolean);
  
  // Map des groupes existants vers leurs classes (peut avoir plusieurs classes par groupe)
  const existingGroups = new Map<string, string[]>();
  const ungroupedExisting: string[] = [];
  
  for (const cls of existing) {
    const group = getClassGroup(cls);
    if (group) {
      if (!existingGroups.has(group)) {
        existingGroups.set(group, []);
      }
      existingGroups.get(group)!.push(cls);
    } else {
      ungroupedExisting.push(cls);
    }
  }
  
  // Construire le résultat : classes non groupées + nouvelles classes (qui remplacent les anciennes du même groupe)
  const result = [...ungroupedExisting];
  const usedGroups = new Set<string>();
  
  // D'abord, ajouter toutes les nouvelles classes
  for (const cls of newOnes) {
    const group = getClassGroup(cls);
    if (group) {
      usedGroups.add(group);
      result.push(cls);
    } else {
      // Si pas de groupe, ajouter directement (éviter les doublons)
      if (!result.includes(cls)) {
        result.push(cls);
      }
    }
  }
  
  // Ensuite, réintégrer les classes existantes groupées qui n'ont pas été remplacées
  for (const [group, classes] of existingGroups.entries()) {
    if (!usedGroups.has(group)) {
      result.push(...classes);
    }
  }
  
  return result.join(' ');
}
