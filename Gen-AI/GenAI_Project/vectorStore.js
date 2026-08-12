let store = []; // [{ chunk: "...", embedding: [...] }]

function localEmbedding(text, dim = 64) {
  const vec = new Array(dim).fill(0);
  const words = (text || "").toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(j);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dim;
    vec[idx] += 1;
  }
  let sumSq = 0;
  for (let i = 0; i < dim; i++) sumSq += vec[i] * vec[i];
  const mag = Math.sqrt(sumSq) || 1;
  return vec.map(v => v / mag);
}

/**
 * Generate an embedding vector for a given text using Gemini API
 * @param {string} text 
 * @returns {Promise<number[]>}
 */
async function embed(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return localEmbedding(text);
  }

  const modelName = process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:embedContent?key=${apiKey}`;

  try {
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

    if (response.ok) {
      const data = await response.json();
      if (data?.embedding?.values) {
        return data.embedding.values;
      }
    }
  } catch (err) {
    console.warn(`[Embedding Notice] Cloud embedding unavailable (${err.message}). Using local embedding engine.`);
  }

  return localEmbedding(text);
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