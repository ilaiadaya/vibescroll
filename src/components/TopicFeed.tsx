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
    selectedText?: string;
  }>({
    isOpen: false,
    isLoading: false,
  });

  // Selection popup state
  const [selectionPopup, setSelectionPopup] = useState<{
    isOpen: boolean;
    text: string;
    position: { x: number; y: number };
  }>({
    isOpen: false,
    text: "",
    position: { x: 0, y: 0 },
  });

  // Handle Enter key - show popup for selected text or default deep dive
  const handleEnter = useCallback(() => {
    if (hasSelection && selectedText) {
      // Get selection position
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectionPopup({
          isOpen: true,
          text: selectedText,
          position: { x: rect.left + rect.width / 2, y: rect.bottom + 10 },
        });
      }
      clearSelection();
    } else if (selectionPopup.isOpen) {
      // If popup is open and enter is pressed again, explore the concept
      exploreConcept(selectionPopup.text);
      setSelectionPopup({ isOpen: false, text: "", position: { x: 0, y: 0 } });
    } else {
      // Default: go deeper (same as right arrow)
      navigate("right");
    }
  }, [hasSelection, selectedText, exploreConcept, clearSelection, navigate, selectionPopup.isOpen, selectionPopup.text]);

  // Handle keyboard navigation
  useKeyboardNavigation({
    onNavigate: navigate,
    onEnter: handleEnter,
    onEscape: () => {
      if (selectionPopup.isOpen) {
        setSelectionPopup({ isOpen: false, text: "", position: { x: 0, y: 0 } });
      } else if (questionState.isOpen) {
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

  // Handle question submission (includes selected text context)
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
          selectedText: questionState.selectedText || selectionPopup.text,
          topicContext: currentTopic.content,
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
  }, [currentTopic, questionState.selectedText, selectionPopup.text]);

  // Handle asking a question about selected text
  const handleAskAboutSelection = useCallback((question?: string) => {
    if (question) {
      // User typed a question
      setQuestionState({
        isOpen: true,
        selectedText: selectionPopup.text,
        isLoading: false,
      });
      setSelectionPopup({ isOpen: false, text: "", position: { x: 0, y: 0 } });
      handleQuestionSubmit(question);
    } else {
      // User wants to type a question
      setQuestionState({
        isOpen: true,
        selectedText: selectionPopup.text,
        isLoading: false,
        position: selectionPopup.position,
      });
      setSelectionPopup({ isOpen: false, text: "", position: { x: 0, y: 0 } });
    }
  }, [selectionPopup.text, selectionPopup.position, handleQuestionSubmit]);

  // Handle exploring the selected concept
  const handleExploreSelection = useCallback(() => {
    exploreConcept(selectionPopup.text);
    setSelectionPopup({ isOpen: false, text: "", position: { x: 0, y: 0 } });
  }, [exploreConcept, selectionPopup.text]);

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

      {/* Selection indicator - shows when text is selected */}
      <AnimatePresence>
        {hasSelection && !selectionPopup.isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-purple-600/90 rounded-full text-sm flex items-center gap-2"
          >
            <span className="text-white/80">Press</span>
            <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-mono">↵</span>
            <span className="text-white/80">for options</span>
            <span className="text-white font-medium truncate max-w-[200px]">
              "{selectedText}"
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selection popup - shows after pressing Enter on selection */}
      <AnimatePresence>
        {selectionPopup.isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="fixed z-30 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-4 min-w-[300px] max-w-[400px]"
            style={{
              left: Math.min(Math.max(selectionPopup.position.x - 150, 20), window.innerWidth - 320),
              top: Math.min(selectionPopup.position.y, window.innerHeight - 250),
            }}
          >
            <div className="mb-3">
              <span className="text-neutral-400 text-xs uppercase tracking-wider">Selected:</span>
              <p className="text-white font-medium mt-1 line-clamp-2">"{selectionPopup.text}"</p>
            </div>
            
            <div className="space-y-2">
              <button
                onClick={handleExploreSelection}
                className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <span>🔍</span> Explore this concept
              </button>
              
              <button
                onClick={() => handleAskAboutSelection()}
                className="w-full px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <span>💬</span> Ask a question about this
              </button>
              
              <button
                onClick={() => setSelectionPopup({ isOpen: false, text: "", position: { x: 0, y: 0 } })}
                className="w-full px-4 py-2 text-neutral-500 hover:text-neutral-300 text-xs transition-colors"
              >
                Cancel (Esc)
              </button>
            </div>
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
