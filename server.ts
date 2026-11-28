import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  GEMINI_SCANNER_MODEL,
  SCANNER_SYSTEM_INSTRUCTION,
  SCANNER_USER_PROMPT,
  SCANNER_TEST_CASES,
  SpecimenScanResult,
} from './src/config/scannerPrompt';
import {
  GEMINI_COMPANION_MODEL,
  COMPANION_MAX_HISTORY_TURNS,
  COMPANION_MAX_MESSAGE_LENGTH,
  COMPANION_SYSTEM_INSTRUCTION,
} from './src/config/companionPrompt';
import {
  applyRateLimitHeaders,
  checkAndConsumeRateLimit,
  resolveVerifiedCaller,
} from './src/server/authAndRateLimit';
import { verifyAndIssueScanAttestation } from './src/server/scanVerification';
import type { CompanionStructuredResponse } from './src/types/wilddex2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Match Vite's .env loading order so Express routes (/api/*) and Vite client
// read from the same target database (e.g., .env.development for WildDex Dev).
// override: false ensures platform-injected secrets (AI Studio / Production) win.
const envMode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
for (const envFile of [`.env.${envMode}.local`, `.env.${envMode}`, '.env.local', '.env']) {
  const fullPath = path.resolve(__dirname, envFile);
  if (fs.existsSync(fullPath)) {
    dotenv.config({ path: fullPath, override: false });
  }
}

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parser with 20MB limit for base64 specimen photos
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

function mapGeminiErrorResponse(error: any, fallbackMessage: string) {
  let rawMessage = error?.message || fallbackMessage;
  let statusCode = 500;

  try {
    if (typeof rawMessage === 'string' && rawMessage.trim().startsWith('{')) {
      const parsed = JSON.parse(rawMessage);
      if (parsed?.error?.message) {
        rawMessage = parsed.error.message;
      }
      if (typeof parsed?.error?.code === 'number') {
        statusCode = parsed.error.code;
      }
    }
  } catch {}

  const isHighDemandOrQuota =
    statusCode === 429 ||
    statusCode === 503 ||
    statusCode === 502 ||
    statusCode === 504 ||
    rawMessage.includes('429') ||
    rawMessage.includes('503') ||
    rawMessage.includes('RESOURCE_EXHAUSTED') ||
    rawMessage.includes('UNAVAILABLE') ||
    rawMessage.toLowerCase().includes('high demand') ||
    rawMessage.toLowerCase().includes('quota') ||
    rawMessage.toLowerCase().includes('rate limit');

  const isAuthOrKeyError =
    statusCode === 403 ||
    statusCode === 401 ||
    rawMessage.includes('403') ||
    rawMessage.includes('401') ||
    rawMessage.includes('PERMISSION_DENIED') ||
    rawMessage.includes('API_KEY_INVALID');

  if (isHighDemandOrQuota) {
    statusCode = 429;
  } else if (isAuthOrKeyError) {
    statusCode = 401;
  } else if (statusCode === 404 || rawMessage.includes('404') || rawMessage.includes('NOT_FOUND')) {
    statusCode = 404;
  } else if (statusCode < 400 || statusCode >= 600) {
    statusCode = 500;
  }

  return { statusCode, rawMessage };
}

/**
 * Endpoint to run the 5 canonical scanner test cases
 */
app.get('/api/scan/test-cases', (_req, res) => {
  res.json({
    model: GEMINI_SCANNER_MODEL,
    systemInstruction: SCANNER_SYSTEM_INSTRUCTION,
    testCases: SCANNER_TEST_CASES,
  });
});

/**
 * AI Specimen Identification Endpoint
 */
app.post('/api/scan', async (req, res) => {
  try {
    const { caller, authError } = await resolveVerifiedCaller(req);
    if (!caller) {
      return res.status(401).json({
        success: false,
        error: authError || 'Authentication failed.',
      });
    }

    const { imageBase64, mimeType = 'image/jpeg', testCaseId } = req.body || {};

    // If running a predefined test case
    if (testCaseId) {
      const matchedCase = SCANNER_TEST_CASES.find((tc) => tc.id === testCaseId);
      if (matchedCase) {
        return res.json({
          success: true,
          model: GEMINI_SCANNER_MODEL,
          isTestCase: true,
          testCase: matchedCase,
          data: matchedCase.expectedOutput,
        });
      }
    }

    const scanPolicy = {
      bucketPrefix: 'scan',
      windowMs: 5 * 60_000,
      maxPerWindow: caller.authenticated ? 20 : 8,
      maxPerDay: caller.authenticated ? 120 : 25,
    };
    const rate = checkAndConsumeRateLimit(caller.key, scanPolicy);
    applyRateLimitHeaders(res, scanPolicy, rate);
    if (!rate.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Scan rate limit reached. Please wait before scanning again.',
        retryAfterSeconds: rate.retryAfterSeconds,
      });
    }

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing imageBase64 payload.',
      });
    }

    // Clean base64 header if present
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

    // Check if GEMINI_API_KEY is configured
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY is not configured in environment variables.');
      return res.status(401).json({
        success: false,
        error: 'Gemini API key is not configured. Please set your GEMINI_API_KEY in Settings > Secrets.',
      });
    }

    const aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const imagePart = {
      inlineData: {
        data: cleanBase64,
        mimeType: mimeType || 'image/jpeg',
      },
    };

    const textPart = {
      text: SCANNER_USER_PROMPT,
    };

    const response = await aiClient.models.generateContent({
      model: GEMINI_SCANNER_MODEL,
      contents: {
        parts: [imagePart, textPart],
      },
      config: {
        systemInstruction: SCANNER_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            commonName: { type: Type.STRING },
            scientificName: { type: Type.STRING },
            category: {
              type: Type.STRING,
              enum: ['mammals', 'birds', 'reptiles', 'amphibians', 'insects', 'marine', 'plants', 'fungi', 'other'],
            },
            confidence: { type: Type.NUMBER },
            notASpecies: { type: Type.BOOLEAN },
            taxonomicRank: {
              type: Type.STRING,
              enum: ['species', 'subspecies', 'genus', 'family', 'order', 'unknown'],
            },
            reasoning: { type: Type.STRING },
            safetyFlags: {
              type: Type.OBJECT,
              properties: {
                venomous: { type: Type.BOOLEAN },
                toxic: { type: Type.BOOLEAN },
                endangered: { type: Type.BOOLEAN },
                invasive: { type: Type.BOOLEAN },
                harmless: { type: Type.BOOLEAN },
              },
              required: ['venomous', 'toxic', 'endangered', 'invasive', 'harmless'],
            },
            top3AlternateMatches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  commonName: { type: Type.STRING },
                  scientificName: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  distinctionReason: { type: Type.STRING },
                },
                required: ['commonName', 'scientificName', 'confidence', 'distinctionReason'],
              },
            },
            quickFacts: {
              type: Type.OBJECT,
              properties: {
                habitat: { type: Type.STRING },
                diet: { type: Type.STRING },
                lifespan: { type: Type.STRING },
                size: { type: Type.STRING },
              },
              required: ['habitat', 'diet', 'lifespan', 'size'],
            },
          },
          required: [
            'commonName',
            'scientificName',
            'category',
            'confidence',
            'notASpecies',
            'taxonomicRank',
            'reasoning',
            'safetyFlags',
            'top3AlternateMatches',
            'quickFacts',
          ],
        },
      },
    });

    let cleanJson = (response.text || '').trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
    const parsedData: SpecimenScanResult = JSON.parse(cleanJson || '{}');
    const scanVerification = await verifyAndIssueScanAttestation({
      userId: caller.userId,
      scan: parsedData,
    });

    return res.json({
      success: true,
      model: GEMINI_SCANNER_MODEL,
      data: parsedData,
      scanVerification,
    });
  } catch (error: any) {
    console.error('Gemini Scanner Error details:', error);
    const { statusCode, rawMessage } = mapGeminiErrorResponse(
      error,
      'Failed to analyze specimen with Gemini model.'
    );

    return res.status(statusCode).json({
      success: false,
      error: rawMessage,
      statusCode,
      details: error?.error || error?.details || undefined,
    });
  }
});

