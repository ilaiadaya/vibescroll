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

// Fetch from NewsAPI (free tier - 100 requests/day)
async function fetchFromNewsAPI(): Promise<ValyuResult[]> {
  const newsApiKey = process.env.NEWS_API_KEY;
  if (!newsApiKey) {
    console.log("No NEWS_API_KEY, skipping NewsAPI");
    return [];
  }

  try {
    const response = await fetch(
      `https://newsapi.org/v2/top-headlines?country=us&pageSize=10&apiKey=${newsApiKey}`
    );
    const data = await response.json();
    
    if (data.status !== "ok" || !data.articles) {
      console.error("NewsAPI error:", data);
      return [];
    }

    console.log(`NewsAPI returned ${data.articles.length} articles`);
    
    return data.articles
      .filter((a: { title: string; description: string }) => a.title && a.description)
      .map((a: { title: string; url: string; description: string; content: string; source: { name: string }; publishedAt: string }) => ({
        title: a.title,
        url: a.url,
        content: a.description + (a.content ? " " + a.content : ""),
        source: a.source?.name || "News",
        publication_date: a.publishedAt,
      }));
  } catch (error) {
    console.error("NewsAPI fetch error:", error);
    return [];
  }
}

// Content categories with high-content sources
const CONTENT_CATEGORIES = [
  // High volume - lots of content
  { category: "science", queries: ["latest scientific research papers", "science breakthrough discovery today", "new study published findings"] },
  { category: "tech", queries: ["technology news today", "AI artificial intelligence latest", "startup funding news tech"] },
  { category: "finance", queries: ["stock market news today", "cryptocurrency bitcoin ethereum news", "economic policy federal reserve"] },
  { category: "politics", queries: ["political news today", "government policy announcement", "election news update"] },
  // Medium volume
  { category: "health", queries: ["health medical news today", "new treatment drug FDA", "mental health wellness research"] },
  { category: "sports", queries: ["sports news today scores", "NBA NFL MLB latest", "athlete transfer trade news"] },
  { category: "entertainment", queries: ["entertainment celebrity news", "movie film release news", "music artist album release"] },
  { category: "business", queries: ["business news companies", "corporate earnings report", "merger acquisition deal"] },
  // Lower volume but interesting
  { category: "space", queries: ["space NASA astronomy news", "rocket launch satellite", "mars moon exploration"] },
  { category: "environment", queries: ["climate change environment news", "renewable energy solar wind", "wildlife conservation nature"] },
  { category: "culture", queries: ["viral trending social media", "internet culture memes", "lifestyle trend society"] },
];

