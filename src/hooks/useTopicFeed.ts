"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { Topic, ViewDepth, TopicHighlight, SwipeDirection } from "@/types";

interface UseTopicFeedOptions {
  preloadCount?: number;
}

interface TopicFeedState {
  topics: Topic[];
  currentIndex: number;
  depth: ViewDepth;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  expandedContent: Record<string, string>;
  detailContent: Record<string, string>;
  direction: "up" | "down";
  // Concept exploration
  currentConcept: string | null;
  conceptContent: string | null;
  isExploringConcept: boolean;
  // Concept cache for preloading
  conceptCache: Record<string, string>;
  // API mode indicator
  mode: "live" | "demo";
  // Infinite scroll
  hasMore: boolean;
}

export function useTopicFeed({ preloadCount = 2 }: UseTopicFeedOptions = {}) {
  const [state, setState] = useState<TopicFeedState>({
    topics: [],
    currentIndex: 0,
    depth: "summary",
    isLoading: true,
    isLoadingMore: false,
    error: null,
    expandedContent: {},
    detailContent: {},
    direction: "down",
    currentConcept: null,
    conceptContent: null,
    isExploringConcept: false,
    conceptCache: {},
    mode: "demo",
    hasMore: true,
  });

  const preloadedRef = useRef<Set<string>>(new Set());
  const conceptPreloadRef = useRef<Set<string>>(new Set());

  // Fetch initial topics (3 at a time)
  const fetchTopics = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch("/api/topics?count=3");
      if (!response.ok) throw new Error("Failed to fetch topics");
      
      const data = await response.json();
      
      setState((prev) => ({
        ...prev,
        topics: data.topics,
        mode: data.mode || "demo",
        hasMore: data.hasMore !== false,
        isLoading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  }, []);

  // Load more topics for infinite scroll
  const loadMoreTopics = useCallback(async () => {
    if (state.isLoadingMore) return;

    setState((prev) => ({ ...prev, isLoadingMore: true }));

    try {
      const response = await fetch("/api/topics?count=3");
      if (!response.ok) throw new Error("Failed to fetch more topics");
      
      const data = await response.json();
      
      // Filter out duplicates by ID
      const existingIds = new Set(state.topics.map(t => t.id));
      const newTopics = data.topics.filter((t: Topic) => !existingIds.has(t.id));
      
      setState((prev) => ({
        ...prev,
        topics: [...prev.topics, ...newTopics],
        hasMore: true, // Always allow more loading
        isLoadingMore: false,
      }));
    } catch (error) {
      console.error("Error loading more topics:", error);
      setState((prev) => ({ ...prev, isLoadingMore: false }));
    }
  }, [state.isLoadingMore, state.topics]);

  // Build expand URL with topic data
  const buildExpandUrl = useCallback((topic: Topic) => {
    const params = new URLSearchParams({
      topicId: topic.id,
      title: topic.title,
      content: topic.content,
    });
    return `/api/expand?${params.toString()}`;
  }, []);

  // Preload upcoming topics and their deep dives
  const preloadTopics = useCallback(async () => {
    const { topics, currentIndex } = state;
    const currentTopic = topics[currentIndex];
    
    // Preload deep dive for current topic
    if (currentTopic && !preloadedRef.current.has(currentTopic.id)) {
      preloadedRef.current.add(currentTopic.id);
      // Pass topic data with the request
      fetch(buildExpandUrl(currentTopic)).catch(() => {});
      
      // Preload concept explorations for highlighted terms
      currentTopic.highlights.forEach((h) => {
        const cacheKey = `${currentTopic.id}:${h.text}`;
        if (!conceptPreloadRef.current.has(cacheKey)) {
          conceptPreloadRef.current.add(cacheKey);
          fetch("/api/explore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              concept: h.text,
              topicId: currentTopic.id,
              topicContext: currentTopic.content,
            }),
          })
            .then((res) => res.json())
            .then((data) => {
              setState((prev) => ({
                ...prev,
                conceptCache: {
                  ...prev.conceptCache,
                  [h.text.toLowerCase()]: data.content,
                },
              }));
            })
            .catch(() => {});
        }
      });
    }
    
    // Preload next 2 topics
    const startIdx = currentIndex + 1;
    const endIdx = Math.min(currentIndex + preloadCount + 1, topics.length);

    for (let i = startIdx; i < endIdx; i++) {
      const topic = topics[i];
      if (topic && !preloadedRef.current.has(topic.id)) {
        preloadedRef.current.add(topic.id);
        // Pass topic data with the request
        fetch(buildExpandUrl(topic)).catch(() => {});
      }
    }
  }, [state.topics, state.currentIndex, preloadCount, buildExpandUrl]);

  // Explore a concept (selected text)
  const exploreConcept = useCallback(async (concept: string) => {
    const normalizedConcept = concept.toLowerCase().trim();
    const currentTopic = state.topics[state.currentIndex];
    
    // Check cache first
    if (state.conceptCache[normalizedConcept]) {
      setState((prev) => ({
        ...prev,
        currentConcept: concept,
        conceptContent: prev.conceptCache[normalizedConcept],
        isExploringConcept: false,
      }));
      return;
    }
    
    setState((prev) => ({
      ...prev,
      currentConcept: concept,
      conceptContent: null,
      isExploringConcept: true,
    }));

    try {
      const response = await fetch("/api/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept,
          topicId: currentTopic?.id,
          topicContext: currentTopic?.content,
        }),
      });

      if (!response.ok) throw new Error("Failed to explore concept");
      
      const data = await response.json();
      
      setState((prev) => ({
        ...prev,
        conceptContent: data.content,
        isExploringConcept: false,
        conceptCache: {
          ...prev.conceptCache,
          [normalizedConcept]: data.content,
        },
      }));
    } catch (error) {
      console.error("Error exploring concept:", error);
      setState((prev) => ({
        ...prev,
        conceptContent: `Unable to research "${concept}" at this time. Please try again.`,
        isExploringConcept: false,
      }));
    }
  }, [state.topics, state.currentIndex, state.conceptCache]);

  // Clear concept exploration
  const clearConceptExploration = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentConcept: null,
      conceptContent: null,
      isExploringConcept: false,
    }));
  }, []);

  // Navigate between topics
  const navigate = useCallback((direction: SwipeDirection) => {
    // If exploring a concept, left arrow closes it
    if (state.currentConcept && direction === "left") {
      clearConceptExploration();
      return;
    }

    setState((prev) => {
      const { topics, currentIndex, depth } = prev;

      switch (direction) {
        case "down":
          // Next topic
          if (currentIndex < topics.length - 1) {
            return {
              ...prev,
              currentIndex: currentIndex + 1,
              depth: "summary",
              direction: "down",
              currentConcept: null,
              conceptContent: null,
            };
          }
          return prev;

        case "up":
          // Previous topic
          if (currentIndex > 0) {
            return {
              ...prev,
              currentIndex: currentIndex - 1,
              depth: "summary",
              direction: "up",
              currentConcept: null,
              conceptContent: null,
            };
          }
          return prev;

        case "right":
          // Expand / go deeper
          if (depth === "summary") {
            return { ...prev, depth: "expanded" };
          } else if (depth === "expanded") {
            return { ...prev, depth: "detail" };
          }
          return prev;

        case "left":
          // Collapse / go shallower
          if (depth === "detail") {
            return { ...prev, depth: "expanded" };
          } else if (depth === "expanded") {
            return { ...prev, depth: "summary" };
          }
          return prev;

        default:
          return prev;
      }
    });
  }, [state.currentConcept, clearConceptExploration]);

  // Expand topic content
  const expandTopic = useCallback(async (topicId: string) => {
    if (state.expandedContent[topicId]) return;

    // Find the topic to get its data
    const topic = state.topics.find((t) => t.id === topicId);
    if (!topic) return;

    try {
      const response = await fetch(buildExpandUrl(topic));
      if (!response.ok) throw new Error("Failed to expand topic");
      
      const data = await response.json();
      
      setState((prev) => ({
        ...prev,
        expandedContent: {
          ...prev.expandedContent,
          [topicId]: data.content,
        },
      }));
    } catch (error) {
      console.error("Error expanding topic:", error);
    }
  }, [state.expandedContent, state.topics, buildExpandUrl]);

  // Handle highlight click - now also explores the concept
  const handleHighlightClick = useCallback(async (highlight: TopicHighlight) => {
    // Explore the highlighted concept
    exploreConcept(highlight.text);
  }, [exploreConcept]);

  // Reset to summary view
  const resetDepth = useCallback(() => {
    setState((prev) => ({ ...prev, depth: "summary" }));
  }, []);

  // Initial load
  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  // Preload when current index changes
  useEffect(() => {
    if (state.topics.length > 0) {
      preloadTopics();
    }
  }, [state.currentIndex, state.topics.length, preloadTopics]);

  // Load more topics when approaching the end (infinite scroll)
  useEffect(() => {
    const { topics, currentIndex, hasMore, isLoadingMore } = state;
    // Load more when reaching 2nd to last topic
    if (topics.length > 0 && currentIndex >= topics.length - 2 && hasMore && !isLoadingMore) {
      console.log("Loading more topics...", { currentIndex, total: topics.length });
      loadMoreTopics();
    }
  }, [state.currentIndex, state.topics.length, state.hasMore, state.isLoadingMore, loadMoreTopics]);

  // Auto-expand when depth changes
  useEffect(() => {
    const currentTopic = state.topics[state.currentIndex];
    if (currentTopic && state.depth === "expanded") {
      expandTopic(currentTopic.id);
    }
  }, [state.depth, state.currentIndex, state.topics, expandTopic]);

  const currentTopic = state.topics[state.currentIndex];

  return {
    currentTopic,
    topics: state.topics,
    currentIndex: state.currentIndex,
    depth: state.depth,
    isLoading: state.isLoading,
    error: state.error,
    expandedContent: currentTopic ? state.expandedContent[currentTopic.id] : undefined,
    detailContent: currentTopic ? state.detailContent[currentTopic.id] : undefined,
    direction: state.direction,
    navigate,
    handleHighlightClick,
    resetDepth,
    refetch: fetchTopics,
    // Concept exploration
    exploreConcept,
    conceptContent: state.conceptContent,
    isExploringConcept: state.isExploringConcept,
    currentConcept: state.currentConcept,
    clearConceptExploration,
    // API mode
    mode: state.mode,
  };
}
