'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { PositionMode, PositionValues, GridSize } from '@/lib/position-to-tailwind';
import { snapToGrid } from '@/lib/position-to-tailwind';

export interface DragState {
  isDragging: boolean;
  dragType: 'move' | 'resize-n' | 'resize-s' | 'resize-e' | 'resize-w' | 'resize-ne' | 'resize-nw' | 'resize-se' | 'resize-sw' | null;
}

export interface UsePositionDragOptions {
  initialPosition: PositionValues;
  elementSize: { width: number; height: number };
  containerSize: { width: number; height: number };
  mode: PositionMode;
  gridSize: GridSize;
  onPositionChange: (position: PositionValues) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export interface UsePositionDragReturn {
  position: PositionValues;
  dragState: DragState;
  handleMouseDown: (e: React.MouseEvent, type: DragState['dragType']) => void;
  setPosition: (position: PositionValues) => void;
}

export function usePositionDrag({
  initialPosition,
  elementSize,
  containerSize,
  mode,
  gridSize,
  onPositionChange,
  onDragStart,
  onDragEnd,
}: UsePositionDragOptions): UsePositionDragReturn {
  const [position, setPositionState] = useState<PositionValues>(initialPosition);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragType: null,
  });

  const dragStartRef = useRef<{ x: number; y: number; position: PositionValues } | null>(null);

  // Sync avec initialPosition
  useEffect(() => {
    setPositionState(initialPosition);
  }, [initialPosition]);

  const setPosition = useCallback((newPosition: PositionValues) => {
    setPositionState(newPosition);
    onPositionChange(newPosition);
  }, [onPositionChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent, type: DragState['dragType']) => {
    e.preventDefault();
    e.stopPropagation();

    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      position: { ...position },
    };

    setDragState({ isDragging: true, dragType: type });
    onDragStart?.();
  }, [position, onDragStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging || !dragStartRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    const startPos = dragStartRef.current.position;

    let newPosition: PositionValues = { ...position };

    if (dragState.dragType === 'move') {
      // Déplacement
      if (mode === 'transform') {
        const newTx = (startPos.translateX ?? startPos.left) + deltaX;
        const newTy = (startPos.translateY ?? startPos.top) + deltaY;
        
        newPosition = {
          ...startPos,
          translateX: snapToGrid(newTx, gridSize),
          translateY: snapToGrid(newTy, gridSize),
          top: snapToGrid(newTy, gridSize),
          left: snapToGrid(newTx, gridSize),
        };
      } else {
        // Margin ou Absolute
        const newTop = startPos.top + deltaY;
        const newLeft = startPos.left + deltaX;

        // Contraindre dans le container pour le mode absolute
        const constrainedTop = mode === 'absolute' 
          ? Math.max(0, Math.min(containerSize.height - elementSize.height, newTop))
          : newTop;
        const constrainedLeft = mode === 'absolute'
          ? Math.max(0, Math.min(containerSize.width - elementSize.width, newLeft))
          : newLeft;

        newPosition = {
          ...startPos,
          top: snapToGrid(constrainedTop, gridSize),
          left: snapToGrid(constrainedLeft, gridSize),
        };
      }
    }
    // TODO: Ajouter le resize pour les handles de coin

    setPositionState(newPosition);
    onPositionChange(newPosition);
  }, [dragState, position, mode, gridSize, containerSize, elementSize, onPositionChange]);

  const handleMouseUp = useCallback(() => {
    if (dragState.isDragging) {
      setDragState({ isDragging: false, dragType: null });
      dragStartRef.current = null;
      onDragEnd?.();
    }
  }, [dragState.isDragging, onDragEnd]);

  // Event listeners globaux pour le drag
  useEffect(() => {
    if (dragState.isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);

  return {
    position,
    dragState,
    handleMouseDown,
    setPosition,
  };
}
