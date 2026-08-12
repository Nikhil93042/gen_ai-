require('dotenv').config();

const chat = async () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("[Notice] GEMINI_API_KEY is not set. Skipping live chat demonstration.");
    return;
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Suggest 3 beginner course topics for a Node.js curriculum."
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini Error:", data);
      return;
    }

    console.log("Chatbot Output:\n", data.candidates[0].content.parts[0].text);
  } catch (err) {
    console.error("Chat error:", err.message);
  }
};

// GenAIProject - Mini PDF Question answering chatbot
/*
Documents (Extract data from file)
|
Splitting into chunks
|
Generate Embeddings
|
Store Embeddings
|
User asks a question
|
Generate a query embedding
|
Compare with stored embeddings
|
Return most similar chunks
*/

// Splitting into Chunks
function chunkText(text, chunkSize = 500, overlap = 50) {
  const words = text.split(/\s+/);
  const chunks = [];

  for (let i = 0; i < words.length; i += (chunkSize - overlap)) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    chunks.push(chunk);
  }
  return chunks;
}

// Generate embeddings
let store = []; // [{ chunk: "...", embedding: [...] }]

async function generateEmbedding(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;

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
    throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.embedding.values;
}

// User asks query & comparison with stored embeddings
const cosineSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let magA = 0, magB = 0, dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const mag = Math.sqrt(magA) * Math.sqrt(magB);
  return mag === 0 ? 0 : dot / mag;
};

// Chunks-embedding map
const indexChunks = async (chunks) => {
  store = [];
  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk);
    store.push({ chunk, embedding });
  }
};

// Search - return similar chunks
const search = async (query, topK = 3) => {
  const userQueryEmbedding = await generateEmbedding(query);
  const scores = store.map(item => ({
    chunk: item.chunk,
    score: cosineSimilarity(userQueryEmbedding, item.embedding)
  }));
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topK);
};

// Run chat demo if executed directly
if (require.main === module) {
  chat();
}

module.exports = {
  chunkText,
  generateEmbedding,
  cosineSimilarity,
  indexChunks,
  search
};
