# 🚀 Deployment Guide

This project is configured for one-click deployment across major cloud hosting providers.

---

## Option 1: Deploy on Render (Recommended - Free Tier)

1. Go to [dashboard.render.com](https://dashboard.render.com/) and click **New +** -> **Web Service**.
2. Connect your GitHub repository: `https://github.com/Nikhil93042/gen_ai-`.
3. Configure the service settings:
   - **Runtime**: `Node`
   - **Build Command**: `npm install && node Gen-AI/GenAI_Project/create_pdf.js`
   - **Start Command**: `npm start`
4. In **Environment Variables**, add:
   - `GEMINI_API_KEY`: *(Your Google Gemini API Key)*
   - `GEMINI_MODEL`: `gemini-2.5-flash`
   - `GEMINI_EMBEDDING_MODEL`: `text-embedding-004`
5. Click **Create Web Service**. Your live HTTPS URL will be ready in 1-2 minutes!

---

## Option 2: Deploy on Railway

1. Go to [railway.app](https://railway.app/) and click **New Project** -> **Deploy from GitHub repo**.
2. Select `Nikhil93042/gen_ai-`.
3. Railway will automatically detect the [`Dockerfile`](./Dockerfile) or [`package.json`](./package.json).
4. Go to **Variables** and add `GEMINI_API_KEY`.
5. Under **Settings** -> **Networking**, click **Generate Domain**.

---

## Option 3: Deploy on Vercel

1. Import repository on [vercel.com](https://vercel.com/new).
2. Set Environment Variable `GEMINI_API_KEY`.
3. Deploy! (Configured via [`vercel.json`](./vercel.json)).

---

## Option 4: Deploy with Docker

```bash
docker build -t genai-suite .
docker run -p 4000:4000 -e GEMINI_API_KEY="your_api_key_here" genai-suite
```
