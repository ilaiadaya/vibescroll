import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Valyu } from "valyu-js";
import type { Topic, TopicCategory } from "@/types";

// Check if we have API keys
const hasValyuKey = !!process.env.VALYU_API_KEY;
const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

// Log API key status (without revealing the keys)
console.log("Topics API - Keys status:", {
  hasValyuKey,
  hasAnthropicKey,
  valuKeyLength: process.env.VALYU_API_KEY?.length || 0,
  anthropicKeyLength: process.env.ANTHROPIC_API_KEY?.length || 0,
});

// Initialize clients if keys exist
const anthropic = hasAnthropicKey
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const valyu = hasValyuKey
  ? new Valyu(process.env.VALYU_API_KEY!)
  : null;

interface ValyuResult {
  title: string;
  url: string;
  content: string | object | unknown[];
  source: string;
  relevance_score?: number;
  publication_date?: string;
}

// Fetch trending topics from Valyu using official SDK
async function fetchFromValyu(): Promise<ValyuResult[]> {
  if (!valyu) return [];

  const queries = [
    "breaking news today most important developments",
    "technology innovation breakthroughs latest",
    "science discoveries research findings recent",
    "financial markets economy news updates",
    "interesting trending topics viral today",
  ];

  const allResults: ValyuResult[] = [];

  try {
    const results = await Promise.all(
      queries.map(async (query) => {
        try {
          const response = await valyu.search(query, {
            maxNumResults: 3,
            maxPrice: 20,
            relevanceThreshold: 0.4,
          });
          console.log(`Valyu query "${query.slice(0, 30)}..." returned ${response.results?.length || 0} results`);
          return response.results || [];
        } catch (err) {
          console.error(`Valyu query error for "${query}":`, err);
          return [];
        }
      })
    );

    results.forEach((categoryResults) => {
      categoryResults.forEach((r) => {
        allResults.push({
          title: r.title,
          url: r.url,
          content: r.content,
          source: r.source,
          relevance_score: r.relevance_score,
          publication_date: r.publication_date,
        });
      });
    });
  } catch (error) {
    console.error("Valyu fetch error:", error);
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return allResults.filter((result) => {
    if (!result.url) return false;
    if (seen.has(result.url)) return false;
    seen.add(result.url);
    return true;
  });
}

// Process raw results with Claude
async function processWithClaude(results: ValyuResult[]): Promise<Topic[]> {
  if (!anthropic || results.length === 0) return [];

  const topics: Topic[] = [];

  for (const result of results.slice(0, 5)) {
    try {
      // Convert content to string if needed
      const contentStr = typeof result.content === 'string' 
        ? result.content 
        : JSON.stringify(result.content);
      
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Analyze this article and provide a JSON response:

Title: ${result.title}
Content: ${contentStr?.slice(0, 3000)}

Return ONLY valid JSON:
{
  "title": "compelling title, max 80 chars",
  "summary": "2-3 sentence summary, max 200 chars",
  "content": "main content rewritten clearly, max 600 chars",
  "category": "one of: news, tech, science, finance, culture, politics, health, sports, general",
  "highlights": [
    {"text": "exact interesting phrase from content that users would want to explore", "reason": "why interesting"}
  ]
}

Include 3-5 highlights - phrases that invite deeper exploration.`,
          },
        ],
      });

      const textContent = response.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") continue;

      let jsonStr = textContent.text;
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1];

      const parsed = JSON.parse(jsonStr.trim());

      const highlights = (parsed.highlights || []).map(
        (h: { text: string }, idx: number) => ({
          id: `${result.url}-h-${idx}`,
          text: h.text,
          startIndex: 0,
          endIndex: 0,
        })
      );

      topics.push({
        id: `topic-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: parsed.title,
        summary: parsed.summary,
        content: parsed.content,
        source: result.source || new URL(result.url).hostname,
        sourceUrl: result.url,
        timestamp: new Date(result.publication_date || Date.now()),
        category: parsed.category as TopicCategory,
        highlights,
      });
    } catch (error) {
      console.error("Error processing result:", error);
    }
  }

  return topics;
}

// Categories for AI-generated topics
const TOPIC_CATEGORIES = [
  "fascinating science facts",
  "weird history stories",
  "internet culture and memes",
  "psychology and human behavior",
  "technology conspiracies",
  "nature's strangest phenomena",
  "space and astronomy",
  "food science",
  "economics and money",
  "sports trivia",
  "art and creativity",
  "philosophy questions",
  "health myths debunked",
  "animal behavior",
  "music and sound",
];

