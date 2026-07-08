import React, { useState } from "react";
import { Transaction } from "../types";
import { TrendingUp, ArrowDownUp } from "lucide-react";

interface Props {
  transactions: Transaction[];
}

export default function AnalyticsChart({ transactions }: Props) {
  const [activeTab, setActiveTab] = useState<"balance" | "cashflow">("balance");

  // Sort transactions by date ascending for charts
  const sortedTx = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Aggregate daily balance & flow
  const dailyDataMap: { [date: string]: { debit: number; credit: number; balance: number } } = {};
  
  sortedTx.forEach((tx) => {
    const d = tx.date;
    if (!dailyDataMap[d]) {
      dailyDataMap[d] = { debit: 0, credit: 0, balance: tx.balance };
    }
    dailyDataMap[d].debit += tx.debit || 0;
    dailyDataMap[d].credit += tx.credit || 0;
    dailyDataMap[d].balance = tx.balance; // Keep the last balance of the day
  });

  const dailyKeys = Object.keys(dailyDataMap).sort();
  const dailyPoints = dailyKeys.map((date) => ({
    date,
    ...dailyDataMap[date],
  }));

  // If no data, return placeholder
  if (dailyPoints.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center text-slate-400">
        No transaction data available for visualization.
      </div>
    );
  }

  // Format date for label (e.g. "Apr 01")
  const formatLabel = (dateStr: string) => {
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthIdx = parseInt(parts[1], 10) - 1;
        return `${monthNames[monthIdx]} ${parts[2]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Min and max calculations
  const balances = dailyPoints.map((p) => p.balance);
  const minBalance = Math.min(...balances);
  const maxBalance = Math.max(...balances);
  const balanceRange = maxBalance - minBalance || 1;
  const paddingRatio = 0.1; // 10% padding
  const yMin = Math.max(0, minBalance - balanceRange * paddingRatio);
  const yMax = maxBalance + balanceRange * paddingRatio;
  const yRange = yMax - yMin;

  // SVG Dimension Constants
  const width = 800;
  const height = 220;
  const paddingLeft = 80;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Map to SVG coordinates
  const getX = (index: number) => {
    return paddingLeft + (index / (dailyPoints.length - 1 || 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const ratio = (val - yMin) / yRange;
    return height - paddingBottom - ratio * chartHeight;
  };

  // Generate path points for Balance Trend line
  let pathD = "";
  let areaD = "";
  dailyPoints.forEach((p, i) => {
    const x = getX(i);
    const y = getY(p.balance);
    if (i === 0) {
      pathD = `M ${x} ${y}`;
      areaD = `M ${x} ${height - paddingBottom} L ${x} ${y}`;
    } else {
      pathD += ` L ${x} ${y}`;
      areaD += ` L ${x} ${y}`;
    }
    if (i === dailyPoints.length - 1) {
      areaD += ` L ${x} ${height - paddingBottom} Z`;
    }
  });

  // Flow Bar Chart Calculations
  const maxFlow = Math.max(...dailyPoints.map((p) => Math.max(p.debit, p.credit)), 1);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 border-b border-slate-50 gap-4">
        <div>
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-500" />
            Financial Analytics
          </h3>
          <p className="text-xs text-slate-400">Visual trend representation of account activity</p>
        </div>
        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
          <button
            onClick={() => setActiveTab("balance")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "balance"
                ? "bg-white text-indigo-600 shadow-xs border border-slate-200/50"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Balance Trend
          </button>
          <button
            onClick={() => setActiveTab("cashflow")}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "cashflow"
                ? "bg-white text-indigo-600 shadow-xs border border-slate-200/50"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Cash Flow (In / Out)
          </button>
        </div>
      </div>

      <div className="p-5">
        {activeTab === "balance" ? (
          <div>
            <div className="relative overflow-x-auto">
              <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible min-w-[650px]">
                {/* Horizontal grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                  const val = yMin + ratio * yRange;
                  const y = getY(val);
                  return (
                    <g key={index}>
                      <line
                        x1={paddingLeft}
                        y1={y}
                        x2={width - paddingRight}
                        y2={y}
                        stroke="#f1f5f9"
                        strokeWidth="1"
                        strokeDasharray={index === 0 || index === 4 ? "0" : "4 4"}
                      />
                      <text
                        x={paddingLeft - 12}
                        y={y + 4}
                        fill="#94a3b8"
                        fontSize="10"
                        fontFamily="monospace"
                        textAnchor="end"
                      >
                        {new Intl.NumberFormat("en-IN", {
                          notation: "compact",
                          maximumFractionDigits: 1,
                        }).format(val)}
                      </text>
                    </g>
                  );
                })}

                {/* X-axis date labels */}
                {dailyPoints.map((p, i) => {
                  // Print approx 6-7 labels evenly spaced
                  const totalCount = dailyPoints.length;
                  const step = Math.ceil(totalCount / 6);
                  if (i % step === 0 || i === totalCount - 1) {
                    const x = getX(i);
                    return (
                      <g key={i}>
                        <line
                          x1={x}
                          y1={height - paddingBottom}
                          x2={x}
                          y2={height - paddingBottom + 4}
                          stroke="#cbd5e1"
                        />
                        <text
                          x={x}
                          y={height - paddingBottom + 18}
                          fill="#94a3b8"
                          fontSize="9"
                          fontFamily="sans-serif"
                          textAnchor="middle"
                        >
                          {formatLabel(p.date)}
                        </text>
                      </g>
                    );
                  }
                  return null;
                })}

                {/* Shaded Area */}
                {areaD && (
                  <path
                    d={areaD}
                    fill="url(#indigo-gradient)"
                    opacity="0.1"
                  />
                )}

                {/* Main Trend Line */}
                {pathD && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#4f46e5"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Interaction dot & highlights on extreme points */}
                {dailyPoints.length > 0 && (
                  <>
                    <circle
                      cx={getX(dailyPoints.length - 1)}
                      cy={getY(dailyPoints[dailyPoints.length - 1].balance)}
                      r="4"
                      fill="#4f46e5"
                      stroke="#fff"
                      strokeWidth="2"
                    />
                  </>
                )}

                {/* Gradients */}
                <defs>
                  <linearGradient id="indigo-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="flex justify-center items-center gap-6 mt-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-0.5 bg-indigo-600 rounded"></span>
                Running Account Balance (INR)
              </span>
              <span>•</span>
              <span>Min: {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(minBalance)}</span>
              <span>•</span>
              <span>Max: {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(maxBalance)}</span>
            </div>
          </div>
        ) : (
          <div>
            {/* Daily Inflow / Outflow Bar Chart */}
            <div className="relative overflow-x-auto">
              <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible min-w-[650px]">
                {/* Horizontal grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                  const val = ratio * maxFlow;
                  const y = height - paddingBottom - ratio * chartHeight;
                  return (
                    <g key={index}>
                      <line
                        x1={paddingLeft}
                        y1={y}
                        x2={width - paddingRight}
                        y2={y}
                        stroke="#f1f5f9"
                        strokeWidth="1"
                        strokeDasharray={index === 0 || index === 4 ? "0" : "4 4"}
                      />
                      <text
                        x={paddingLeft - 12}
                        y={y + 4}
                        fill="#94a3b8"
                        fontSize="10"
                        fontFamily="monospace"
                        textAnchor="end"
                      >
                        {new Intl.NumberFormat("en-IN", {
                          notation: "compact",
                          maximumFractionDigits: 1,
                        }).format(val)}
                      </text>
                    </g>
                  );
                })}

                {/* Draw side-by-side bars for Debit (Rose) and Credit (Emerald) */}
                {dailyPoints.map((p, i) => {
                  const groupWidth = chartWidth / dailyPoints.length;
                  const startX = paddingLeft + i * groupWidth + groupWidth * 0.15;
                  const barWidth = groupWidth * 0.35;

                  const debitRatio = p.debit / maxFlow;
                  const creditRatio = p.credit / maxFlow;

                  const debitHeight = debitRatio * chartHeight;
                  const creditHeight = creditRatio * chartHeight;

                  const debitY = height - paddingBottom - debitHeight;
                  const creditY = height - paddingBottom - creditHeight;

                  return (
                    <g key={i}>
                      {/* Debit Bar */}
                      {p.debit > 0 && (
                        <rect
                          x={startX}
                          y={debitY}
                          width={barWidth}
                          height={debitHeight}
                          fill="#f43f5e"
                          rx="2"
                          opacity="0.85"
                        />
                      )}
                      {/* Credit Bar */}
                      {p.credit > 0 && (
                        <rect
                          x={startX + barWidth + groupWidth * 0.05}
                          y={creditY}
                          width={barWidth}
                          height={creditHeight}
                          fill="#10b981"
                          rx="2"
                          opacity="0.85"
                        />
                      )}
                    </g>
                  );
                })}

                {/* X-axis date labels */}
                {dailyPoints.map((p, i) => {
                  const totalCount = dailyPoints.length;
                  const step = Math.ceil(totalCount / 6);
                  if (i % step === 0 || i === totalCount - 1) {
                    const groupWidth = chartWidth / dailyPoints.length;
                    const x = paddingLeft + i * groupWidth + groupWidth / 2;
                    return (
                      <g key={i}>
                        <line
                          x1={x}
                          y1={height - paddingBottom}
                          x2={x}
                          y2={height - paddingBottom + 4}
                          stroke="#cbd5e1"
                        />
                        <text
                          x={x}
                          y={height - paddingBottom + 18}
                          fill="#94a3b8"
                          fontSize="9"
                          fontFamily="sans-serif"
                          textAnchor="middle"
                        >
                          {formatLabel(p.date)}
                        </text>
                      </g>
                    );
                  }
                  return null;
                })}
              </svg>
            </div>
            <div className="flex justify-center items-center gap-6 mt-2 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 bg-rose-500 rounded-sm"></span>
                Withdrawals (Debits)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 bg-emerald-500 rounded-sm"></span>
                Deposits (Credits)
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
