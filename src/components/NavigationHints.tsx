"use client";

import { motion } from "framer-motion";

interface NavigationHintsProps {
  className?: string;
}

export function NavigationHints({ className = "" }: NavigationHintsProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1, duration: 0.5 }}
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 text-xs text-neutral-600 ${className}`}
    >
      <div className="flex items-center gap-2">
        <KeyHint>↓</KeyHint>
        <span>Next</span>
      </div>
      <div className="flex items-center gap-2">
        <KeyHint>↑</KeyHint>
        <span>Previous</span>
      </div>
      <div className="flex items-center gap-2">
        <KeyHint>→</KeyHint>
        <span>Deep dive</span>
      </div>
      <div className="flex items-center gap-2">
        <KeyHint>←</KeyHint>
        <span>Back</span>
      </div>
      <div className="hidden md:flex items-center gap-2">
        <span className="text-neutral-700">|</span>
        <span>Select text +</span>
        <KeyHint>↵</KeyHint>
        <span>to explore</span>
      </div>
    </motion.div>
  );
}

function KeyHint({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 border border-neutral-700 rounded text-neutral-500 text-xs">
      {children}
    </span>
  );
}

