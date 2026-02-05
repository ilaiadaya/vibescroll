export interface TopicHighlight {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
  preloadedExpansion?: string;
}

export interface Topic {
  id: string;
  title: string;
  summary: string;
  content: string;
  source: string;
  sourceUrl: string;
  timestamp: Date;
  category: TopicCategory;
  highlights: TopicHighlight[];
  expansion?: TopicExpansion;
}

export interface TopicExpansion {
  fullContent: string;
  additionalContext: string;
  relatedTopics: string[];
}

export type TopicCategory = 
  | "news"
  | "tech"
  | "science"
  | "finance"
  | "culture"
  | "politics"
  | "health"
  | "sports"
  | "general";

export type SwipeDirection = "up" | "down" | "left" | "right";

export type ViewDepth = "summary" | "expanded" | "detail";

export interface ViewState {
  currentTopicIndex: number;
  depth: ViewDepth;
  activeHighlightId: string | null;
}

export interface TopicFeedState {
  topics: Topic[];
  currentIndex: number;
  isLoading: boolean;
  error: string | null;
  preloadedCount: number;
}

export interface UserQuestion {
  topicId: string;
  question: string;
  answer?: string;
  isLoading: boolean;
}

