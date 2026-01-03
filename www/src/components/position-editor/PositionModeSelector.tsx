'use client';

import { cn } from '@/lib/utils';
import { MoveIcon, Move3DIcon, PinIcon } from 'lucide-react';
import type { PositionMode } from '@/lib/position-to-tailwind';

interface PositionModeSelectorProps {
  value: PositionMode;
  onChange: (mode: PositionMode) => void;
  className?: string;
}

const modes: { value: PositionMode; label: string; icon: React.ReactNode; description: string }[] = [
  { 
    value: 'margin', 
    label: 'Margin', 
    icon: <MoveIcon className="size-3.5" />,
    description: 'Respecte le flow du document'
  },
  { 
    value: 'transform', 
    label: 'Transform', 
    icon: <Move3DIcon className="size-3.5" />,
    description: 'Déplacement visuel uniquement'
  },
  { 
    value: 'absolute', 
    label: 'Absolute', 
    icon: <PinIcon className="size-3.5" />,
    description: 'Position libre dans le parent'
  },
];

export function PositionModeSelector({ value, onChange, className }: PositionModeSelectorProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-1">
        {modes.map((mode) => (
          <button
            key={mode.value}
            onClick={() => onChange(mode.value)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all",
              value === mode.value
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300"
            )}
          >
            {mode.icon}
            <span>{mode.label}</span>
          </button>
        ))}
      </div>
      
      {/* Description du mode actuel */}
      <p className="text-[10px] text-zinc-500 text-center">
        {modes.find(m => m.value === value)?.description}
      </p>
    </div>
  );
}
