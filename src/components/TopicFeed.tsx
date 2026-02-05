"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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

  // Selection input state - shows at bottom when text is selected
  const [selectionInput, setSelectionInput] = useState<{
    text: string;
    question: string;
  }>({
    text: "",
    question: "",
  });
  
  // Ref for the input to ensure focus
  const selectionInputRef = useRef<HTMLInputElement>(null);

  // Handle question submission (includes selected text context)
  const handleQuestionSubmit = useCallback(async (question: string, selectedTextOverride?: string) => {
    if (!currentTopic) return;

    const contextText = selectedTextOverride || questionState.selectedText || selectionInput.text;
    
    setQuestionState((prev) => ({ ...prev, isLoading: true, isOpen: true }));

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: currentTopic.id,
          question,
          selectedText: contextText,
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
  }, [currentTopic, questionState.selectedText, selectionInput.text]);

  // Auto-show input bar when text is selected
  useEffect(() => {
    if (hasSelection && selectedText && selectedText.length > 2 && !selectionInput.text) {
      // Show input bar immediately when text is selected
      const timer = setTimeout(() => {
        setSelectionInput({ text: selectedText, question: "" });
        clearSelection();
      }, 150); // Small delay to let selection complete
      return () => clearTimeout(timer);
    }
  }, [hasSelection, selectedText, selectionInput.text, clearSelection]);

  // Focus input when selection bar appears
  useEffect(() => {
    if (selectionInput.text && selectionInputRef.current) {
      // Small delay to ensure the element is rendered
      const timer = setTimeout(() => {
        selectionInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectionInput.text]);

  // Handle Enter key
  const handleEnter = useCallback(() => {
    if (selectionInput.text) {
      // Selection input is active
      if (selectionInput.question.trim()) {
        // User typed a question - ask about the selected text
        handleQuestionSubmit(selectionInput.question);
        setQuestionState((prev) => ({ ...prev, isOpen: true, selectedText: selectionInput.text }));
        setSelectionInput({ text: "", question: "" });
      } else {
        // No question typed - explore the concept
        exploreConcept(selectionInput.text);
        setSelectionInput({ text: "", question: "" });
      }
    } else {
      // Default: go deeper (same as right arrow)
      navigate("right");
    }
  }, [exploreConcept, navigate, selectionInput, handleQuestionSubmit]);

  // Handle keyboard navigation
  useKeyboardNavigation({
    onNavigate: navigate,
    onEnter: handleEnter,
    onEscape: () => {
      if (selectionInput.text) {
        setSelectionInput({ text: "", question: "" });
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
      {/* Mode indicator */}
      <div className="fixed top-6 right-6 text-xs z-10">
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
      </div>

      {/* Selection indicator at TOP - shows what text is selected */}
      <AnimatePresence>
        {selectionInput.text && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-purple-600/90 backdrop-blur-sm rounded-full text-sm flex items-center gap-2 shadow-lg"
          >
            <span className="text-white/70">✨</span>
            <span className="text-white font-medium truncate max-w-[300px]">
              "{selectionInput.text}"
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selection input bar - shows at bottom when text is selected */}
      <AnimatePresence>
        {selectionInput.text && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-0 left-0 right-0 z-30 bg-neutral-900/98 backdrop-blur-md border-t border-purple-500/30 p-4 shadow-2xl"
          >
            <div className="max-w-2xl mx-auto">
              <div className="flex gap-3">
                <input
                  ref={selectionInputRef}
                  type="text"
                  value={selectionInput.question}
                  onChange={(e) => setSelectionInput((prev) => ({ ...prev, question: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleEnter();
                    } else if (e.key === "Escape") {
                      setSelectionInput({ text: "", question: "" });
                    }
                  }}
                  placeholder="Type a question, or just press Enter to explore..."
                  className="flex-1 bg-neutral-800/80 border border-neutral-700 rounded-lg px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50"
                />
                <button
                  onClick={handleEnter}
                  className="px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {selectionInput.question.trim() ? (
                    <>Ask</>
                  ) : (
                    <>Explore <span className="opacity-60">↵</span></>
                  )}
                </button>
                <button
                  onClick={() => setSelectionInput({ text: "", question: "" })}
                  className="px-3 py-3 text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  ✕
                </button>
              </div>
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
