"use client";

import { useGesture } from "@use-gesture/react";
import { useCallback, useRef } from "react";
import type { SwipeDirection } from "@/types";

interface UseSwipeGesturesOptions {
  onSwipe: (direction: SwipeDirection) => void;
  onLongPress?: (event: { clientX: number; clientY: number }) => void;
  threshold?: number;
  longPressDelay?: number;
  enabled?: boolean;
}

export function useSwipeGestures({
  onSwipe,
  onLongPress,
  threshold = 50,
  longPressDelay = 500,
  enabled = true,
}: UseSwipeGesturesOptions) {
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const bind = useGesture(
    {
      onDragStart: ({ event }) => {
        if (!enabled) return;
        
        const clientX = "clientX" in event ? event.clientX : 0;
        const clientY = "clientY" in event ? event.clientY : 0;
        
        startPosRef.current = { x: clientX, y: clientY };

        // Start long press timer
        if (onLongPress) {
          longPressTimerRef.current = setTimeout(() => {
            if (startPosRef.current) {
              onLongPress({ clientX, clientY });
            }
          }, longPressDelay);
        }
      },
      onDrag: ({ movement: [mx, my], cancel }) => {
        if (!enabled) return;

        // If moved significantly, cancel long press
        if (Math.abs(mx) > 10 || Math.abs(my) > 10) {
          clearLongPressTimer();
        }
      },
      onDragEnd: ({ movement: [mx, my], velocity: [vx, vy] }) => {
        if (!enabled) return;
        
        clearLongPressTimer();
        startPosRef.current = null;

        const absX = Math.abs(mx);
        const absY = Math.abs(my);

        // Determine swipe direction based on dominant axis
        if (absX < threshold && absY < threshold) {
          return; // Not a significant swipe
        }

        let direction: SwipeDirection;

        if (absX > absY) {
          // Horizontal swipe
          direction = mx > 0 ? "right" : "left";
        } else {
          // Vertical swipe
          direction = my > 0 ? "down" : "up";
        }

        onSwipe(direction);
      },
    },
    {
      drag: {
        threshold: 5,
        filterTaps: true,
      },
    }
  );

  return { bind };
}

