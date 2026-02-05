import type { Topic, TopicCategory } from "@/types";

interface ValyuSearchResult {
  title: string;
  url: string;
  content: string;
  source: string;
  relevance_score: number;
  publication_date?: string;
}

interface ValyuSearchResponse {
  success: boolean;
  error: string;
  query: string;
  results: ValyuSearchResult[];
}

const VALYU_API_URL = "https://api.valyu.ai/v1/search";

export async function searchTopics(
  query: string,
  maxResults: number = 10
): Promise<ValyuSearchResult[]> {
  const apiKey = process.env.VALYU_API_KEY;
  
  if (!apiKey) {
    throw new Error("VALYU_API_KEY is not configured");
  }

  const response = await fetch(VALYU_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      maxNumResults: maxResults,
      maxPrice: 20,
      relevanceThreshold: 0.4,
    }),
  });

  if (!response.ok) {
    throw new Error(`Valyu API error: ${response.status}`);
  }

  const data: ValyuSearchResponse = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || "Search failed");
  }

  return data.results;
}

export async function getTrendingTopics(
  categories: TopicCategory[] = ["news", "tech", "science", "finance", "general"]
): Promise<ValyuSearchResult[]> {
  const queries = [
    "latest breaking news today most important",
    "trending technology news innovations",
    "scientific discoveries breakthroughs recent",
    "financial markets economy updates today",
    "interesting viral trending topics today",
  ];

  const allResults: ValyuSearchResult[] = [];

  // Fetch from multiple queries in parallel
  const results = await Promise.all(
    queries.slice(0, categories.length).map((query) => 
      searchTopics(query, 3).catch(() => [])
    )
  );

  results.forEach((categoryResults) => {
    allResults.push(...categoryResults);
  });

  // Deduplicate by URL
  const seen = new Set<string>();
  return allResults.filter((result) => {
    if (seen.has(result.url)) return false;
    seen.add(result.url);
    return true;
  });
}

export async function expandTopic(
  topicContent: string,
  query: string
): Promise<ValyuSearchResult[]> {
  return searchTopics(`${query} more details context background`, 5);
}

