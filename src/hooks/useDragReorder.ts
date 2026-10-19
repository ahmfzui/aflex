import { useState, type DragEvent } from 'react';

/**
 * Minimal HTML5 drag-to-reorder for lists and grids. Always paired with
 * button-based move controls, since native DnD isn't available everywhere
 * (touch screens, keyboard users).
 */
export function useDragReorder(onMove: (from: number, to: number) => void, enabled = true) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const itemProps = (index: number) => {
    if (!enabled) return {};
    return {
      draggable: true,
      'data-dragging': dragIndex === index ? 'true' : undefined,
      'data-over': overIndex === index && dragIndex !== null && dragIndex !== index ? 'true' : undefined,
      onDragStart: (event: DragEvent) => {
        setDragIndex(index);
        event.dataTransfer.effectAllowed = 'move';
        // Firefox needs data to start a drag.
        event.dataTransfer.setData('text/plain', String(index));
      },
      onDragOver: (event: DragEvent) => {
        if (dragIndex === null) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        if (overIndex !== index) setOverIndex(index);
      },
      onDragLeave: () => {
        if (overIndex === index) setOverIndex(null);
      },
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        if (dragIndex !== null && dragIndex !== index) onMove(dragIndex, index);
        setDragIndex(null);
        setOverIndex(null);
      },
      onDragEnd: () => {
        setDragIndex(null);
        setOverIndex(null);
      },
    };
  };

  return { itemProps, dragging: dragIndex !== null };
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
