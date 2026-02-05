"use client";

import { useMemo, useCallback } from "react";
import type { TopicHighlight } from "@/types";

interface HighlightedTextProps {
  content: string;
  highlights: TopicHighlight[];
  onHighlightClick: (highlight: TopicHighlight) => void;
}

interface TextSegment {
  text: string;
  isHighlight: boolean;
  highlight?: TopicHighlight;
}

export function HighlightedText({
  content,
  highlights,
  onHighlightClick,
}: HighlightedTextProps) {
  const segments = useMemo(() => {
    if (!highlights.length) {
      return [{ text: content, isHighlight: false }];
    }

    const result: TextSegment[] = [];
    let lastIndex = 0;

    // Sort highlights by startIndex
    const sortedHighlights = [...highlights].sort(
      (a, b) => a.startIndex - b.startIndex
    );

    for (const highlight of sortedHighlights) {
      // Find the highlight text in content if indices are invalid
      let startIdx = highlight.startIndex;
      let endIdx = highlight.endIndex;

      if (startIdx === 0 && endIdx === 0) {
        const foundIdx = content.indexOf(highlight.text);
        if (foundIdx >= 0) {
          startIdx = foundIdx;
          endIdx = foundIdx + highlight.text.length;
        } else {
          continue;
        }
      }

      // Add text before highlight
      if (startIdx > lastIndex) {
        result.push({
          text: content.slice(lastIndex, startIdx),
          isHighlight: false,
        });
      }

      // Add highlighted text
      result.push({
        text: content.slice(startIdx, endIdx),
        isHighlight: true,
        highlight,
      });

      lastIndex = endIdx;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      result.push({
        text: content.slice(lastIndex),
        isHighlight: false,
      });
    }

    return result;
  }, [content, highlights]);

  const handleClick = useCallback(
    (highlight: TopicHighlight) => (e: React.MouseEvent) => {
      e.stopPropagation();
      onHighlightClick(highlight);
    },
    [onHighlightClick]
  );

  return (
    <span className="leading-relaxed">
      {segments.map((segment, idx) =>
        segment.isHighlight && segment.highlight ? (
          <button
            key={`${segment.highlight.id}-${idx}`}
            onClick={handleClick(segment.highlight)}
            className="highlight-clickable bg-transparent border-none p-0 m-0 font-inherit text-inherit cursor-pointer hover:text-purple-400 transition-colors duration-150"
          >
            {segment.text}
          </button>
        ) : (
          <span key={idx}>{segment.text}</span>
        )
      )}
    </span>
  );
}

