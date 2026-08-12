// RAG Endpoint with 3-Layer Prompt Injection Defense & Web Application Server
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

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 4000;
const DEFAULT_PDF_PATH = path.join(__dirname, 'course-syllabus.pdf');

// Mock in-memory courses for CourseHub module
let courses = [
  {
    _id: "c1",
    title: "Full Stack Node.js & Express Engineering",
    instructor: "Phaham",
    price: 199,
    description: "Master event-driven architecture, REST APIs, middleware pipelines, and scalable backend design."
  },
  {
    _id: "c2",
    title: "Generative AI & LLM Systems",
    instructor: "Phaham",
    price: 299,
    description: "Deep dive into Vector Embeddings, Cosine Similarity, RAG pipelines, and Prompt Injection Defense."
  },
  {
    _id: "c3",
    title: "Database Architectures with MongoDB & Mongoose",
    instructor: "Dr. Elena Vance",
    price: 149,
    description: "Design robust schemas, indexing strategies, aggregation pipelines, and secure JWT authentication."
  },
  {
    _id: "c4",
    title: "Advanced Data Structures & Algorithms",
    instructor: "Alex Rivera",
    price: 179,
    description: "From graph algorithms to dynamic programming with practical real-world problem breakdowns."
  }
];

// Helper to formulate answer from context if external API is unreachable
function generateGroundedFallback(context, query) {
  if (!context || !context.trim()) {
    return "I couldn't find relevant information in the uploaded course syllabus.";
  }
  const sentences = context.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 0);
  const qLower = query.toLowerCase();
  const qWords = qLower.split(/\s+/).filter(w => w.length > 2);
  
  const matches = sentences.filter(s => {
    const sLower = s.toLowerCase();
    return qWords.some(w => sLower.includes(w));
  });

  if (matches.length > 0) {
    return matches.slice(0, 4).join(' ');
  }
  return context.slice(0, 350) + "...";
}

// Health and Diagnostics Endpoint
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    service: 'PDF RAG Chatbot & Learning Platform',
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

// Inspect indexed chunks
app.get('/api/chunks', async (req, res) => {
  try {
    if (getStoreSize() === 0 && fs.existsSync(DEFAULT_PDF_PATH)) {
      const text = await extractText(DEFAULT_PDF_PATH);
      const chunks = chunkText(text, 500, 50);
      await indexChunks(chunks);
    }
    const { getStoreSize } = require('./vectorStore');
    res.json({
      count: getStoreSize(),
      pdf: 'course-syllabus.pdf'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CourseHub API Endpoints
app.get('/api/courses', (req, res) => {
  res.json(courses);
});

app.get('/api/courses/:id', (req, res) => {
  const course = courses.find(c => c._id === req.params.id);
  if (!course) return res.status(404).json({ error: "Course not found" });
  res.json(course);
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const isInstructor = email.toLowerCase().includes('instructor') || email.toLowerCase().includes('phaham') || email.toLowerCase().includes('admin');
  const role = isInstructor ? 'instructor' : 'student';
  const name = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  res.json({
    token: `jwt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    user: {
      id: `usr_${Date.now()}`,
      name: name || "Student User",
      email: email,
      role: role
    }
  });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password are required" });
  }
  res.json({
    token: `jwt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    user: {
      id: `usr_${Date.now()}`,
      name: name,
      email: email,
      role: role || 'student'
    }
  });
});

app.post('/api/courses', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
  }
  const { title, price, description, instructor } = req.body || {};
  if (!title || price === undefined) {
    return res.status(400).json({ error: "Title and price are required" });
  }

  const newCourse = {
    _id: `c${courses.length + 1}`,
    title,
    instructor: instructor || "Phaham",
    price: Number(price),
    description: description || "No description provided."
  };
  courses.push(newCourse);
  res.status(201).json(newCourse);
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
    let rawAnswer = "";

    if (apiKey && !apiKey.includes('your_gemini_api_key')) {
      const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
              temperature: 0.2
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          rawAnswer = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        }
      } catch (cloudErr) {
        console.warn(`[Cloud Generation Note]: ${cloudErr.message}. Utilizing grounded context fallback.`);
      }
    }

    if (!rawAnswer) {
      rawAnswer = generateGroundedFallback(context, clean);
    }

    // LAYER 3: Output Validation (Intercept system prompt leakage or injection compliance)
    const { safe, response: finalAnswer } = validateResponse(rawAnswer);

    if (!safe) {
      console.warn("[Security Alert - Layer 3 Intercepted Unsafe Response]");
      return res.status(200).json({
        answer: "I couldn't safely answer that question.",
        sources: [],
        security: {
          queryFlagged: flagged,
          layer3Blocked: true
        }
      });
    }

    res.json({
      answer: finalAnswer,
      sources: topChunks.map(c => c.chunk.slice(0, 120) + '...'),
      security: {
        queryFlagged: flagged,
        flagReason: reason || null,
        layer3Blocked: false
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
    console.log(` 🚀 Application live at: http://localhost:${PORT}`);
    console.log(` 🛡️  3-Layer Prompt Injection Defense: ACTIVE`);
    console.log(` 📚 CourseHub & RAG Assistant Ready`);
    console.log(`===================================================`);
  });
}

module.exports = { app, serverInstance };