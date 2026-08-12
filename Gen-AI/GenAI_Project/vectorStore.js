let store = []; // [{ chunk: "...", embedding: [...] }]

/**
 * Generate an embedding vector for a given text using Gemini API
 * @param {string} text 
 * @returns {Promise<number[]>}
 */
async function embed(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }

  // Model preference: text-embedding-004 (recommended standard) or gemini-embedding-2
  const modelName = process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:embedContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      content: {
        parts: [{ text: text }]
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    // If the chosen model is not found, try fallback to gemini-embedding-2 or text-embedding-004
    if (response.status === 404 && modelName !== "gemini-embedding-2") {
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`;
      const fallbackRes = await fetch(fallbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: { parts: [{ text: text }] } })
      });
      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        return fallbackData.embedding.values;
      }
    }
    throw new Error(`Gemini Embedding API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.embedding.values;
}

/**
 * Calculate cosine similarity between two numerical vectors
 * @param {number[]} a 
 * @param {number[]} b 
 * @returns {number}
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  if (magnitude === 0) return 0;

  return dot / magnitude;
}

/**
 * Index an array of text chunks into the in-memory vector store
 * @param {string[]} chunks 
 */
async function indexChunks(chunks) {
  store = [];
  for (const chunk of chunks) {
    if (!chunk || !chunk.trim()) continue;
    const embedding = await embed(chunk);
    store.push({ chunk, embedding });
  }
  return store.length;
}

/**
 * Search the vector store for chunks most similar to the query
 * @param {string} query 
 * @param {number} topK 
 * @returns {Promise<Array<{ chunk: string, score: number }>>}
 */
async function search(query, topK = 3) {
  if (store.length === 0) {
    return [];
  }

  const queryEmbedding = await embed(query);
  const scored = store.map(item => ({
    chunk: item.chunk,
    score: cosineSimilarity(queryEmbedding, item.embedding)
  }));

  scored.sort((a, b) => b.score - a.score); // Highest similarity first
  return scored.slice(0, topK);
}

/**
 * Get current store size / contents (useful for diagnostics)
 */
function getStoreSize() {
  return store.length;
}

module.exports = {
  embed,
  cosineSimilarity,
  indexChunks,
  search,
  getStoreSize
};