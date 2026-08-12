// RAG Endpoint with 3-Layer Prompt Injection Defense
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const extractText = require('./extractText');
const chunkText = require('./chunkText');
const { indexChunks, search, getStoreSize } = require('./vectorStore');
const { sanitizeQuery, buildSecurePrompt, validateResponse } = require('./sanitizeQuery');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const DEFAULT_PDF_PATH = path.join(__dirname, 'course-syllabus.pdf');

// Health and Diagnostics Endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    service: 'PDF RAG Chatbot with Prompt Injection Defense',
    indexedChunks: getStoreSize(),
    pdfAvailable: fs.existsSync(DEFAULT_PDF_PATH),
    securityFeatures: {
      layer1_querySanitization: 'active',
      layer2_contextIsolation: 'active',
      layer3_outputValidation: 'active'
    }
  });
});

// PDF Indexing Endpoint (run once per document or updates)
app.post('/api/index', async (req, res) => {
  try {
    const targetPdf = req.body && req.body.filePath 
      ? path.resolve(req.body.filePath) 
      : DEFAULT_PDF_PATH;

    if (!fs.existsSync(targetPdf)) {
      return res.status(404).json({
        error: `PDF file not found at: ${targetPdf}. Please ensure 'course-syllabus.pdf' exists in the project directory.`
      });
    }

    console.log(`[Indexing] Extracting text from: ${targetPdf}`);
    const text = await extractText(targetPdf);

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Extracted PDF text is empty." });
    }

    const chunks = chunkText(text, 500, 50);
    console.log(`[Indexing] Generated ${chunks.length} chunks. Generating embeddings...`);
    
    const count = await indexChunks(chunks);
    console.log(`[Indexing] Successfully indexed ${count} chunks in memory.`);

    res.json({
      message: `Indexed ${count} chunks successfully`,
      chunkCount: count
    });
  } catch (err) {
    console.error("[Indexing Error]:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// The RAG Query Endpoint with 3-Layer Security Mechanism
app.post('/api/ask', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: "Missing or invalid 'question' field in request body." });
    }

    // LAYER 1: Query Sanitization & Injection Pattern Detection
    const { clean, flagged, reason } = sanitizeQuery(question);

    if (flagged) {
      console.warn(`[Security Alert - Layer 1 Flagged Query]: "${question}"`);
      if (reason) {
        console.warn(`[Security Reason]: ${reason}`);
      }
    }

    // Auto-index if not yet indexed and PDF exists
    if (getStoreSize() === 0) {
      if (fs.existsSync(DEFAULT_PDF_PATH)) {
        console.log("[Auto-Indexing] Vector store empty. Auto-indexing default PDF...");
        const text = await extractText(DEFAULT_PDF_PATH);
        const chunks = chunkText(text, 500, 50);
        await indexChunks(chunks);
      } else {
        return res.status(400).json({
          error: "No documents have been indexed yet. Please call POST /api/index first."
        });
      }
    }

    // Vector Similarity Search (Retrieve top-3 most relevant chunks)
    const topChunks = await search(clean, 3);
    const context = topChunks.map(c => c.chunk).join('\n\n---\n\n');

    // LAYER 2: Context Isolation & System Instructions Prompt Construction
    const { systemPrompt, userMessage } = buildSecurePrompt(context, clean);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured in .env. Please configure your API key."
      });
    }

    // Model selection: gemini-3.6-flash (or gemini-1.5-flash / gemini-2.0-flash fallback)
    const modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [{
          role: "user",
          parts: [{ text: userMessage }]
        }],
        generationConfig: {
          maxOutputTokens: 500,
          temperature: 0.2 // Lower temperature for strict grounding
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // Extract generated text from Gemini API response
    const rawAnswer = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";

    // LAYER 3: Output Validation (Intercept system prompt leakage or injection compliance)
    const { safe, response: finalAnswer } = validateResponse(rawAnswer);

    if (!safe) {
      console.warn("[Security Alert - Layer 3 Intercepted Unsafe Response]");
      return res.status(200).json({
        answer: "I couldn't safely answer that question.",
        sources: []
      });
    }

    res.json({
      answer: finalAnswer,
      sources: topChunks.map(c => c.chunk.slice(0, 100) + '...'),
      security: {
        queryFlagged: flagged
      }
    });
  } catch (err) {
    console.error("[Error in /api/ask]:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Start Express server if run directly
let serverInstance = null;
if (require.main === module) {
  serverInstance = app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(` PDF RAG Chatbot running on http://localhost:${PORT}`);
    console.log(` Prompt Injection Defense: Active (Layers 1, 2, 3)`);
    console.log(`===================================================`);
  });
}

module.exports = { app, serverInstance };