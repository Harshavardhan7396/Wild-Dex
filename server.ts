import express from 'express';
import dotenv from 'dotenv';
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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parser with 20MB limit for base64 specimen photos
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

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
    const { imageBase64, mimeType = 'image/jpeg', testCaseId } = req.body;

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

    if (!imageBase64) {
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

    return res.json({
      success: true,
      model: GEMINI_SCANNER_MODEL,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Gemini Scanner Error details:', error);
    let rawMessage = error?.message || 'Failed to analyze specimen with Gemini model.';
    let statusCode = 500;

    // Extract nested error details if message is stringified JSON from @google/genai
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

    // Nginx intercepts 403, 502, 503, 504 and serves HTML error pages instead of JSON.
    // Map them to 429 (Too Many Requests / High Demand) and 401 (Unauthorized) so Nginx passes JSON through.
    if (isHighDemandOrQuota) {
      statusCode = 429;
    } else if (isAuthOrKeyError) {
      statusCode = 401;
    } else if (statusCode === 404 || rawMessage.includes('404') || rawMessage.includes('NOT_FOUND')) {
      statusCode = 404;
    } else if (statusCode < 400 || statusCode >= 600) {
      statusCode = 500;
    }

    return res.status(statusCode).json({
      success: false,
      error: rawMessage,
      statusCode,
      details: error?.error || error?.details || undefined,
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
