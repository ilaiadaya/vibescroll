#!/usr/bin/env node

/**
 * Vibescroll Test Runner
 * 
 * This script runs all registered tests for the Vibescroll application.
 * Add new test files to the testFiles array below.
 * 
 * Usage: node tests/run-tests.js
 * Or: npm test
 */

const { execSync } = require("child_process");
const path = require("path");

// Register test files here
const testFiles = [
  "navigation.test.ts",    // Navigation logic tests (arrow keys, depth transitions)
  "api.test.ts",           // API response structure and preloading tests
  "interests-panel.test.ts", // User preferences and interests localStorage tests
];

console.log("🧪 Vibescroll Test Runner");
console.log("========================\n");

console.log("Registered tests:");
testFiles.forEach((file, index) => {
  console.log(`  ${index + 1}. ${file}`);
});
console.log("");

try {
  // Run vitest with the registered test files
  const testPaths = testFiles.map((f) => path.join("tests", f)).join(" ");
  execSync(`npx vitest run ${testPaths}`, {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
  });
  
  console.log("\n✅ All tests passed!");
} catch (error) {
  console.error("\n❌ Some tests failed");
  process.exit(1);
}

