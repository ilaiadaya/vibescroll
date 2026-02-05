"use client";

import { motion, AnimatePresence } from "framer-motion";
import { HighlightedText } from "./HighlightedText";
import { DepthIndicator } from "./DepthIndicator";
import type { Topic, TopicHighlight, ViewDepth } from "@/types";

interface TopicCardProps {
  topic: Topic;
  depth: ViewDepth;
  expandedContent?: string;
  detailContent?: string;
  onHighlightClick: (highlight: TopicHighlight) => void;
  isActive: boolean;
  direction?: "up" | "down";
}

export function TopicCard({
  topic,
  depth,
  expandedContent,
  detailContent,
  onHighlightClick,
  isActive,
  direction = "down",
}: TopicCardProps) {
  const categoryColors: Record<string, string> = {
    news: "text-red-400",
    tech: "text-blue-400",
    science: "text-green-400",
    finance: "text-yellow-400",
    culture: "text-pink-400",
    politics: "text-orange-400",
    health: "text-teal-400",
    sports: "text-indigo-400",
    general: "text-neutral-400",
  };

  return (
    <motion.div
      initial={{ 
        opacity: 0, 
        y: direction === "down" ? 100 : -100 
      }}
      animate={{ 
        opacity: isActive ? 1 : 0, 
        y: isActive ? 0 : (direction === "down" ? -100 : 100)
      }}
      exit={{ 
        opacity: 0, 
        y: direction === "down" ? -100 : 100 
      }}
      transition={{ 
        duration: 0.4, 
        ease: [0.25, 0.1, 0.25, 1] 
      }}
      className="absolute inset-0 flex flex-col justify-center px-6 md:px-16 lg:px-24 overflow-y-auto"
    >
      <div className="max-w-3xl mx-auto w-full py-16">
        {/* Category & Timestamp */}
        <div className="flex items-center gap-4 mb-4">
          <span className={`text-xs uppercase tracking-widest ${categoryColors[topic.category] || "text-neutral-400"}`}>
            {topic.category}
          </span>
          <span className="text-xs text-neutral-600">
            {formatTimeAgo(topic.timestamp)}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold leading-tight mb-6 tracking-tight">
          {topic.title}
        </h1>

        {/* Content based on depth */}
        <AnimatePresence mode="wait">
          {depth === "summary" && (
            <motion.div
              key="summary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <p className="text-lg md:text-xl text-neutral-300 leading-relaxed">
                {topic.summary}
              </p>
            </motion.div>
          )}

          {depth === "expanded" && (
            <motion.div
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Full content with clickable highlights - no deep dive yet */}
              <div className="text-lg text-neutral-200 leading-relaxed">
                <HighlightedText
                  content={topic.content}
                  highlights={topic.highlights}
                  onHighlightClick={onHighlightClick}
                />
              </div>
            </motion.div>
          )}

          {depth === "detail" && (
            <motion.div
              key="detail"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Original content */}
              <div className="text-lg text-neutral-300 leading-relaxed">
                <HighlightedText
                  content={topic.content}
                  highlights={topic.highlights}
                  onHighlightClick={onHighlightClick}
                />
              </div>
              
              {/* Deep dive research */}
              {(expandedContent || detailContent) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="pt-6 border-t border-neutral-800"
                >
                  <p className="text-xs text-purple-400 uppercase tracking-widest mb-3">
                    Deep Dive
                  </p>
                  <div className="text-base text-neutral-200 leading-relaxed whitespace-pre-wrap">
                    {detailContent || expandedContent}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Source */}
        <div className="mt-8 flex items-center justify-between">
          <a
            href={topic.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            Source: {topic.source}
          </a>
          <DepthIndicator currentDepth={depth} />
        </div>
      </div>
    </motion.div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return new Date(date).toLocaleDateString();
}

