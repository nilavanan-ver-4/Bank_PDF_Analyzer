import React, { useState, useRef } from "react";
import { Upload, FileText, AlertCircle, Loader2, Sparkles, Check, HelpCircle } from "lucide-react";
import { Transaction, StatementMetadata } from "../types";

interface Props {
  onImportComplete: (metadata: StatementMetadata, transactions: Transaction[]) => void;
}

export default function ImportParser({ onImportComplete }: Props) {
  const [activeTab, setActiveTab] = useState<"file" | "text">("file");
  const [pastedText, setPastedText] = useState("");
  const [fileData, setFileData] = useState<{ base64: string; name: string; type: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadingPhrases = [
    "Establishing server connection...",
    "Injecting document context...",
    "Scanning statement for structured matrices...",
    "Recognizing transaction patterns...",
    "Decrypting debit and credit columns...",
    "Verifying ledger balance consistency...",
    "Generating pristine CSV format structure...",
  ];

  // Rotate loading phrases during wait
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingPhrases.length);
      }, 3000);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file) return;
    setError(null);

    // Limit files to 15MB
    if (file.size > 15 * 1024 * 1024) {
      setError("File size exceeds the 15MB limit. Please provide a smaller file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      setFileData({
        base64,
        name: file.name,
        type: file.type || "application/pdf", // fallback mimeType
      });
    };
    reader.onerror = () => {
      setError("Failed to read file.");
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleParse = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const payload: any = {};
      if (activeTab === "file") {
        if (!fileData) {
          setError("Please select or drag a statement file (PDF or image).");
          setIsLoading(false);
          return;
        }
        payload.fileBase64 = fileData.base64;
        payload.fileMimeType = fileData.type;
      } else {
        if (!pastedText.trim()) {
          setError("Please paste the bank statement transaction logs first.");
          setIsLoading(false);
          return;
        }
        payload.text = pastedText;
      }

      const response = await fetch("/api/parse-statement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const isJson = response.headers.get("content-type")?.includes("application/json");

      if (!response.ok) {
        if (!isJson) {
          throw new Error(
            response.status === 502 || response.status === 503
              ? "The server is waking up or temporarily unavailable (common on free hosting tiers after inactivity). Please wait ~30 seconds and try again."
              : `Server returned an unexpected error (status ${response.status}). Please try again.`
          );
        }
        const errData = await response.json();
        throw new Error(errData.error || "Failed to parse the document. Verify API keys or try again.");
      }

      if (!isJson) {
        throw new Error("Server returned an unexpected response instead of data. Please try again in a moment.");
      }

      const result = await response.json();

      if (!result.transactions || result.transactions.length === 0) {
        throw new Error("No transactions were found or extracted. Please check the document format.");
      }

      // Map parsed items into clean standard transaction schema
      const mappedTransactions: Transaction[] = result.transactions.map((tx: any, idx: number) => ({
        id: `tx-parsed-${idx}-${Date.now()}`,
        date: tx.date || new Date().toISOString().split("T")[0],
        description: tx.description || "N/A",
        reference: tx.reference || "",
        debit: tx.debit !== undefined ? tx.debit : null,
        credit: tx.credit !== undefined ? tx.credit : null,
        balance: tx.balance || 0,
      }));

      const mappedMetadata: StatementMetadata = {
        accountHolder: result.accountHolder || "Imported Account",
        accountNumber: result.accountNumber || "N/A",
        period: result.period || "N/A",
        openingBalance: result.openingBalance || 0,
        closingBalance: result.closingBalance || 0,
      };

      onImportComplete(mappedMetadata, mappedTransactions);
      
      // Reset input states
      setFileData(null);
      setPastedText("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong while scanning the document.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50/50 via-slate-50 to-emerald-50/50 p-6 rounded-2xl border border-indigo-100/50 shadow-xs mb-6 relative overflow-hidden">
      {/* Background soft blurs */}
      <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-64 h-64 bg-indigo-200/20 blur-3xl rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/3 w-64 h-64 bg-emerald-200/20 blur-3xl rounded-full pointer-events-none"></div>

      {isLoading && (
        <div className="absolute inset-0 bg-white/90 z-20 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mb-4" />
          <h4 className="font-bold text-slate-800 text-base">Gemini is Parsing Statement</h4>
          <p className="text-xs text-slate-500 font-medium max-w-sm mt-1 transition-all duration-300">
            {loadingPhrases[loadingStep]}
          </p>
          <div className="w-48 bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
            <div className="bg-indigo-600 h-full rounded-full animate-loading-bar"></div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-5 pb-4 border-b border-indigo-100/30">
        <div>
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-500 fill-indigo-100" />
            Parse Statement with Gemini AI
          </h3>
          <p className="text-xs text-slate-500">
            Upload statement files or paste text log formats to parse instantly into edit-ready tables.
          </p>
        </div>
        <div className="flex bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/50 self-stretch sm:self-auto">
          <button
            onClick={() => {
              setActiveTab("file");
              setError(null);
            }}
            className={`flex-1 sm:flex-none px-4 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === "file" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Upload File
          </button>
          <button
            onClick={() => {
              setActiveTab("text");
              setError(null);
            }}
            className={`flex-1 sm:flex-none px-4 py-1 text-xs font-semibold rounded-md transition-all ${
              activeTab === "text" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Paste Text
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5 text-xs text-rose-600 animate-fade-in">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {activeTab === "file" ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            dragActive
              ? "border-indigo-500 bg-indigo-50/50"
              : "border-slate-200 bg-white/70 hover:border-indigo-400 hover:bg-white"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,image/*"
            className="hidden"
          />
          {fileData ? (
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-full">
                <Check className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-slate-800 text-xs mt-1 truncate max-w-xs">{fileData.name}</h4>
              <p className="text-[10px] text-slate-400">File loaded successfully. Click to replace.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                <Upload className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-slate-700 text-xs mt-1">Drag & drop your statement file here</h4>
              <p className="text-[10px] text-slate-400">Supports PDF documents and JPEG/PNG bank statement images (Max 15MB)</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <textarea
            rows={5}
            placeholder="Paste raw transaction logs, statement OCR text or CSV-like contents copied from bank logs here..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            className="w-full p-4 text-xs font-mono outline-none border-none resize-y bg-slate-50/10 focus:bg-white transition-colors"
          />
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={handleParse}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-100 transition-all cursor-pointer"
        >
          <Sparkles className="h-4 w-4" />
          Parse with Gemini AI
        </button>
      </div>
    </div>
  );
}
