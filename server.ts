import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

// Load environment variables
dotenv.config();

// Lazy initialize Gemini client
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in the Secrets panel under Settings.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

function isRetryableError(error: any): boolean {
  const status = error?.status ?? error?.response?.status;
  return status === 503 || status === 429;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI["models"]["generateContent"]>[0],
  maxRetries = 4
) {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      lastError = error;
      if (attempt === maxRetries || !isRetryableError(error)) {
        throw error;
      }
      // Exponential backoff with jitter: ~1s, 2s, 4s, 8s
      const delay = 2 ** attempt * 1000 + Math.random() * 300;
      console.warn(`Gemini request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms...`);
      await sleep(delay);
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

  // Set limits for base64 file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API endpoint: Parse Bank Statement
  app.post("/api/parse-statement", async (req, res) => {
    try {
      const { text, fileBase64, fileMimeType } = req.body;

      if (!text && !fileBase64) {
        return res.status(400).json({ error: "Please provide either OCR text or a base64 file." });
      }

      const ai = getGeminiClient();

      const parts: any[] = [];

      // Add instruction part
      parts.push({
        text: `You are an expert financial document parser. Analyze the provided bank statement (image, PDF, or text) and extract ALL transactions along with key metadata.
        
        Ensure you extract EVERY single transaction row from the statement. Do not truncate, summarize, or skip any transaction rows.
        
        Extract:
        1. Account Holder Name (e.g., MED WALK FOOTWEAR)
        2. Account Number (e.g., 921020028439057)
        3. Statement Period (e.g., 01-04-2026 To 30-04-2026)
        4. Opening Balance (e.g., 773983.27)
        5. Closing Balance (e.g., 765848.13)
        6. Transactions array:
           - date: The transaction date (format: YYYY-MM-DD or DD-MM-YYYY)
           - description: Clean particulars (e.g., "IMPS/P2A/609150428878/JAGANATHANMS/X815810/STATEBANKOFINDIA/")
           - reference: Cheque or reference number if available (or empty string)
           - debit: Debit/withdrawal amount as number, or null if no debit
           - credit: Credit/deposit amount as number, or null if no credit
           - balance: Running balance as number

        Return a single valid JSON object matching this schema. Be extremely precise with transaction values, debit/credit matching, and mathematical signs.`
      });

      // Add file or text parts
      if (fileBase64 && fileMimeType) {
        parts.push({
          inlineData: {
            data: fileBase64,
            mimeType: fileMimeType
          }
        });
      }

      if (text) {
        parts.push({
          text: `Here is the OCR or text representation of the bank statement: \n\n${text}`
        });
      }

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              accountHolder: { type: Type.STRING },
              accountNumber: { type: Type.STRING },
              period: { type: Type.STRING },
              openingBalance: { type: Type.NUMBER },
              closingBalance: { type: Type.NUMBER },
              transactions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING },
                    description: { type: Type.STRING },
                    reference: { type: Type.STRING },
                    debit: { type: Type.NUMBER, nullable: true },
                    credit: { type: Type.NUMBER, nullable: true },
                    balance: { type: Type.NUMBER }
                  },
                  required: ["date", "description", "balance"]
                }
              }
            },
            required: ["accountHolder", "accountNumber", "period", "transactions"]
          }
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error("No response received from Gemini AI model.");
      }

      const parsedData = JSON.parse(resultText);
      res.json(parsedData);
    } catch (error: any) {
      console.error("Statement parsing error:", error);
      if (isRetryableError(error)) {
        return res.status(503).json({
          error: "Gemini AI is currently experiencing high demand. We retried automatically but it's still unavailable — please try again in a minute."
        });
      }
      res.status(500).json({
        error: error.message || "An unexpected error occurred while parsing the bank statement."
      });
    }
  });

  // Vite development middleware vs production static server
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
