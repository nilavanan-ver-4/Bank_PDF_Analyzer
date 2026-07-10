import React, { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Transaction, StatementMetadata } from "../types";
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  FileSpreadsheet,
  FileText,
  Sheet,
  ArrowUpDown,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  PlusCircle,
} from "lucide-react";

interface Props {
  transactions: Transaction[];
  metadata?: StatementMetadata;
  onUpdateTransaction: (updatedTx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onAddTransaction: (newTx: Omit<Transaction, "id">) => void;
}

export default function TransactionTable({
  transactions,
  metadata,
  onUpdateTransaction,
  onDeleteTransaction,
  onAddTransaction,
}: Props) {
  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "debit" | "credit">("all");
  
  // Sorting State
  const [sortField, setSortField] = useState<"date" | "balance" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Inline Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Transaction | null>(null);

  // Column Visibility State
  const [showColumns, setShowColumns] = useState({
    date: true,
    description: true,
    reference: true,
    debit: true,
    credit: true,
    balance: true,
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Add Transaction Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTxData, setNewTxData] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    reference: "",
    debit: "",
    credit: "",
    balance: "",
  });

  const [notification, setNotification] = useState<string | null>(null);

  // Sort and Filter logic
  const filteredTransactions = transactions
    .filter((tx) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        tx.description.toLowerCase().includes(term) ||
        tx.date.includes(term) ||
        tx.reference.toLowerCase().includes(term) ||
        (tx.debit && String(tx.debit).includes(term)) ||
        (tx.credit && String(tx.credit).includes(term)) ||
        String(tx.balance).includes(term);

      if (filterType === "debit") {
        return matchesSearch && tx.debit !== null;
      }
      if (filterType === "credit") {
        return matchesSearch && tx.credit !== null;
      }
      return matchesSearch;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === "date") {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortField === "balance") {
        comparison = a.balance - b.balance;
      } else if (sortField === "amount") {
        const valA = a.debit || a.credit || 0;
        const valB = b.debit || b.credit || 0;
        comparison = valA - valB;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  // Pagination Math
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage) || 1;
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: "date" | "balance" | "amount") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // CSV Generation Utility
  const generateCSV = (): string => {
    const headers = ["Date", "Particulars/Description", "Reference No", "Debit (Withdrawal)", "Credit (Deposit)", "Balance"];
    const rows = transactions.map((tx) => [
      tx.date,
      `"${tx.description.replace(/"/g, '""')}"`,
      tx.reference ? `"${tx.reference.replace(/"/g, '""')}"` : "",
      tx.debit !== null ? tx.debit : "",
      tx.credit !== null ? tx.credit : "",
      tx.balance,
    ]);
    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  };

  const downloadCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," + generateCSV();
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bank_statement_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("CSV file successfully generated and downloaded!");
  };

  const copyCSVToClipboard = () => {
    const csvText = generateCSV();
    navigator.clipboard.writeText(csvText);
    showToast("CSV data copied to clipboard!");
  };

  // PDF Generation Utility
  const downloadPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Bank Statement", 14, 16);

    if (metadata) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const infoLines = [
        `Account Holder: ${metadata.accountHolder}`,
        `Account Number: ${metadata.accountNumber}`,
        `Period: ${metadata.period}`,
        `Opening Balance: ${metadata.openingBalance.toFixed(2)}    Closing Balance: ${metadata.closingBalance.toFixed(2)}`,
      ];
      infoLines.forEach((line, i) => doc.text(line, 14, 23 + i * 5));
    }

    const startY = metadata ? 23 + 4 * 5 + 3 : 22;
    const headers = [["Date", "Description", "Reference", "Debit", "Credit", "Balance"]];
    const rows = transactions.map((tx) => [
      tx.date,
      tx.description,
      tx.reference || "",
      tx.debit !== null ? tx.debit.toFixed(2) : "",
      tx.credit !== null ? tx.credit.toFixed(2) : "",
      tx.balance.toFixed(2),
    ]);

    autoTable(doc, {
      startY,
      head: headers,
      body: rows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42] },
      columnStyles: {
        3: { halign: "right" },
        4: { halign: "right" },
        5: { halign: "right" },
      },
    });

    doc.save(`bank_statement_${new Date().toISOString().split("T")[0]}.pdf`);
    showToast("PDF file successfully generated and downloaded!");
  };

  // Excel Generation Utility
  const downloadExcel = () => {
    const headers = ["Date", "Particulars/Description", "Reference No", "Debit (Withdrawal)", "Credit (Deposit)", "Balance"];
    const rows = transactions.map((tx) => [
      tx.date,
      tx.description,
      tx.reference || "",
      tx.debit !== null ? tx.debit : "",
      tx.credit !== null ? tx.credit : "",
      tx.balance,
    ]);

    const sheetData: (string | number)[][] = [];
    if (metadata) {
      sheetData.push(["Account Holder", metadata.accountHolder]);
      sheetData.push(["Account Number", metadata.accountNumber]);
      sheetData.push(["Period", metadata.period]);
      sheetData.push(["Opening Balance", metadata.openingBalance]);
      sheetData.push(["Closing Balance", metadata.closingBalance]);
      sheetData.push([]);
    }
    sheetData.push(headers);
    sheetData.push(...rows);

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    worksheet["!cols"] = [
      { wch: 12 },
      { wch: 40 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
    XLSX.writeFile(workbook, `bank_statement_${new Date().toISOString().split("T")[0]}.xlsx`);

    showToast("Excel file successfully generated and downloaded!");
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  // Editing logic
  const startEditing = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditFormData({ ...tx });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditFormData(null);
  };

  const saveEdit = () => {
    if (editFormData) {
      onUpdateTransaction(editFormData);
      setEditingId(null);
      setEditFormData(null);
      showToast("Transaction successfully updated.");
    }
  };

  const handleEditChange = (field: keyof Transaction, value: any) => {
    if (editFormData) {
      setEditFormData({
        ...editFormData,
        [field]: value,
      });
    }
  };

  // Adding transaction logic
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTxData.description) return;

    onAddTransaction({
      date: newTxData.date,
      description: newTxData.description,
      reference: newTxData.reference,
      debit: newTxData.debit ? parseFloat(newTxData.debit) : null,
      credit: newTxData.credit ? parseFloat(newTxData.credit) : null,
      balance: parseFloat(newTxData.balance) || 0,
    });

    setNewTxData({
      date: new Date().toISOString().split("T")[0],
      description: "",
      reference: "",
      debit: "",
      credit: "",
      balance: "",
    });
    setShowAddForm(false);
    showToast("Transaction successfully added.");
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return "-";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 z-50 animate-fade-in">
          <Check className="h-4 w-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Control Toolbar */}
      <div className="p-5 border-b border-slate-50 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by details, date, or amount..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-100 focus:border-indigo-500 rounded-xl outline-none transition-all"
            />
          </div>

          {/* Type filters */}
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
            {(["all", "debit", "credit"] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setFilterType(type);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                  filterType === type
                    ? "bg-white text-indigo-600 shadow-xs border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {type === "all" ? "All Activity" : type === "debit" ? "Withdrawals" : "Deposits"}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Add Manual Transaction */}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-all"
          >
            <Plus className="h-4 w-4" />
            Add Transaction
          </button>

          {/* Column toggles */}
          <div className="relative">
            <button
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all border border-slate-100"
            >
              <SlidersHorizontal className="h-4 w-4 text-slate-400" />
              Columns
            </button>
            {showColumnDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-lg p-3 z-30 flex flex-col gap-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Visible Columns</p>
                {Object.keys(showColumns).map((col) => (
                  <label key={col} className="flex items-center gap-2.5 text-xs font-medium text-slate-600 cursor-pointer hover:text-slate-900">
                    <input
                      type="checkbox"
                      checked={showColumns[col as keyof typeof showColumns]}
                      onChange={() =>
                        setShowColumns({
                          ...showColumns,
                          [col]: !showColumns[col as keyof typeof showColumns],
                        })
                      }
                      className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span className="capitalize">{col === "debit" ? "Withdrawal" : col === "credit" ? "Deposit" : col}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Copy CSV */}
          <button
            onClick={copyCSVToClipboard}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all border border-slate-100"
          >
            <ClipboardCopy className="h-4 w-4 text-slate-400" />
            Copy CSV
          </button>

          {/* Export CSV button */}
          <button
            onClick={downloadCSV}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all shadow-sm"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export CSV
          </button>

          {/* Export PDF button */}
          <button
            onClick={downloadPDF}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm"
          >
            <FileText className="h-4 w-4" />
            Export PDF
          </button>

          {/* Export Excel button */}
          <button
            onClick={downloadExcel}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm"
          >
            <Sheet className="h-4 w-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Inline Form to Add Transaction */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="p-5 bg-slate-50/50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 animate-fade-in">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date</label>
            <input
              type="date"
              required
              value={newTxData.date}
              onChange={(e) => setNewTxData({ ...newTxData, date: e.target.value })}
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 focus:border-indigo-500 rounded-lg outline-none"
            />
          </div>
          <div className="flex flex-col gap-1 lg:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Description/Particulars</label>
            <input
              type="text"
              placeholder="e.g. UPI/P2A/..."
              required
              value={newTxData.description}
              onChange={(e) => setNewTxData({ ...newTxData, description: e.target.value })}
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 focus:border-indigo-500 rounded-lg outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Debit (Withdrawal)</label>
            <input
              type="number"
              step="0.01"
              placeholder="Leave empty if none"
              value={newTxData.debit}
              onChange={(e) => setNewTxData({ ...newTxData, debit: e.target.value, credit: "" })}
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 focus:border-indigo-500 rounded-lg outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Credit (Deposit)</label>
            <input
              type="number"
              step="0.01"
              placeholder="Leave empty if none"
              value={newTxData.credit}
              onChange={(e) => setNewTxData({ ...newTxData, credit: e.target.value, debit: "" })}
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 focus:border-indigo-500 rounded-lg outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">New Balance</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="INR"
                required
                value={newTxData.balance}
                onChange={(e) => setNewTxData({ ...newTxData, balance: e.target.value })}
                className="px-3 py-1.5 text-xs bg-white border border-slate-200 focus:border-indigo-500 rounded-lg outline-none flex-1"
              />
              <button
                type="submit"
                className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Main Table View */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-50 bg-slate-50/70 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
              {showColumns.date && (
                <th className="py-3 px-5 cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort("date")}>
                  <div className="flex items-center gap-1">
                    Date
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              )}
              {showColumns.description && <th className="py-3 px-5">Particulars / Description</th>}
              {showColumns.reference && <th className="py-3 px-5">Ref No</th>}
              {showColumns.debit && (
                <th className="py-3 px-5 text-right cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort("amount")}>
                  <div className="flex items-center gap-1 justify-end">
                    Withdrawal (Debit)
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              )}
              {showColumns.credit && (
                <th className="py-3 px-5 text-right cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort("amount")}>
                  <div className="flex items-center gap-1 justify-end">
                    Deposit (Credit)
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              )}
              {showColumns.balance && (
                <th className="py-3 px-5 text-right cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort("balance")}>
                  <div className="flex items-center gap-1 justify-end">
                    Balance
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              )}
              <th className="py-3 px-5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
            {paginatedTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400 bg-slate-50/20 font-medium">
                  No matching transactions found.
                </td>
              </tr>
            ) : (
              paginatedTransactions.map((tx) => {
                const isEditing = editingId === tx.id;

                return (
                  <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors group">
                    {/* Date */}
                    {showColumns.date && (
                      <td className="py-3.5 px-5 font-mono whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editFormData?.date || ""}
                            onChange={(e) => handleEditChange("date", e.target.value)}
                            className="px-2 py-1 border border-slate-200 rounded text-xs outline-none focus:border-indigo-500 w-28 font-mono bg-white"
                          />
                        ) : (
                          tx.date
                        )}
                      </td>
                    )}

                    {/* Description */}
                    {showColumns.description && (
                      <td className="py-3.5 px-5 font-medium text-slate-800 break-words max-w-[320px]">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editFormData?.description || ""}
                            onChange={(e) => handleEditChange("description", e.target.value)}
                            className="px-2 py-1 border border-slate-200 rounded text-xs outline-none focus:border-indigo-500 w-full bg-white"
                          />
                        ) : (
                          <span className="line-clamp-2" title={tx.description}>
                            {tx.description}
                          </span>
                        )}
                      </td>
                    )}

                    {/* Reference */}
                    {showColumns.reference && (
                      <td className="py-3.5 px-5 font-mono text-slate-400 text-[11px] whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editFormData?.reference || ""}
                            onChange={(e) => handleEditChange("reference", e.target.value)}
                            className="px-2 py-1 border border-slate-200 rounded text-[11px] outline-none focus:border-indigo-500 w-24 font-mono bg-white"
                          />
                        ) : (
                          tx.reference || "-"
                        )}
                      </td>
                    )}

                    {/* Debit */}
                    {showColumns.debit && (
                      <td className="py-3.5 px-5 text-right font-mono text-rose-600 font-semibold whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData?.debit === null ? "" : editFormData?.debit}
                            onChange={(e) =>
                              handleEditChange("debit", e.target.value === "" ? null : parseFloat(e.target.value))
                            }
                            placeholder="Debit"
                            className="px-2 py-1 border border-slate-200 rounded text-xs outline-none focus:border-indigo-500 w-20 text-right bg-white"
                          />
                        ) : (
                          formatCurrency(tx.debit)
                        )}
                      </td>
                    )}

                    {/* Credit */}
                    {showColumns.credit && (
                      <td className="py-3.5 px-5 text-right font-mono text-emerald-600 font-semibold whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData?.credit === null ? "" : editFormData?.credit}
                            onChange={(e) =>
                              handleEditChange("credit", e.target.value === "" ? null : parseFloat(e.target.value))
                            }
                            placeholder="Credit"
                            className="px-2 py-1 border border-slate-200 rounded text-xs outline-none focus:border-indigo-500 w-20 text-right bg-white"
                          />
                        ) : (
                          formatCurrency(tx.credit)
                        )}
                      </td>
                    )}

                    {/* Balance */}
                    {showColumns.balance && (
                      <td className="py-3.5 px-5 text-right font-mono text-slate-800 font-bold whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editFormData?.balance || ""}
                            onChange={(e) => handleEditChange("balance", parseFloat(e.target.value) || 0)}
                            className="px-2 py-1 border border-slate-200 rounded text-xs outline-none focus:border-indigo-500 w-24 text-right bg-white font-mono"
                          />
                        ) : (
                          formatCurrency(tx.balance)
                        )}
                      </td>
                    )}

                    {/* Action Operations */}
                    <td className="py-3.5 px-5 text-center whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={saveEdit}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            title="Save changes"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors"
                            title="Cancel editing"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEditing(tx)}
                            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                            title="Edit row"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this transaction record?")) {
                                onDeleteTransaction(tx.id);
                                showToast("Transaction deleted.");
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Delete row"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="p-4 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between text-xs text-slate-500 font-medium">
        <span>
          Showing {filteredTransactions.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to{" "}
          {Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length}{" "}
          transactions
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-slate-200/50 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-3 py-1 bg-white border border-slate-200/50 rounded-lg">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-slate-200/50 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
