"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface QuestionOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (question: string) => void;
  isLoading?: boolean;
  answer?: string;
  position?: { x: number; y: number };
}

export function QuestionOverlay({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  answer,
  position,
}: QuestionOverlayProps) {
  const [question, setQuestion] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuestion("");
    }
  }, [isOpen]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (question.trim() && !isLoading) {
        onSubmit(question.trim());
      }
    },
    [question, isLoading, onSubmit]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [handleSubmit, onClose]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/80 z-40"
            onClick={onClose}
          />

          {/* Overlay content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed z-50 w-full max-w-lg"
            style={{
              left: "50%",
              top: position ? Math.min(position.y, window.innerHeight - 300) : "40%",
              transform: "translateX(-50%)",
            }}
          >
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 shadow-2xl">
              <form onSubmit={handleSubmit}>
                <label className="block text-sm text-neutral-400 mb-2">
                  Ask a question about this topic
                </label>
                <textarea
                  ref={inputRef}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="What would you like to know?"
                  className="w-full bg-black border border-neutral-700 rounded-md p-3 text-white placeholder-neutral-600 focus:border-purple-500 focus:outline-none resize-none"
                  rows={2}
                  disabled={isLoading}
                />
                
                <div className="flex justify-between items-center mt-3">
                  <span className="text-xs text-neutral-600">
                    Press Enter to submit, Esc to close
                  </span>
                  <button
                    type="submit"
                    disabled={!question.trim() || isLoading}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-sm rounded-md transition-colors"
                  >
                    {isLoading ? "Thinking..." : "Ask"}
                  </button>
                </div>
              </form>

              {/* Answer section */}
              <AnimatePresence>
                {answer && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-neutral-800"
                  >
                    <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
                      {answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

