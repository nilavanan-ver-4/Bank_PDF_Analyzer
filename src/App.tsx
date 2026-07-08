import React, { useState, useEffect } from "react";
import { FileSpreadsheet, ShieldAlert, BookOpen, Download, RefreshCw, Layers } from "lucide-react";
import { Transaction, StatementMetadata } from "./types";
import { DEFAULT_METADATA, DEFAULT_TRANSACTIONS } from "./data";
import StatementOverview from "./components/StatementOverview";
import AnalyticsChart from "./components/AnalyticsChart";
import TransactionTable from "./components/TransactionTable";
import ImportParser from "./components/ImportParser";

export default function App() {
  const [metadata, setMetadata] = useState<StatementMetadata>(DEFAULT_METADATA);
  const [transactions, setTransactions] = useState<Transaction[]>(DEFAULT_TRANSACTIONS);
  const [showGuide, setShowGuide] = useState(false);

  // Auto-recalculate running balances chronologically whenever transactions change
  const recalculateBalances = (txList: Transaction[], openingBal: number): Transaction[] => {
    // Sort by date ascending to recalculate running balance
    const sorted = [...txList].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let currentBalance = openingBal;

    const updated = sorted.map((tx) => {
      if (tx.credit !== null) {
        currentBalance += tx.credit;
      } else if (tx.debit !== null) {
        currentBalance -= tx.debit;
      }
      return {
        ...tx,
        balance: parseFloat(currentBalance.toFixed(2)),
      };
    });

    // Re-sort back to date descending (default display order)
    return updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // State operations
  const handleUpdateTransaction = (updatedTx: Transaction) => {
    const updatedList = transactions.map((tx) => (tx.id === updatedTx.id ? updatedTx : tx));
    const recalculated = recalculateBalances(updatedList, metadata.openingBalance);
    setTransactions(recalculated);

    // Update closing balance in metadata based on the last transaction chronologically
    if (recalculated.length > 0) {
      // Find the latest chronological transaction
      const chronologicallyLatest = [...recalculated].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      setMetadata({
        ...metadata,
        closingBalance: chronologicallyLatest.balance,
      });
    }
  };

  const handleDeleteTransaction = (id: string) => {
    const updatedList = transactions.filter((tx) => tx.id !== id);
    const recalculated = recalculateBalances(updatedList, metadata.openingBalance);
    setTransactions(recalculated);

    if (recalculated.length > 0) {
      const chronologicallyLatest = [...recalculated].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      setMetadata({
        ...metadata,
        closingBalance: chronologicallyLatest.balance,
      });
    } else {
      setMetadata({
        ...metadata,
        closingBalance: metadata.openingBalance,
      });
    }
  };

  const handleAddTransaction = (newTx: Omit<Transaction, "id">) => {
    const createdTx: Transaction = {
      ...newTx,
      id: `tx-manual-${Date.now()}`,
    };
    const updatedList = [...transactions, createdTx];
    const recalculated = recalculateBalances(updatedList, metadata.openingBalance);
    setTransactions(recalculated);

    if (recalculated.length > 0) {
      const chronologicallyLatest = [...recalculated].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0];
      setMetadata({
        ...metadata,
        closingBalance: chronologicallyLatest.balance,
      });
    }
  };

  const handleImportComplete = (newMetadata: StatementMetadata, newTransactions: Transaction[]) => {
    // Recalculate balances on imported logs to ensure mathematical soundness
    const recalculated = recalculateBalances(newTransactions, newMetadata.openingBalance);
    setMetadata({
      ...newMetadata,
      closingBalance: recalculated.length > 0 ? recalculated[0].balance : newMetadata.closingBalance,
    });
    setTransactions(recalculated);
  };

  const resetToDefault = () => {
    if (confirm("Are you sure you want to revert to the default MED WALK FOOTWEAR statement data? Any modifications will be lost.")) {
      setMetadata(DEFAULT_METADATA);
      setTransactions(DEFAULT_TRANSACTIONS);
    }
  };

  return (
    <div id="app-root" className="min-h-screen bg-slate-50/50 pb-12 font-sans antialiased text-slate-800">
      {/* Header bar */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10 px-6 py-4 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-100">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-900 text-lg tracking-tight leading-tight">
                Bank Statement CSV Converter
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                Pristine layout parser fueled by server-side Gemini AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all border border-slate-100"
            >
              <BookOpen className="h-4 w-4 text-slate-400" />
              Guide
            </button>
            <button
              onClick={resetToDefault}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all border border-slate-100"
              title="Reset data back to MED WALK statement template"
            >
              <RefreshCw className="h-4 w-4 text-slate-400" />
              Reset Template
            </button>
          </div>
        </div>
      </header>

      {/* Main body area */}
      <main className="max-w-7xl mx-auto px-6 mt-6">
        {/* User Interactive Guide */}
        {showGuide && (
          <div className="mb-6 p-5 bg-indigo-900 text-indigo-100 rounded-2xl border border-indigo-950 shadow-md relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 right-0 -translate-y-1/3 translate-x-1/4 w-48 h-48 bg-indigo-800/40 blur-2xl rounded-full pointer-events-none"></div>
            <h3 className="font-bold text-sm text-white mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              How to Convert Statements to CSV
            </h3>
            <ul className="text-xs space-y-2 list-disc list-inside opacity-90 max-w-4xl">
              <li>
                <strong>Default Statement Template:</strong> The application opens pre-populated with the exact parsed transaction log records from the Axis Bank MED WALK statement images you provided!
              </li>
              <li>
                <strong>AI-Powered File Parsing:</strong> Drag and drop any statement PDF file or picture, then click <span className="font-semibold text-white">Parse with Gemini AI</span>. Our backend securely relays the file to the Gemini API, recognizing tabular grids with extreme accuracy.
              </li>
              <li>
                <strong>Interactive Grid Features:</strong> Use the table tools to instantly search description parameters, filter down to deposits or withdrawals, and edit inline cell numbers with auto-balancing calculations!
              </li>
              <li>
                <strong>One-Click Export:</strong> Click <span className="font-semibold text-white">Export CSV</span> to save as a standard comma-separated file, <span className="font-semibold text-white">Export PDF</span> to generate a formatted statement document, or <span className="font-semibold text-white">Copy CSV</span> to copy directly to your clipboard for instant Excel/Google Sheets pasting.
              </li>
            </ul>
          </div>
        )}

        {/* AI Statement Import Module */}
        <ImportParser onImportComplete={handleImportComplete} />

        {/* Overview Stat Widgets */}
        <StatementOverview metadata={metadata} transactions={transactions} />

        {/* Chart View */}
        <AnalyticsChart transactions={transactions} />

        {/* Interactive Transaction Grid Table */}
        <TransactionTable
          transactions={transactions}
          metadata={metadata}
          onUpdateTransaction={handleUpdateTransaction}
          onDeleteTransaction={handleDeleteTransaction}
          onAddTransaction={handleAddTransaction}
        />
      </main>
    </div>
  );
}
