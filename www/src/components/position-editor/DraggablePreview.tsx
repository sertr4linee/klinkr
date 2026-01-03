'use client';

import { useRef, useMemo, type ReactElement } from 'react';
import { cn } from '@/lib/utils';
import { usePositionDrag, type DragState } from './usePositionDrag';
import type { PositionMode, PositionValues, GridSize } from '@/lib/position-to-tailwind';
import { positionToTailwind, pxToTailwindSpacing } from '@/lib/position-to-tailwind';

interface DraggablePreviewProps {
  position: PositionValues;
  onPositionChange: (position: PositionValues) => void;
  mode: PositionMode;
  gridSize: GridSize;
  showGrid?: boolean;
  className?: string;
}

// Taille du container de preview
const CONTAINER_WIDTH = 200;
const CONTAINER_HEIGHT = 150;
// Taille de l'élément draggable
const ELEMENT_WIDTH = 60;
const ELEMENT_HEIGHT = 40;

export function DraggablePreview({
  position,
  onPositionChange,
  mode,
  gridSize,
  showGrid = true,
  className,
}: DraggablePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    position: dragPosition,
    dragState,
    handleMouseDown,
    setPosition,
  } = usePositionDrag({
    initialPosition: position,
    elementSize: { width: ELEMENT_WIDTH, height: ELEMENT_HEIGHT },
    containerSize: { width: CONTAINER_WIDTH, height: CONTAINER_HEIGHT },
    mode,
    gridSize,
    onPositionChange,
  });

  // Calculer la position visuelle de l'élément
  const elementStyle = useMemo(() => {
    const style: React.CSSProperties = {
      width: ELEMENT_WIDTH,
      height: ELEMENT_HEIGHT,
    };

    if (mode === 'transform') {
      const tx = dragPosition.translateX ?? dragPosition.left;
      const ty = dragPosition.translateY ?? dragPosition.top;
      style.transform = `translate(${tx}px, ${ty}px)`;
      style.position = 'relative';
    } else if (mode === 'margin') {
      style.marginTop = dragPosition.top;
      style.marginLeft = dragPosition.left;
    } else if (mode === 'absolute') {
      style.position = 'absolute';
      style.top = dragPosition.top;
      style.left = dragPosition.left;
    }

    return style;
  }, [dragPosition, mode]);

  // Générer la preview Tailwind
  const tailwindPreview = useMemo(() => {
    const result = positionToTailwind(mode, dragPosition);
    return result.classes.join(' ');
  }, [mode, dragPosition]);

  // Générer le grid pattern
  const gridPattern = useMemo(() => {
    if (!showGrid || gridSize < 4) return null;
    
    const lines: ReactElement[] = [];
    const gridColor = 'rgba(255, 255, 255, 0.05)';
    
    // Vertical lines
    for (let x = gridSize; x < CONTAINER_WIDTH; x += gridSize) {
      lines.push(
        <line
          key={`v-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={CONTAINER_HEIGHT}
          stroke={gridColor}
          strokeWidth={x % (gridSize * 4) === 0 ? 1 : 0.5}
        />
      );
    }
    
    // Horizontal lines
    for (let y = gridSize; y < CONTAINER_HEIGHT; y += gridSize) {
      lines.push(
        <line
          key={`h-${y}`}
          x1={0}
          y1={y}
          x2={CONTAINER_WIDTH}
          y2={y}
          stroke={gridColor}
          strokeWidth={y % (gridSize * 4) === 0 ? 1 : 0.5}
        />
      );
    }
    
    return (
      <svg
        className="absolute inset-0 pointer-events-none"
        width={CONTAINER_WIDTH}
        height={CONTAINER_HEIGHT}
      >
        {lines}
      </svg>
    );
  }, [showGrid, gridSize]);

  // Labels de distance
  const distanceLabels = useMemo(() => {
    const labels: ReactElement[] = [];
    const top = dragPosition.top;
    const left = dragPosition.left;

    // Top distance
    if (top > 0) {
      labels.push(
        <div
          key="top-label"
          className="absolute text-[8px] text-blue-400 font-mono bg-zinc-900/80 px-1 rounded"
          style={{
            left: left + ELEMENT_WIDTH / 2,
            top: top / 2,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {top}px
        </div>
      );
      // Ligne verticale
      labels.push(
        <div
          key="top-line"
          className="absolute w-px bg-blue-400/50"
          style={{
            left: left + ELEMENT_WIDTH / 2,
            top: 0,
            height: top,
          }}
        />
      );
    }

    // Left distance
    if (left > 0) {
      labels.push(
        <div
          key="left-label"
          className="absolute text-[8px] text-blue-400 font-mono bg-zinc-900/80 px-1 rounded"
          style={{
            left: left / 2,
            top: top + ELEMENT_HEIGHT / 2,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {left}px
        </div>
      );
      // Ligne horizontale
      labels.push(
        <div
          key="left-line"
          className="absolute h-px bg-blue-400/50"
          style={{
            left: 0,
            top: top + ELEMENT_HEIGHT / 2,
            width: left,
          }}
        />
      );
    }

    return labels;
  }, [dragPosition]);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Container de preview */}
      <div
        ref={containerRef}
        className={cn(
          "relative rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900/50 overflow-hidden",
          dragState.isDragging && "border-blue-500"
        )}
        style={{ width: CONTAINER_WIDTH, height: CONTAINER_HEIGHT }}
      >
        {/* Grid background */}
        {gridPattern}

        {/* Distance labels */}
        {distanceLabels}

        {/* Parent indicator (pour mode absolute) */}
        {mode === 'absolute' && (
          <div className="absolute top-1 left-1 text-[8px] text-zinc-600 font-mono">
            parent (relative)
          </div>
        )}

        {/* Élément draggable */}
        <div
          className={cn(
            "rounded border-2 bg-blue-500/20 border-blue-500 cursor-move flex items-center justify-center",
            "select-none transition-shadow",
            dragState.isDragging && "shadow-lg shadow-blue-500/20"
          )}
          style={elementStyle}
          onMouseDown={(e) => handleMouseDown(e, 'move')}
        >
          <span className="text-[8px] text-blue-400 font-mono">Element</span>
          
          {/* Resize handles (coins) */}
          {['nw', 'ne', 'sw', 'se'].map((corner) => (
            <div
              key={corner}
              className={cn(
                "absolute w-2 h-2 bg-blue-500 rounded-full border border-blue-300",
                "hover:scale-125 transition-transform",
                corner.includes('n') ? '-top-1' : '-bottom-1',
                corner.includes('w') ? '-left-1' : '-right-1',
                corner === 'nw' && 'cursor-nw-resize',
                corner === 'ne' && 'cursor-ne-resize',
                corner === 'sw' && 'cursor-sw-resize',
                corner === 'se' && 'cursor-se-resize',
              )}
              onMouseDown={(e) => {
                e.stopPropagation();
                handleMouseDown(e, `resize-${corner}` as DragState['dragType']);
              }}
            />
          ))}
        </div>
      </div>

      {/* Tailwind output preview */}
      <div className="flex items-center justify-between bg-zinc-800/50 rounded px-2 py-1">
        <code className="text-[10px] text-emerald-400 font-mono truncate flex-1">
          {tailwindPreview || 'No position classes'}
        </code>
        <span className="text-[9px] text-zinc-500 ml-2 shrink-0">
          grid: {gridSize}px
        </span>
      </div>
    </div>
  );
}
