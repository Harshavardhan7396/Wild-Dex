// Supabase Edge Function: scan
// Deploy with: supabase functions deploy scan
// Set secret with: supabase secrets set GEMINI_API_KEY=your_gemini_api_key

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_MODEL = 'gemini-3.1-flash-lite';

const SYSTEM_INSTRUCTION = `
You are the authoritative biological taxonomist and computer vision identifier for WildDex.
Analyze the provided specimen photo and identify the organism using rigorous biological taxonomy.
Return structured JSON only conforming to this schema:
{
  "commonName": string,
  "scientificName": string,
  "category": "mammals" | "birds" | "reptiles" | "amphibians" | "insects" | "marine" | "plants" | "fungi" | "other",
  "confidence": number between 0.0 and 1.0,
  "notASpecies": boolean,
  "taxonomicRank": "species" | "genus" | "family",
  "reasoning": string,
  "alternateMatches": [
    {
      "commonName": string,
      "scientificName": string,
      "confidence": number,
      "distinctionReason": string
    }
  ],
  "safetyFlags": {
    "venomous": boolean,
    "toxic": boolean,
    "endangered": boolean,
    "invasive": boolean,
    "harmless": boolean
  },
  "quickFacts": {
    "habitat": string,
    "diet": string,
    "lifespan": string,
    "size": string
  }
}

Rules:
1. Ground taxonomy in visible field marks. If blurry or degraded, set confidence < 0.60.
2. If species cannot be distinguished from sibling species, use genus-level classification (e.g. "Genus sp.").
3. Never fabricate pseudo-Latin scientific names.
4. If image is an inanimate object or human artifact, set notASpecies: true, confidence: 0.0, commonName: "Not a Living Species", scientificName: "N/A".
`.trim();

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({
          error: 'GEMINI_API_KEY secret is not configured in Supabase. Please set it using: supabase secrets set GEMINI_API_KEY=your_key',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body = await req.json();
    const { imageBase64, mimeType = 'image/jpeg', category = 'all' } = body;

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Missing imageBase64 payload.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Clean base64 header if present
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

    const userPrompt = category && category !== 'all'
      ? `Identify this specimen. Context / Category Hint: ${category}. Return valid JSON conforming to the schema.`
      : `Identify this specimen organism. Return valid JSON conforming to the schema.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType || 'image/jpeg',
                  data: cleanBase64,
                },
              },
              {
                text: userPrompt,
              },
            ],
          },
        ],
        system_instruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        generation_config: {
          response_mime_type: 'application/json',
          temperature: 0.2,
        },
      }),
    });

    const geminiResult = await geminiResponse.json();

    if (!geminiResponse.ok) {
      const errorMsg =
        geminiResult?.error?.message ||
        `Gemini API returned status ${geminiResponse.status}`;

      const isQuota =
        geminiResponse.status === 429 ||
        errorMsg.includes('RESOURCE_EXHAUSTED') ||
        errorMsg.includes('quota') ||
        errorMsg.includes('rate limit');

      return new Response(
        JSON.stringify({
          error: isQuota
            ? 'Too many scans right now, please wait a minute'
            : errorMsg,
          rawError: geminiResult?.error,
        }),
        {
          status: geminiResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const candidate = geminiResult?.candidates?.[0];
    const textOutput = candidate?.content?.parts?.[0]?.text;

    if (!textOutput) {
      return new Response(
        JSON.stringify({ error: 'No identification candidates returned from model.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let parsed: any;
    try {
      const cleanJson = textOutput.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Failed to parse taxonomic JSON model output.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        commonName: parsed.commonName,
        scientificName: parsed.scientificName,
        category: parsed.category,
        confidence: parsed.confidence,
        notASpecies: parsed.notASpecies,
        taxonomicRank: parsed.taxonomicRank,
        reasoning: parsed.reasoning,
        alternateMatches: parsed.alternateMatches || parsed.top3AlternateMatches || [],
        safetyFlags: parsed.safetyFlags,
        quickFacts: parsed.quickFacts,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error in scan edge function.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
