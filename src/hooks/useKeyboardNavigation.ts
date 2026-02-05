"use client";

import { useEffect, useCallback } from "react";
import type { SwipeDirection } from "@/types";

interface UseKeyboardNavigationOptions {
  onNavigate: (direction: SwipeDirection) => void;
  onEscape?: () => void;
  onEnter?: () => void;
  enabled?: boolean;
}

export function useKeyboardNavigation({
  onNavigate,
  onEscape,
  onEnter,
  enabled = true,
}: UseKeyboardNavigationOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          onNavigate("up");
          break;
        case "ArrowDown":
          event.preventDefault();
          onNavigate("down");
          break;
        case "ArrowLeft":
          event.preventDefault();
          onNavigate("left");
          break;
        case "ArrowRight":
          event.preventDefault();
          onNavigate("right");
          break;
        case "Enter":
          event.preventDefault();
          onEnter?.();
          break;
        case "Escape":
          event.preventDefault();
          onEscape?.();
          break;
      }
    },
    [onNavigate, onEscape, onEnter, enabled]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

