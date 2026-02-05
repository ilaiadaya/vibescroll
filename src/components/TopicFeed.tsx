"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TopicCard } from "./TopicCard";
import { NavigationHints } from "./NavigationHints";
import { LoadingState } from "./LoadingState";
import { QuestionOverlay } from "./QuestionOverlay";
import { ConceptExplorer } from "./ConceptExplorer";
import { useTopicFeed } from "@/hooks/useTopicFeed";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useSwipeGestures } from "@/hooks/useSwipeGestures";
import { useTextSelection } from "@/hooks/useTextSelection";
import type { TopicHighlight } from "@/types";

export function TopicFeed() {
  const {
    currentTopic,
    topics,
    currentIndex,
    depth,
    isLoading,
    error,
    expandedContent,
    detailContent,
    direction,
    navigate,
    handleHighlightClick,
    resetDepth,
    exploreConcept,
    conceptContent,
    isExploringConcept,
    currentConcept,
    clearConceptExploration,
    mode,
  } = useTopicFeed();

  // Text selection for exploring concepts
  const { selectedText, hasSelection, clearSelection } = useTextSelection();

  // Question overlay state
  const [questionState, setQuestionState] = useState<{
    isOpen: boolean;
    position?: { x: number; y: number };
    isLoading: boolean;
    answer?: string;
  }>({
    isOpen: false,
    isLoading: false,
  });

  // Handle Enter key - explore selected text or default deep dive
  const handleEnter = useCallback(() => {
    if (hasSelection && selectedText) {
      // Explore the selected concept
      exploreConcept(selectedText);
      clearSelection();
    } else {
      // Default: go deeper (same as right arrow)
      navigate("right");
    }
  }, [hasSelection, selectedText, exploreConcept, clearSelection, navigate]);

  // Handle keyboard navigation
  useKeyboardNavigation({
    onNavigate: navigate,
    onEnter: handleEnter,
    onEscape: () => {
      if (questionState.isOpen) {
        setQuestionState({ isOpen: false, isLoading: false });
      } else if (currentConcept) {
        clearConceptExploration();
      } else {
        resetDepth();
      }
    },
  });

  // Handle swipe gestures
  const { bind } = useSwipeGestures({
    onSwipe: navigate,
    onLongPress: (pos) => {
      // If text is selected, explore it; otherwise open question overlay
      if (hasSelection && selectedText) {
        exploreConcept(selectedText);
        clearSelection();
      } else {
        setQuestionState({
          isOpen: true,
          position: { x: pos.clientX, y: pos.clientY },
          isLoading: false,
        });
      }
    },
  });

  // Handle question submission
  const handleQuestionSubmit = useCallback(async (question: string) => {
    if (!currentTopic) return;

    setQuestionState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: currentTopic.id,
          question,
        }),
      });

      if (!response.ok) throw new Error("Failed to get answer");
      
      const data = await response.json();
      
      setQuestionState((prev) => ({
        ...prev,
        isLoading: false,
        answer: data.answer,
      }));
    } catch {
      setQuestionState((prev) => ({
        ...prev,
        isLoading: false,
        answer: "Sorry, I couldn't find an answer to that question.",
      }));
    }
  }, [currentTopic]);

  const handleHighlight = useCallback((highlight: TopicHighlight) => {
    handleHighlightClick(highlight);
  }, [handleHighlightClick]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-md text-sm transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!currentTopic) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black">
        <p className="text-neutral-500">No topics available</p>
      </div>
    );
  }

  return (
    <div
      {...bind()}
      className="fixed inset-0 bg-black overflow-hidden touch-none"
    >
      {/* Topic counter and mode indicator */}
      <div className="fixed top-6 right-6 text-xs text-neutral-600 z-10 flex items-center gap-3">
        {mode === "demo" && (
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-[10px] uppercase tracking-wider">
            Demo Mode
          </span>
        )}
        {mode === "live" && (
          <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-[10px] uppercase tracking-wider flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            Live
          </span>
        )}
        <span>{currentIndex + 1} / {topics.length}</span>
      </div>

      {/* Selection indicator */}
      <AnimatePresence>
        {hasSelection && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-purple-600/90 rounded-full text-sm flex items-center gap-2"
          >
            <span className="text-white/80">Press</span>
            <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-mono">↵</span>
            <span className="text-white/80">to explore</span>
            <span className="text-white font-medium truncate max-w-[200px]">
              "{selectedText}"
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Topic cards */}
      <AnimatePresence mode="wait">
        <TopicCard
          key={currentTopic.id}
          topic={currentTopic}
          depth={depth}
          expandedContent={expandedContent}
          detailContent={detailContent}
          onHighlightClick={handleHighlight}
          isActive={true}
          direction={direction}
        />
      </AnimatePresence>

      {/* Concept Explorer overlay */}
      <ConceptExplorer
        isOpen={!!currentConcept}
        concept={currentConcept || ""}
        content={conceptContent}
        isLoading={isExploringConcept}
        onClose={clearConceptExploration}
      />

      {/* Navigation hints */}
      <NavigationHints />

      {/* Question overlay */}
      <QuestionOverlay
        isOpen={questionState.isOpen}
        onClose={() => setQuestionState({ isOpen: false, isLoading: false })}
        onSubmit={handleQuestionSubmit}
        isLoading={questionState.isLoading}
        answer={questionState.answer}
        position={questionState.position}
      />
    </div>
  );
}
