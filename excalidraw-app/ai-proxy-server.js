/**
 * AI Proxy Server for Excalidraw Autocomplete
 *
 * Uses OPENAI_API_KEY from .env to provide:
 * - Simple text completion (e.g. "2+2=" -> "4")
 * - Diagram generation (e.g. "a diagram of the transformer model" -> Mermaid flowchart)
 *
 * Run: node ai-proxy-server.js
 * Default port: 3016 (matches VITE_APP_AI_BACKEND in .env.development)
 */

/* eslint-disable no-console */

const path = require("path");
const fs = require("fs");

// Load .env without external dependencies
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
}

const express = require("express");
const cors = require("cors");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.AI_PROXY_PORT || 3016;

if (!OPENAI_API_KEY) {
  console.error(
    "Error: OPENAI_API_KEY is not set in .env. Add your OpenAI API key to use AI autocomplete.",
  );
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

const DIAGRAM_KEYWORDS = [
  "diagram",
  "flowchart",
  "chart",
  "architecture",
  "model",
  "structure",
  "relationship",
  "process",
  "flow",
  "graph",
  "schema",
];

function looksLikeDiagramRequest(prompt) {
  const lower = prompt.toLowerCase().trim();
  return DIAGRAM_KEYWORDS.some((kw) => lower.includes(kw));
}

app.post("/v1/ai/autocomplete", async (req, res) => {
  try {
    const { prompt, systemPrompt: customSystemPrompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "prompt is required" });
    }

    const isDiagramRequest = looksLikeDiagramRequest(prompt);

    const systemPrompt = customSystemPrompt || `You are an intelligent Excalidraw assistant. You can respond in three ways depending on the user's prompt. DO NOT refuse to draw or say you cannot create images. You ARE capable of generating them by outputting JSON arrays.
1. If the user asks for a diagram (e.g. flowchart, sequence), output ONLY a valid Mermaid diagram code wrapped in \`\`\`mermaid.
2. If the user asks you to insert a picture from the web, draw shapes, arrows, or any other Excalidraw element, output a valid JSON array of Excalidraw elements wrapped in \`\`\`json. For pictures from the web, ALWAYS use type: "embeddable", and ALWAYS set "link" to a valid image URL. ALWAYS provide "width": 300 and "height": 300 (or other appropriate sizes) for any elements you create.
3. Otherwise, for general text completion, math, or answers, just output the concise text reply.`;

    const endpoint = process.env.AI_ENDPOINT || "https://models.inference.ai.azure.com/chat/completions";
    const response = await fetch(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          max_tokens: 2000,
          temperature: 0.3,
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI API error:", response.status, errText);
      return res.status(response.status).json({
        error: `OpenAI API error: ${response.status}`,
        details: errText,
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    if (customSystemPrompt) {
      return res.json({ type: "text", value: content });
    }

    const jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)```/i);
    const mermaidMatch = content.match(/```mermaid\n?([\s\S]*?)```/i);

    if (jsonMatch && !isDiagramRequest && content.includes('"type"')) {
      try {
        const parsedJson = JSON.parse(jsonMatch[1].trim());
        if (Array.isArray(parsedJson)) {
          return res.json({ type: "elements", value: parsedJson });
        }
      } catch (e) {
        console.error("Failed to parse JSON from AI", e);
      }
    }

    if (isDiagramRequest || mermaidMatch) {
      let mermaid = mermaidMatch ? mermaidMatch[1].trim() : content;
      mermaid = mermaid.replace(/```(?:mermaid)?\n?([\s\S]*?)```/g, '$1').trim();
      return res.json({ type: "diagram", mermaid });
    }

    return res.json({ type: "text", value: content });
  } catch (err) {
    console.error("Autocomplete error:", err);
    return res.status(500).json({
      error: err.message || "Internal server error",
    });
  }
});

app.listen(PORT, () => {
  console.log(`AI Proxy server running at http://localhost:${PORT}`);
  console.log(
    "Autocomplete endpoint: POST /v1/ai/autocomplete with { prompt: string }",
  );
});
