"use client";

import { motion, AnimatePresence } from "framer-motion";

interface ConceptExplorerProps {
  isOpen: boolean;
  concept: string;
  content: string | null;
  isLoading: boolean;
  onClose: () => void;
}

export function ConceptExplorer({
  isOpen,
  concept,
  content,
  isLoading,
  onClose,
}: ConceptExplorerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed inset-0 bg-black z-30"
        >
          {/* Back button */}
          <button
            onClick={onClose}
            className="fixed top-6 left-6 text-neutral-500 hover:text-white transition-colors flex items-center gap-2 text-sm z-40"
          >
            <span className="text-lg">←</span>
            <span>Back</span>
          </button>

          {/* Concept header */}
          <div className="fixed top-6 right-6 text-xs text-purple-400 z-40">
            Exploring concept
          </div>

          {/* Content */}
          <div className="h-full overflow-y-auto px-6 md:px-16 lg:px-24 py-20">
            <div className="max-w-3xl mx-auto">
              {/* Concept title */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-3xl md:text-4xl font-semibold mb-8 text-purple-400"
              >
                {concept}
              </motion.h1>

              {/* Loading state */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  <div className="flex gap-2 items-center text-neutral-500">
                    <motion.span
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      Researching
                    </motion.span>
                    <motion.div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="w-1 h-1 bg-purple-500 rounded-full"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            delay: i * 0.2,
                          }}
                        />
                      ))}
                    </motion.div>
                  </div>
                  
                  {/* Skeleton lines */}
                  {[1, 2, 3].map((i) => (
                    <motion.div
                      key={i}
                      className="h-4 bg-neutral-900 rounded"
                      style={{ width: `${100 - i * 15}%` }}
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.1,
                      }}
                    />
                  ))}
                </motion.div>
              )}

              {/* Content */}
              {content && !isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-lg text-neutral-200 leading-relaxed whitespace-pre-wrap"
                >
                  {content}
                </motion.div>
              )}
            </div>
          </div>

          {/* Escape hint */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 text-xs text-neutral-600 flex items-center gap-2">
            <span className="border border-neutral-700 rounded px-2 py-0.5">Esc</span>
            <span>or</span>
            <span className="border border-neutral-700 rounded px-2 py-0.5">←</span>
            <span>to go back</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