// Generate fresh topics using Claude
async function generateTopicsWithClaude(count: number = 3): Promise<Topic[]> {
  if (!anthropic) return [];

  // Pick random categories
  const shuffled = TOPIC_CATEGORIES.sort(() => Math.random() - 0.5);
  const selectedCategories = shuffled.slice(0, count);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `Generate ${count} fascinating, scroll-worthy topics for a knowledge discovery app. Each topic should be surprising, educational, and make someone want to learn more.

Categories to cover: ${selectedCategories.join(", ")}

Return ONLY valid JSON array:
[
  {
    "title": "compelling clickable title, max 80 chars",
    "summary": "2-3 sentence hook, max 200 chars",
    "content": "the full interesting content, 400-600 chars, include surprising facts",
    "category": "one of: news, tech, science, finance, culture, politics, health, sports, general",
    "source": "believable source name",
    "highlights": [
      {"text": "interesting phrase to explore deeper", "reason": "why fascinating"}
    ]
  }
]

Make each topic genuinely interesting - the kind of thing people share with friends. Include 3-4 highlights per topic.`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") return [];

    let jsonStr = textContent.text;
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const parsed = JSON.parse(jsonStr);

    return parsed.map((t: { 
      title: string; 
      summary: string; 
      content: string; 
      category: string; 
      source: string;
      highlights: Array<{ text: string }>;
    }, idx: number) => ({
      id: `gen-${Date.now()}-${idx}-${Math.random().toString(36).slice(2)}`,
      title: t.title,
      summary: t.summary,
      content: t.content,
      source: t.source || "Vibescroll",
      sourceUrl: "https://vibescroll.app",
      timestamp: new Date(),
      category: t.category as TopicCategory,
      highlights: (t.highlights || []).map((h: { text: string }, i: number) => ({
        id: `gen-${Date.now()}-${idx}-h-${i}`,
        text: h.text,
        startIndex: 0,
        endIndex: 0,
      })),
    }));
  } catch (error) {
    console.error("Error generating topics with Claude:", error);
    return [];
  }
}

