export interface Transaction {
  id: string;
  date: string;
  description: string;
  reference: string;
  debit: number | null;
  credit: number | null;
  balance: number;
}

export interface StatementMetadata {
  accountHolder: string;
  accountNumber: string;
  period: string;
  openingBalance: number;
  closingBalance: number;
}
