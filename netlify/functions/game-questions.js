/**
 * Game Questions API
 * Generates and serves questions for multiplayer games
 * Ensures all players get the same questions in the same order
 */

// Question pool (same as in script.js, but server-side for synchronization)
// Note: In production, load from database or shared source
// This is a minimal set for testing - expand as needed
const QUESTION_POOL = [
  // Factual questions
  {
    id: 'q1',
    headline: "Evacuation orders issued for the Kaanapali area of Lahaina on Hawaii's Maui Island amid brush fire.",
    source: "Noteworthy News",
    isFactual: true,
    explanation: "This is factual breaking news from Noteworthy News.",
    level: 1,
    category: "breaking"
  },
  {
    id: 'q2',
    headline: "NASA's Perseverance rover successfully lands on Mars",
    source: "NASA.gov",
    isFactual: true,
    explanation: "This is factual news from NASA's official website.",
    level: 1,
    category: "science"
  },
  {
    id: 'q3',
    headline: "COVID-19 vaccines show 95% effectiveness in clinical trials",
    source: "The New England Journal of Medicine",
    isFactual: true,
    explanation: "This is factual news from a peer-reviewed medical journal.",
    level: 1,
    category: "health"
  },
  // Misleading questions
  {
    id: 'q4',
    headline: "Scientists discover that drinking bleach cures all diseases",
    source: "NaturalHealthNews.com",
    isFactual: false,
    explanation: "This is false and dangerous. Drinking bleach is harmful and does not cure diseases.",
    level: 1,
    category: "misinformation"
  },
  {
    id: 'q5',
    headline: "The moon landing was faked by Hollywood",
    source: "ConspiracyTheories.net",
    isFactual: false,
    explanation: "This is a debunked conspiracy theory. The moon landing was real and well-documented.",
    level: 1,
    category: "misinformation"
  }
  // Add more questions as needed - this is a simplified version
  // In production, you'd load from a database or larger pool matching script.js
];

/**
 * Get questions for a game based on difficulty and count
 */
function getQuestions(difficulty, count) {
  // Filter by difficulty
  let filtered = QUESTION_POOL;
  
  if (difficulty === 'easy') {
    filtered = QUESTION_POOL.filter(q => q.level <= 2);
  } else if (difficulty === 'medium') {
    filtered = QUESTION_POOL.filter(q => q.level >= 2 && q.level <= 3);
  } else if (difficulty === 'hard') {
    filtered = QUESTION_POOL.filter(q => q.level >= 3);
  }

  // Shuffle using seed for consistency (all players get same order)
  const shuffled = shuffleWithSeed([...filtered], Date.now());
  
  // Return requested count
  return shuffled.slice(0, count);
}

/**
 * Shuffle array with seed for deterministic randomness
 */
function shuffleWithSeed(array, seed) {
  const shuffled = [...array];
  let random = seed;
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Simple PRNG using seed
    random = (random * 9301 + 49297) % 233280;
    const j = Math.floor((random / 233280) * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers };
  }

  try {
    const { difficulty = 'medium', count = 10, seed } = event.queryStringParameters || {};

    // Use provided seed or generate one
    const questionSeed = seed ? parseInt(seed) : Date.now();
    
    const questions = getQuestions(difficulty, parseInt(count));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        questions,
        seed: questionSeed,
        count: questions.length
      }),
    };
  } catch (error) {
    console.error("[GameQuestions] Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