// Mock data for when APIs aren't available
function getMockTopics(): Topic[] {
  const seriousTopics: Topic[] = [
    {
      id: "topic-1",
      title: "Quantum Computing Achieves New Milestone in Error Correction",
      summary:
        "Researchers have demonstrated a quantum error correction system that could make practical quantum computers a reality within the decade.",
      content:
        "A team at Google Quantum AI has achieved a significant breakthrough in quantum error correction, demonstrating a system that reduces errors faster than it creates them. This milestone, known as 'below threshold' operation, has been a holy grail in quantum computing research. The breakthrough uses a technique called surface codes applied to a grid of 72 qubits, showing that adding more qubits actually improves reliability rather than introducing more noise.",
      source: "Nature",
      sourceUrl: "https://nature.com",
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      category: "tech",
      highlights: [
        { id: "h1-1", text: "quantum error correction", startIndex: 0, endIndex: 0 },
        { id: "h1-2", text: "surface codes applied to a grid of 72 qubits", startIndex: 0, endIndex: 0 },
        { id: "h1-3", text: "below threshold", startIndex: 0, endIndex: 0 },
      ],
    },
    {
      id: "topic-2",
      title: "New Study Links Gut Microbiome to Mental Health Outcomes",
      summary:
        "A comprehensive analysis reveals specific gut bacteria that correlate with depression and anxiety symptoms.",
      content:
        "Scientists from the Flemish Gut Flora Project have identified specific bacterial species that are consistently depleted in people with depression, regardless of antidepressant treatment. The study analyzed over 1,000 participants and found that bacteria producing butyrate, a compound that strengthens the gut barrier, were particularly important. This gut-brain axis research suggests that targeted probiotics or dietary interventions could complement traditional mental health treatments.",
      source: "Science Daily",
      sourceUrl: "https://sciencedaily.com",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      category: "health",
      highlights: [
        { id: "h2-1", text: "gut bacteria that correlate with depression", startIndex: 0, endIndex: 0 },
        { id: "h2-2", text: "butyrate", startIndex: 0, endIndex: 0 },
        { id: "h2-3", text: "gut-brain axis", startIndex: 0, endIndex: 0 },
      ],
    },
    {
      id: "topic-3",
      title: "Central Banks Signal Coordinated Shift in Monetary Policy",
      summary:
        "Federal Reserve and ECB hint at synchronized rate adjustments as inflation concerns evolve.",
      content:
        "In an unusual display of coordination, both the Federal Reserve and European Central Bank have signaled potential policy shifts. Fed Chair Jerome Powell emphasized a 'data-dependent approach' while ECB President Christine Lagarde pointed to 'encouraging disinflation trends.' Market analysts interpret this as preparation for divergent rate paths—with the ECB potentially cutting sooner while the Fed maintains its cautious stance.",
      source: "Bloomberg",
      sourceUrl: "https://bloomberg.com",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
      category: "finance",
      highlights: [
        { id: "h3-1", text: "data-dependent approach", startIndex: 0, endIndex: 0 },
        { id: "h3-2", text: "disinflation trends", startIndex: 0, endIndex: 0 },
        { id: "h3-3", text: "divergent rate paths", startIndex: 0, endIndex: 0 },
      ],
    },
    {
      id: "topic-4",
      title: "AI-Designed Proteins Could Revolutionize Medicine",
      summary:
        "DeepMind's AlphaFold successor creates novel proteins for targeted drug delivery.",
      content:
        "Building on AlphaFold, DeepMind has unveiled AlphaProteo, a system capable of designing entirely new proteins that don't exist in nature. The tool has already created proteins that can bind to specific disease targets with unprecedented precision. Early applications include proteins that can deliver drugs directly to cancer cells while avoiding healthy tissue, and enzymes that break down environmental pollutants.",
      source: "MIT Technology Review",
      sourceUrl: "https://technologyreview.com",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6),
      category: "science",
      highlights: [
        { id: "h4-1", text: "AlphaProteo", startIndex: 0, endIndex: 0 },
        { id: "h4-2", text: "proteins that don't exist in nature", startIndex: 0, endIndex: 0 },
        { id: "h4-3", text: "deliver drugs directly to cancer cells", startIndex: 0, endIndex: 0 },
      ],
    },
    {
      id: "topic-5",
      title: "The Rise of 'Third Places' in Remote Work Era",
      summary:
        "As hybrid work persists, people flock to libraries, cafes, and co-working spaces for social connection.",
      content:
        "Sociologist Ray Oldenburg's concept of 'third places'—social environments separate from home and work—is experiencing a renaissance. Libraries report 40% increases in weekday visitors, while a new wave of 'work cafes' designed for laptop workers is spreading across major cities. The trend reflects a fundamental shift in how people balance productivity and community.",
      source: "The Atlantic",
      sourceUrl: "https://theatlantic.com",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8),
      category: "culture",
      highlights: [
        { id: "h5-1", text: "third places", startIndex: 0, endIndex: 0 },
        { id: "h5-2", text: "40% increases in weekday visitors", startIndex: 0, endIndex: 0 },
        { id: "h5-3", text: "balance productivity and community", startIndex: 0, endIndex: 0 },
      ],
    },
  ];

  // Shuffle and return
  return seriousTopics.sort(() => Math.random() - 0.5);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const count = parseInt(searchParams.get("count") || "3", 10);
  
  let topics: Topic[] = [];
  let mode: "live" | "demo" = "demo";

  if (hasValyuKey && hasAnthropicKey) {
    mode = "live";
    
    // Try to get news from Valyu first
    console.log("Attempting to fetch from Valyu...");
    const results = await fetchFromValyu();
    console.log(`Valyu returned ${results.length} results`);
    
    if (results.length > 0) {
      console.log("Processing news with Claude...");
      const newsTopics = await processWithClaude(results);
      topics.push(...newsTopics);
    }

    // Generate additional AI topics to fill the count
    const neededCount = Math.max(0, count - topics.length);
    if (neededCount > 0 || topics.length === 0) {
      console.log(`Generating ${neededCount || count} AI topics...`);
      const aiTopics = await generateTopicsWithClaude(neededCount || count);
      topics.push(...aiTopics);
    }
    
    // Shuffle to mix news and AI-generated topics
    topics = topics.sort(() => Math.random() - 0.5);

    // Fallback to mock if still empty
    if (topics.length === 0) {
      console.log("No topics from APIs, falling back to mock");
      topics = getMockTopics();
      mode = "demo";
    }
  } else {
    // Use mock data
    console.log("No API keys detected, using mock data");
    await new Promise((resolve) => setTimeout(resolve, 300));
    topics = getMockTopics();
    topics = topics.sort(() => Math.random() - 0.5);
  }

  // Return requested count
  const returnedTopics = topics.slice(0, count);
  
  return NextResponse.json({ 
    topics: returnedTopics, 
    mode, 
    hasMore: true
  });
}