// Fetch trending topics from Valyu using official SDK
async function fetchFromValyu(excludeUrls: string[] = []): Promise<{ results: ValyuResult[], categoryStats: Record<string, number> }> {
  if (!valyu) return { results: [], categoryStats: {} };

  const allResults: ValyuResult[] = [];
  const categoryStats: Record<string, number> = {};
  const excludeSet = new Set(excludeUrls);

  // Pick 3-4 random categories to query this time
  const shuffledCategories = [...CONTENT_CATEGORIES].sort(() => Math.random() - 0.5);
  const selectedCategories = shuffledCategories.slice(0, 4);

  // Time-based modifier for freshness
  const timeModifiers = ["last hour", "today", "this morning", "breaking"];
  const timeModifier = timeModifiers[Math.floor(Math.random() * timeModifiers.length)];

  try {
    const categoryPromises = selectedCategories.map(async ({ category, queries }) => {
      // Pick a random query from this category and add time modifier
      const baseQuery = queries[Math.floor(Math.random() * queries.length)];
      const query = `${baseQuery} ${timeModifier}`;
      
      try {
        const response = await valyu.search(query, {
          maxNumResults: 5,
          maxPrice: 30,
          relevanceThreshold: 0.3,
        });
        
        const count = response.results?.length || 0;
        categoryStats[category] = count;
        console.log(`Valyu [${category}] "${query.slice(0, 40)}..." → ${count} results`);
        
        return { category, results: response.results || [] };
      } catch (err) {
        console.error(`Valyu query error for "${category}":`, err);
        categoryStats[category] = 0;
        return { category, results: [] };
      }
    });

    const categoryResults = await Promise.all(categoryPromises);

    categoryResults.forEach(({ results }) => {
      results.forEach((r) => {
        // Skip if we've seen this URL before
        if (excludeSet.has(r.url)) return;
        
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
  const dedupedResults = allResults.filter((result) => {
    if (!result.url) return false;
    if (seen.has(result.url)) return false;
    seen.add(result.url);
    return true;
  });

  return { results: dedupedResults, categoryStats };
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

// Generate AI thoughts/facts/jokes - clearly labeled as AI-generated
async function generateAIThoughts(count: number = 2): Promise<Topic[]> {
  if (!anthropic) return [];

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: `You are creating content for a knowledge discovery app. Generate ${count} pieces of content. 

YOU DECIDE what type each one should be. Mix it up! Options include:
- A fascinating fact about nature, science, or the universe
- A thought-provoking philosophical question or insight  
- A clever joke or witty observation
- An interesting "did you know" about history, culture, or technology
- A mindfulness/presence reminder
- A weird but true fact
- A creative "what if" scenario

Be creative and varied. Make each one genuinely interesting and shareable.

Return ONLY valid JSON array:
[
  {
    "type": "fact" | "philosophy" | "joke" | "did_you_know" | "mindfulness" | "weird_fact" | "what_if",
    "title": "engaging title, max 60 chars",
    "content": "the full content, 100-300 chars, make it memorable",
    "highlights": [{"text": "interesting phrase to explore"}]
  }
]`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") return [];

    let jsonStr = textContent.text;
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const parsed = JSON.parse(jsonStr);

    const typeLabels: Record<string, string> = {
      fact: "🧠 AI Fact",
      philosophy: "💭 AI Thought",
      joke: "😄 AI Joke",
      did_you_know: "💡 Did You Know",
      mindfulness: "🧘 Moment",
      weird_fact: "🤯 Weird but True",
      what_if: "🔮 What If",
    };

    return parsed.map((t: { 
      type: string;
      title: string; 
      content: string; 
      highlights: Array<{ text: string }>;
    }, idx: number) => ({
      id: `ai-${Date.now()}-${idx}-${Math.random().toString(36).slice(2)}`,
      title: t.title,
      summary: t.content.slice(0, 150),
      content: t.content,
      source: typeLabels[t.type] || "🤖 AI Generated",
      sourceUrl: "",
      timestamp: new Date(),
      category: "general" as TopicCategory,
      highlights: (t.highlights || []).map((h: { text: string }, i: number) => ({
        id: `ai-${Date.now()}-${idx}-h-${i}`,
        text: h.text,
        startIndex: 0,
        endIndex: 0,
      })),
    }));
  } catch (error) {
    console.error("Error generating AI thoughts:", error);
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
  const count = parseInt(searchParams.get("count") || "5", 10);
  const fresh = searchParams.get("fresh") === "true"; // Get freshest content
  const preferCategoriesParam = searchParams.get("preferCategories") || "";
  const preferCategories = preferCategoriesParam ? preferCategoriesParam.split(",") : [];
  // URLs to exclude (passed from frontend to avoid repeats)
  const excludeUrlsParam = searchParams.get("excludeUrls") || "";
  const excludeUrls = excludeUrlsParam ? excludeUrlsParam.split(",") : [];
  
  console.log("Topics API request:", { count, fresh, preferCategories: preferCategories.length, excludeUrls: excludeUrls.length });
  
  let realTopics: Topic[] = [];
  let aiTopics: Topic[] = [];
  let mode: "live" | "demo" = "demo";
  let allResults: ValyuResult[] = [];
  let categoryStats: Record<string, number> = {};

  // Step 1: Try Valyu for real content (with category rotation)
  if (hasValyuKey) {
    console.log("Fetching real content from Valyu...");
    const valyuData = await fetchFromValyu(excludeUrls);
    console.log(`Valyu returned ${valyuData.results.length} results`);
    allResults.push(...valyuData.results);
    categoryStats = valyuData.categoryStats;
  }

  // Step 2: Try NewsAPI as backup/supplement
  const newsResults = await fetchFromNewsAPI();
  if (newsResults.length > 0) {
    console.log(`NewsAPI returned ${newsResults.length} articles`);
    allResults.push(...newsResults);
  }

  // Deduplicate by title similarity
  const seen = new Set<string>();
  allResults = allResults.filter((r) => {
    const key = r.title.toLowerCase().slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Step 3: Process real content with Claude (just formatting, not inventing)
  if (allResults.length > 0 && hasAnthropicKey) {
    mode = "live";
    console.log(`Processing ${allResults.length} real articles with Claude...`);
    
    // Shuffle and take what we need for real news
    const shuffled = allResults.sort(() => Math.random() - 0.5);
    const toProcess = shuffled.slice(0, count); 
    
    realTopics = await processWithClaude(toProcess);
    console.log(`Successfully processed ${realTopics.length} real topics`);
  }

  // Step 4: Generate 1-2 AI thoughts to mix in (clearly labeled)
  // Only generate AI content if we have real content (so it's a mix, not all AI)
  if (hasAnthropicKey && realTopics.length > 0) {
    try {
      const aiCount = Math.random() > 0.6 ? 2 : 1; // Usually 1, sometimes 2
      console.log(`Generating ${aiCount} AI thought(s)...`);
      aiTopics = await generateAIThoughts(aiCount);
      console.log(`Generated ${aiTopics.length} AI thought(s):`, aiTopics.map(t => t.source));
    } catch (err) {
      console.error("Failed to generate AI thoughts:", err);
      // Continue without AI thoughts
    }
  }

  // Step 5: Fall back to mock data only if we have no real content
  if (realTopics.length === 0 && aiTopics.length === 0) {
    console.log("No content available, using demo data");
    await new Promise((resolve) => setTimeout(resolve, 300));
    realTopics = getMockTopics();
    mode = "demo";
  }

  // Step 6: Mix real news with AI thoughts
  // Strategy: Real news comes first (sorted by timestamp), AI thoughts sprinkled in
  const sortedReal = realTopics.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  // Insert AI thoughts at random positions (but not first)
  const mixed: Topic[] = [...sortedReal];
  aiTopics.forEach((aiTopic) => {
    // Insert AI thought at random position (2nd position or later)
    const insertAt = Math.min(
      1 + Math.floor(Math.random() * Math.max(1, mixed.length - 1)),
      mixed.length
    );
    mixed.splice(insertAt, 0, aiTopic);
  });

  const returnedTopics = mixed.slice(0, count);
  
  // Return URLs for frontend to track and exclude next time
  const returnedUrls = returnedTopics.map(t => t.sourceUrl).filter(Boolean);
  
  return NextResponse.json({ 
    topics: returnedTopics, 
    mode,
    source: allResults.length > 0 ? "mixed" : "demo",
    realCount: realTopics.length,
    aiCount: aiTopics.length,
    categoryStats, // Send back so frontend can track high-content categories
    returnedUrls,  // URLs to exclude next time
    hasMore: true
  });
}
