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

// Initialize GoogleGenAI client with required User-Agent header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

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
      console.warn('GEMINI_API_KEY is unset. Using realistic mock fallback.');
      const fallbackResult: SpecimenScanResult = SCANNER_TEST_CASES[0].expectedOutput;
      return res.json({
        success: true,
        model: GEMINI_SCANNER_MODEL,
        simulated: true,
        data: fallbackResult,
      });
    }

    const imagePart = {
      inlineData: {
        data: cleanBase64,
        mimeType: mimeType || 'image/jpeg',
      },
    };

    const textPart = {
      text: SCANNER_USER_PROMPT,
    };

    const response = await ai.models.generateContent({
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

    const responseText = response.text?.trim() || '{}';
    const parsedData: SpecimenScanResult = JSON.parse(responseText);

    return res.json({
      success: true,
      model: GEMINI_SCANNER_MODEL,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Gemini Scanner Error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to analyze specimen with Gemini model.',
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
