"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface UserPreferences {
  likedCategories: Record<string, number>;
  likedKeywords: Record<string, number>;
  totalLikes: number;
}

interface InterestsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const INTEREST_TAGS = [
  "AI & Machine Learning",
  "Space & Astronomy",
  "Science & Research",
  "Technology",
  "Finance & Economics",
  "Health & Wellness",
  "Philosophy",
  "Psychology",
  "History",
  "Politics",
  "Sports",
  "Entertainment",
  "Climate & Environment",
  "Art & Culture",
  "Food & Cooking",
  "Travel",
  "Business",
  "Startups",
];

export function InterestsPanel({ isOpen, onClose }: InterestsPanelProps) {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [customPrompt, setCustomPrompt] = useState("");
  const [location, setLocation] = useState<string | null>(null);

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("vibescroll_preferences");
      if (saved) {
        setPreferences(JSON.parse(saved));
      }
      
      const savedTags = localStorage.getItem("vibescroll_interest_tags");
      if (savedTags) {
        setSelectedTags(new Set(JSON.parse(savedTags)));
      }
      
      const savedPrompt = localStorage.getItem("vibescroll_custom_prompt");
      if (savedPrompt) {
        setCustomPrompt(savedPrompt);
      }
      
      const savedLocation = localStorage.getItem("vibescroll_location");
      if (savedLocation) {
        setLocation(savedLocation);
      }
    } catch (e) {
      console.error("Failed to load preferences:", e);
    }
  }, [isOpen]);

  // Get user's location
  const requestLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            // Reverse geocode to get city/region
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${position.coords.latitude}&longitude=${position.coords.longitude}&localityLanguage=en`
            );
            const data = await response.json();
            const locationStr = data.city || data.locality || data.principalSubdivision || "Unknown location";
            setLocation(locationStr);
            localStorage.setItem("vibescroll_location", locationStr);
          } catch {
            setLocation("Location detected");
            localStorage.setItem("vibescroll_location", "Location detected");
          }
        },
        () => {
          console.log("Location permission denied");
        }
      );
    }
  };

  // Toggle a tag
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      localStorage.setItem("vibescroll_interest_tags", JSON.stringify(Array.from(newSet)));
      return newSet;
    });
  };

  // Save custom prompt
  const savePrompt = () => {
    localStorage.setItem("vibescroll_custom_prompt", customPrompt);
  };

  // Get top categories from preferences
  const topCategories = preferences
    ? Object.entries(preferences.likedCategories)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
    : [];

  // Get top keywords from preferences
  const topKeywords = preferences
    ? Object.entries(preferences.likedKeywords)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
    : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed inset-0 bg-black z-40 overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-black/90 backdrop-blur-sm border-b border-neutral-800 px-6 py-4 flex items-center justify-between z-10">
            <h1 className="text-xl font-semibold">Your Interests</h1>
            <button
              onClick={onClose}
              className="text-neutral-500 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="px-6 py-8 max-w-2xl mx-auto space-y-8">
            {/* Location */}
            <section>
              <h2 className="text-sm text-neutral-500 uppercase tracking-wider mb-3">
                📍 Location
              </h2>
              {location ? (
                <div className="flex items-center gap-3">
                  <span className="text-white">{location}</span>
                  <button
                    onClick={() => {
                      setLocation(null);
                      localStorage.removeItem("vibescroll_location");
                    }}
                    className="text-xs text-neutral-600 hover:text-neutral-400"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <button
                  onClick={requestLocation}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm transition-colors"
                >
                  Enable location for local news
                </button>
              )}
            </section>

            {/* Interest Tags */}
            <section>
              <h2 className="text-sm text-neutral-500 uppercase tracking-wider mb-3">
                🏷️ Interest Tags
              </h2>
              <p className="text-xs text-neutral-600 mb-4">
                Select topics you want to see more of
              </p>
              <div className="flex flex-wrap gap-2">
                {INTEREST_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                      selectedTags.has(tag)
                        ? "bg-purple-600 text-white"
                        : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </section>

            {/* Custom Prompt */}
            <section>
              <h2 className="text-sm text-neutral-500 uppercase tracking-wider mb-3">
                ✏️ About You
              </h2>
              <p className="text-xs text-neutral-600 mb-4">
                Tell us about yourself so we can personalize your feed
              </p>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onBlur={savePrompt}
                placeholder="e.g., I'm a software engineer interested in AI, climate tech, and philosophy. I prefer in-depth analysis over quick headlines..."
                className="w-full h-32 bg-neutral-900 border border-neutral-800 rounded-lg p-4 text-white placeholder-neutral-600 focus:outline-none focus:border-purple-500 resize-none"
              />
            </section>

            {/* Learned Preferences */}
            {preferences && preferences.totalLikes > 0 && (
              <section>
                <h2 className="text-sm text-neutral-500 uppercase tracking-wider mb-3">
                  🧠 What We&apos;ve Learned
                </h2>
                <p className="text-xs text-neutral-600 mb-4">
                  Based on {preferences.totalLikes} topics you&apos;ve liked
                </p>

                {topCategories.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-neutral-500 mb-2">Top Categories:</p>
                    <div className="flex flex-wrap gap-2">
                      {topCategories.map(([category, count]) => (
                        <span
                          key={category}
                          className="px-3 py-1 bg-green-600/20 text-green-400 rounded-full text-xs"
                        >
                          {category} ({count})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {topKeywords.length > 0 && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-2">Top Keywords:</p>
                    <div className="flex flex-wrap gap-2">
                      {topKeywords.map(([keyword, count]) => (
                        <span
                          key={keyword}
                          className="px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs"
                        >
                          {keyword} ({count})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Clear Data */}
            <section className="pt-4 border-t border-neutral-800">
              <button
                onClick={() => {
                  if (confirm("Clear all preferences and start fresh?")) {
                    localStorage.removeItem("vibescroll_preferences");
                    localStorage.removeItem("vibescroll_likes");
                    localStorage.removeItem("vibescroll_interest_tags");
                    localStorage.removeItem("vibescroll_custom_prompt");
                    localStorage.removeItem("vibescroll_shown_urls");
                    setPreferences(null);
                    setSelectedTags(new Set());
                    setCustomPrompt("");
                  }
                }}
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                Reset all preferences
              </button>
            </section>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

