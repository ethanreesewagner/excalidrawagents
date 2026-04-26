/**
 * Vercel Serverless Function for AI Autocomplete Proxy
 * 
 * Handles POST /api/autocomplete
 */

export default async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt, systemPrompt: customSystemPrompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured on server' });
  }

  const DIAGRAM_KEYWORDS = [
    "diagram", "flowchart", "chart", "architecture", "model",
    "structure", "relationship", "process", "flow", "graph", "schema"
  ];

  function looksLikeDiagramRequest(prompt) {
    const lower = prompt.toLowerCase().trim();
    return DIAGRAM_KEYWORDS.some((kw) => lower.includes(kw));
  }

  const isDiagramRequest = looksLikeDiagramRequest(prompt);

  const systemPrompt = customSystemPrompt || `You are an intelligent Excalidraw assistant. You can respond in three ways depending on the user's prompt. DO NOT refuse to draw or say you cannot create images. You ARE capable of generating them by outputting JSON arrays.
1. If the user asks for a diagram (e.g. flowchart, sequence), output ONLY a valid Mermaid diagram code wrapped in \`\`\`mermaid.
2. If the user asks you to insert a picture from the web, draw shapes, arrows, or any other Excalidraw element, output a valid JSON array of Excalidraw elements wrapped in \`\`\`json. For pictures from the web, ALWAYS use type: "embeddable", and ALWAYS set "link" to a valid image URL. ALWAYS provide "width": 300 and "height": 300 (or other appropriate sizes) for any elements you create.
3. Otherwise, for general text completion, math, or answers, just output the concise text reply.`;

  const baseUrl =
    process.env.AI_BASE_URL || "https://integrate.api.nvidia.com/v1";
  const endpoint = process.env.AI_ENDPOINT || `${baseUrl}/chat/completions`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({
        error: `AI API error: ${response.status}`,
        details: errText,
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';

    if (customSystemPrompt) {
      return res.json({ type: 'text', value: content });
    }

    const jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)```/i);
    const mermaidMatch = content.match(/```mermaid\n?([\s\S]*?)```/i);

    if (jsonMatch && !isDiagramRequest && content.includes('"type"')) {
      try {
        const parsedJson = JSON.parse(jsonMatch[1].trim());
        if (Array.isArray(parsedJson)) {
          return res.json({ type: 'elements', value: parsedJson });
        }
      } catch (e) {
        // ignore parsing error
      }
    }

    if (isDiagramRequest || mermaidMatch) {
      let mermaid = mermaidMatch ? mermaidMatch[1].trim() : content;
      mermaid = mermaid.replace(/```(?:mermaid)?\n?([\s\S]*?)```/g, '$1').trim();
      return res.json({ type: 'diagram', mermaid });
    }

    return res.json({ type: 'text', value: content });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
