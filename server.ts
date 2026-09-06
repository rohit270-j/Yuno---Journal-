import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON middleware with defensive parsing
  app.use(express.json());

  app.post("/api/gemini", async (req, res) => {
    try {
      const data = (req.body && typeof req.body === 'object') ? req.body : {};
      const { prompt, history } = data;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("GEMINI_API_KEY is not set.");
        return res.status(500).json({ error: "API configuration missing." });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const contents = [];
      if (Array.isArray(history)) {
        for (const msg of history) {
          contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] });
        }
      }
      contents.push({ role: 'user', parts: [{ text: prompt }] });

      // Fallback model ladder
      const models = ["gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
      let resultText = "";
      let success = false;
      let lastError = null;

      for (const model of models) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents,
          });
          resultText = response.text || "";
          success = true;
          break; // Break on success
        } catch (error: any) {
          console.warn(`Model ${model} failed:`, error.message);
          lastError = error;
          // Continue to next model
        }
      }

      if (!success) {
        throw lastError || new Error("All models failed.");
      }

      res.json({ response: resultText });
    } catch (error: any) {
      console.error("Gemini API error:", error);
      res.status(500).json({ error: "Failed to generate response." });
    }
  });

  // Resilient model fallback helper
  async function generateContentWithFallback(ai: GoogleGenAI, contents: any[], systemInstruction?: string) {
    const models = ["gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.7-flash"];
    let lastError = null;

    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: systemInstruction ? { systemInstruction } : undefined,
        });
        if (response.text) {
          return response.text;
        }
      } catch (error: any) {
        console.warn(`Model ${model} failed:`, error.message || error);
        lastError = error;
      }
    }
    throw lastError || new Error("All fallback models exhausted.");
  }

  // Weekly AI Life Coach Synthesis
  app.post("/api/weekly-insight", async (req, res) => {
    try {
      const data = (req.body && typeof req.body === 'object') ? req.body : {};
      const { entries } = data;

      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: "At least one journal entry from the past 7 days is required." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("GEMINI_API_KEY is not set.");
        return res.status(500).json({ error: "Gemini API key is not configured." });
      }

      const ai = new GoogleGenAI({ apiKey });

      // Compile past 7 days text
      const compiledText = entries.map((e: any, i: number) => {
        const title = e.title ? `Title: ${e.title}\n` : '';
        const date = e.date ? `Date: ${e.date}\n` : '';
        const mood = e.mood ? `Mood: ${e.mood}/5\n` : '';
        const tags = e.tags && e.tags.length ? `Tags: ${e.tags.join(', ')}\n` : '';
        return `Entry ${i + 1}:\n${date}${title}${mood}${tags}Content: ${e.content || ''}`;
      }).join('\n\n---\n\n');

      const systemPrompt = "Analyze these journal entries as an elite, empathetic cognitive-behavioral coach. Identify primary themes, emotional trends, and one actionable takeaway. Keep it concise, warm, and professional under 120 words. Return your response strictly as valid JSON with three keys: \"keyThemes\" (an array of 2 to 4 short strings), \"reflection\" (a supportive synthesis paragraph), and \"takeaway\" (one actionable takeaway sentence). Do not include markdown code block tags if possible, only raw JSON.";

      const rawResponse = await generateContentWithFallback(ai, [{ role: 'user', parts: [{ text: compiledText }] }], systemPrompt);

      let parsed: { keyThemes?: string[]; reflection?: string; takeaway?: string } = {};
      try {
        // Strip code fence if present
        const cleaned = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = {
          keyThemes: ["Mindfulness & Reflection", "Emotional Balance"],
          reflection: rawResponse,
          takeaway: "Continue holding space for daily self-expression and conscious pause."
        };
      }

      res.json({
        keyThemes: parsed.keyThemes || ["Self-Awareness", "Personal Growth"],
        reflection: parsed.reflection || rawResponse,
        takeaway: parsed.takeaway || "Take 5 mindful minutes today to ground your priorities."
      });
    } catch (error: any) {
      console.error("Weekly synthesis generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate weekly insight." });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
