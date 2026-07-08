import React from "react";
import { ArrowDownRight, ArrowUpRight, Wallet, Activity, Calendar, FileSpreadsheet } from "lucide-react";
import { StatementMetadata, Transaction } from "../types";

interface Props {
  metadata: StatementMetadata;
  transactions: Transaction[];
}

export default function StatementOverview({ metadata, transactions }: Props) {
  const totalDebit = transactions.reduce((sum, tx) => sum + (tx.debit || 0), 0);
  const totalCredit = transactions.reduce((sum, tx) => sum + (tx.credit || 0), 0);
  const netFlow = totalCredit - totalDebit;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Opening & Closing Balance */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Account Summary</p>
            <h3 className="text-lg font-bold text-slate-800 mt-1 truncate max-w-[180px]" title={metadata.accountHolder}>
              {metadata.accountHolder}
            </h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">A/C: {metadata.accountNumber}</p>
          </div>
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Wallet className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between text-xs font-mono text-slate-500">
          <div>
            <span className="block text-[10px] uppercase text-slate-400 font-sans">Opening</span>
            <span className="font-semibold text-slate-700">{formatCurrency(metadata.openingBalance)}</span>
          </div>
          <div className="text-right">
            <span className="block text-[10px] uppercase text-slate-400 font-sans">Closing</span>
            <span className="font-semibold text-slate-800">{formatCurrency(metadata.closingBalance)}</span>
          </div>
        </div>
      </div>

      {/* Net Flow */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Net Flow</p>
            <h3 className={`text-2xl font-bold mt-2 ${netFlow >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              {netFlow >= 0 ? "+" : ""}{formatCurrency(netFlow)}
            </h3>
            <p className="text-xs text-slate-400 mt-1">Inflow vs Outflow</p>
          </div>
          <div className={`p-2 rounded-xl ${netFlow >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
            {netFlow >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between text-xs text-slate-500 font-sans">
          <span>Period:</span>
          <span className="font-mono text-slate-700 font-medium flex items-center gap-1">
            <Calendar className="h-3 w-3 text-slate-400" /> {metadata.period}
          </span>
        </div>
      </div>

      {/* Total Debits */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Withdrawals</p>
            <h3 className="text-2xl font-bold text-rose-600 mt-2">
              {formatCurrency(totalDebit)}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {transactions.filter(t => t.debit !== null).length} debit transactions
            </p>
          </div>
          <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
            <ArrowDownRight className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between text-xs text-slate-500">
          <span>Max Withdrawal:</span>
          <span className="font-mono font-semibold text-slate-700">
            {formatCurrency(Math.max(...transactions.map(t => t.debit || 0), 0))}
          </span>
        </div>
      </div>

      {/* Total Credits */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Deposits</p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-2">
              {formatCurrency(totalCredit)}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {transactions.filter(t => t.credit !== null).length} credit transactions
            </p>
          </div>
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
            <ArrowUpRight className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between text-xs text-slate-500">
          <span>Max Deposit:</span>
          <span className="font-mono font-semibold text-slate-700">
            {formatCurrency(Math.max(...transactions.map(t => t.credit || 0), 0))}
          </span>
        </div>
      </div>
    </div>
  );
}
