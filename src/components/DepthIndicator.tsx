"use client";

import type { ViewDepth } from "@/types";

interface DepthIndicatorProps {
  currentDepth: ViewDepth;
  className?: string;
}

const depthLabels: Record<ViewDepth, string> = {
  summary: "Overview",
  expanded: "Full Story",
  detail: "Deep Dive",
};

const depthLevels: ViewDepth[] = ["summary", "expanded", "detail"];

export function DepthIndicator({ currentDepth, className = "" }: DepthIndicatorProps) {
  const currentIndex = depthLevels.indexOf(currentDepth);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex gap-1.5">
        {depthLevels.map((depth, idx) => (
          <div
            key={depth}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              idx <= currentIndex
                ? "bg-purple-500"
                : "bg-neutral-700"
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-neutral-500 uppercase tracking-wider">
        {depthLabels[currentDepth]}
      </span>
    </div>
  );
}

