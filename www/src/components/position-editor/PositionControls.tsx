'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  ChevronUpIcon, 
  ChevronDownIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon,
  Link2Icon,
  Link2OffIcon
} from 'lucide-react';
import type { PositionMode, PositionValues, GridSize } from '@/lib/position-to-tailwind';
import { snapToGrid, pxToTailwindSpacing } from '@/lib/position-to-tailwind';

interface PositionControlsProps {
  values: PositionValues;
  onChange: (values: PositionValues) => void;
  mode: PositionMode;
  gridSize: GridSize;
  className?: string;
}

// Presets de valeurs communes
const presets = [0, 4, 8, 16, 24, 32, 48, 64];

export function PositionControls({ 
  values, 
  onChange, 
  mode, 
  gridSize,
  className 
}: PositionControlsProps) {
  const [linked, setLinked] = useState(false);

  const handleChange = useCallback((
    key: keyof PositionValues, 
    rawValue: string | number
  ) => {
    let numValue: number | 'auto';
    
    if (rawValue === 'auto' || rawValue === '') {
      numValue = 'auto';
    } else {
      numValue = typeof rawValue === 'string' ? parseFloat(rawValue) || 0 : rawValue;
      // Snap to grid
      if (typeof numValue === 'number') {
        numValue = snapToGrid(numValue, gridSize);
      }
    }

    const newValues = { ...values };
    
    if (key === 'top' || key === 'left' || key === 'translateX' || key === 'translateY') {
      (newValues as Record<string, number | 'auto'>)[key] = numValue;
    } else {
      (newValues as Record<string, number | 'auto'>)[key] = numValue;
    }

    // Si lié, appliquer la même valeur aux axes opposés
    if (linked && typeof numValue === 'number') {
      if (key === 'top') newValues.bottom = numValue;
      if (key === 'bottom' && newValues.bottom !== 'auto') newValues.top = numValue;
      if (key === 'left') newValues.right = numValue;
      if (key === 'right' && newValues.right !== 'auto') newValues.left = numValue;
    }

    onChange(newValues);
  }, [values, onChange, gridSize, linked]);

  const increment = useCallback((key: keyof PositionValues, delta: number) => {
    const currentValue = values[key];
    if (currentValue === 'auto' || currentValue === undefined) {
      handleChange(key, delta > 0 ? gridSize : -gridSize);
    } else {
      handleChange(key, currentValue + delta);
    }
  }, [values, handleChange, gridSize]);

  // Affichage de la valeur Tailwind pour chaque input
  const getTailwindPreview = (px: number | 'auto'): string => {
    if (px === 'auto') return 'auto';
    return pxToTailwindSpacing(px);
  };

  const renderInput = (
    key: keyof PositionValues,
    label: string,
    icon: React.ReactNode
  ) => {
    const value = values[key];
    const isAuto = value === 'auto';
    const numValue = isAuto ? '' : value;

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] text-zinc-500 uppercase tracking-wider">
            {label}
          </Label>
          <span className="text-[10px] text-blue-400 font-mono">
            {getTailwindPreview(value ?? 0)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => increment(key, -gridSize)}
          >
            {icon}
          </Button>
          <Input
            type="number"
            value={numValue}
            onChange={(e) => handleChange(key, e.target.value)}
            placeholder="auto"
            className="h-7 text-xs font-mono text-center px-1"
            step={gridSize}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 rotate-180"
            onClick={() => increment(key, gridSize)}
          >
            {icon}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Affichage en croix pour Top/Right/Bottom/Left */}
      <div className="grid grid-cols-3 gap-2">
        {/* Top - centre haut */}
        <div className="col-start-2">
          {renderInput(
            mode === 'transform' ? 'translateY' : 'top',
            mode === 'transform' ? 'Y' : 'Top',
            <ChevronUpIcon className="size-3" />
          )}
        </div>
        
        {/* Left - gauche milieu */}
        <div className="col-start-1 row-start-2">
          {renderInput(
            mode === 'transform' ? 'translateX' : 'left',
            mode === 'transform' ? 'X' : 'Left',
            <ChevronLeftIcon className="size-3" />
          )}
        </div>
        
        {/* Centre - bouton link */}
        <div className="col-start-2 row-start-2 flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8",
              linked && "bg-blue-600/20 text-blue-400"
            )}
            onClick={() => setLinked(!linked)}
            title={linked ? "Unlink values" : "Link opposite values"}
          >
            {linked ? <Link2Icon className="size-4" /> : <Link2OffIcon className="size-4" />}
          </Button>
        </div>
        
        {/* Right - droite milieu */}
        {mode !== 'transform' && (
          <div className="col-start-3 row-start-2">
            {renderInput('right', 'Right', <ChevronRightIcon className="size-3" />)}
          </div>
        )}
        
        {/* Bottom - centre bas */}
        {mode !== 'transform' && (
          <div className="col-start-2 row-start-3">
            {renderInput('bottom', 'Bottom', <ChevronDownIcon className="size-3" />)}
          </div>
        )}
      </div>

      {/* Presets rapides */}
      <div className="space-y-1.5">
        <Label className="text-[10px] text-zinc-500">Quick values (px)</Label>
        <div className="flex flex-wrap gap-1">
          {presets.map(px => (
            <Button
              key={px}
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px] font-mono"
              onClick={() => {
                const key = mode === 'transform' ? 'translateY' : 'top';
                handleChange(key, px);
              }}
            >
              {px}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