/**
 * AI Nature Companion Endpoint (Phase 2 Backend Foundation)
 * Enforces server-side Bearer JWT verification (when provided), rate limits,
 * strict input validation, and server-only GEMINI_API_KEY access.
 */
app.post('/api/companion', async (req, res) => {
  try {
    const { caller, authError } = await resolveVerifiedCaller(req);
    if (!caller) {
      return res.status(401).json({
        success: false,
        model: GEMINI_COMPANION_MODEL,
        error: authError || 'Authentication failed.',
      });
    }

    const companionPolicy = {
      bucketPrefix: 'companion',
      windowMs: 15 * 60_000,
      maxPerWindow: caller.authenticated ? 20 : 5,
      maxPerDay: caller.authenticated ? 60 : 12,
    };

    const rate = checkAndConsumeRateLimit(caller.key, companionPolicy);
    applyRateLimitHeaders(res, companionPolicy, rate);
    if (!rate.allowed) {
      return res.status(429).json({
        success: false,
        model: GEMINI_COMPANION_MODEL,
        error: caller.authenticated
          ? 'Daily or burst Nature Companion limit reached. Please try again shortly.'
          : 'Guest Nature Companion limit reached. Sign in for higher usage limits or wait a few minutes.',
        retryAfterSeconds: rate.retryAfterSeconds,
        quota: {
          remainingWindow: rate.remainingWindow,
          remainingDaily: rate.remainingDaily,
          authenticated: caller.authenticated,
        },
      });
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({
        success: false,
        model: GEMINI_COMPANION_MODEL,
        error: 'Invalid request payload.',
      });
    }

    const rawMessage = typeof body.message === 'string' ? body.message.trim() : '';
    if (!rawMessage || rawMessage.length > COMPANION_MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        model: GEMINI_COMPANION_MODEL,
        error: `Question must be between 1 and ${COMPANION_MAX_MESSAGE_LENGTH} characters.`,
      });
    }

    const sanitizedHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (Array.isArray(body.history)) {
      for (const turn of body.history.slice(-COMPANION_MAX_HISTORY_TURNS)) {
        if (
          turn &&
          typeof turn === 'object' &&
          (turn.role === 'user' || turn.role === 'assistant') &&
          typeof turn.content === 'string'
        ) {
          const cleanContent = turn.content.trim().slice(0, COMPANION_MAX_MESSAGE_LENGTH);
          if (cleanContent) {
            sanitizedHistory.push({ role: turn.role, content: cleanContent });
          }
        }
      }
    }

    let contextBlock = '';
    if (body.speciesContext && typeof body.speciesContext === 'object' && !Array.isArray(body.speciesContext)) {
      const ctx = body.speciesContext as Record<string, unknown>;
      const cleanParts: string[] = [];
      if (typeof ctx.commonName === 'string' && ctx.commonName.trim()) {
        cleanParts.push(`Common Name: ${ctx.commonName.trim().slice(0, 120)}`);
      }
      if (typeof ctx.scientificName === 'string' && ctx.scientificName.trim()) {
        cleanParts.push(`Scientific Name: ${ctx.scientificName.trim().slice(0, 120)}`);
      }
      if (typeof ctx.category === 'string' && ctx.category.trim()) {
        cleanParts.push(`Category: ${ctx.category.trim().slice(0, 60)}`);
      }
      if (typeof ctx.habitat === 'string' && ctx.habitat.trim()) {
        cleanParts.push(`Habitat: ${ctx.habitat.trim().slice(0, 200)}`);
      }
      if (cleanParts.length > 0) {
        contextBlock = `Active Species Context:\n${cleanParts.join('\n')}\n\n`;
      }
    }

    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY is not configured in environment variables.');
      return res.status(401).json({
        success: false,
        model: GEMINI_COMPANION_MODEL,
        error: 'Gemini API key is not configured. Please check Settings > Secrets.',
      });
    }

    const aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const historyText =
      sanitizedHistory.length > 0
        ? `Recent Conversation:\n${sanitizedHistory
            .map((t) => `${t.role === 'user' ? 'Explorer' : 'Companion'}: ${t.content}`)
            .join('\n')}\n\n`
        : '';

    const fullPrompt = `${contextBlock}${historyText}Explorer Question: ${rawMessage}`;

    const response = await aiClient.models.generateContent({
      model: GEMINI_COMPANION_MODEL,
      contents: fullPrompt,
      config: {
        systemInstruction: COMPANION_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            confidenceLevel: {
              type: Type.STRING,
              enum: ['high', 'moderate', 'uncertain'],
            },
            verifiedFactsSummary: { type: Type.STRING },
            uncertaintyNote: { type: Type.STRING },
            safetyNotice: { type: Type.STRING },
            followUpTopics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            'answer',
            'confidenceLevel',
            'verifiedFactsSummary',
            'uncertaintyNote',
            'safetyNotice',
            'followUpTopics',
          ],
        },
      },
    });

    let cleanJson = (response.text || '').trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
    const parsed = JSON.parse(cleanJson || '{}') as CompanionStructuredResponse;

    return res.json({
      success: true,
      model: GEMINI_COMPANION_MODEL,
      data: parsed,
      quota: {
        remainingWindow: rate.remainingWindow,
        remainingDaily: rate.remainingDaily,
        authenticated: caller.authenticated,
      },
    });
  } catch (error: any) {
    console.error('Gemini Companion Error details:', error);
    const { statusCode, rawMessage } = mapGeminiErrorResponse(
      error,
      'Failed to consult the AI Nature Companion.'
    );

    return res.status(statusCode).json({
      success: false,
      model: GEMINI_COMPANION_MODEL,
      error: rawMessage,
      statusCode,
    });
  }
});

// Setup Vite middleware in dev or static serve in prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WildDex full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
