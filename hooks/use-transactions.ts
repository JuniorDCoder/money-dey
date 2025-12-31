import { db } from '@/lib/firebase';
import { Transaction } from '@/types/models';
import { collection, limit as fbLimit, getDocs, orderBy, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useMemo, useState } from 'react';

// Simple mock loader for local development
async function loadMockTransactions(userId?: string): Promise<Transaction[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const data = require('../assets/mock-data/transactions.json') as Transaction[];
    const filtered = userId ? data.filter((d) => d.userId === userId) : data;
    // Ensure dates are ISO strings
    return filtered.map((d) => ({ ...d, date: new Date(d.date).toISOString() })) as Transaction[];
  } catch (e) {
    console.warn('Failed to load mock transactions', e);
    return [];
  }
}

export function useTransactions(opts?: { userId?: string; limit?: number; useMock?: boolean }) {
  const { userId, limit = 100, useMock = true } = opts || {};
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let docs: Transaction[] = [];
      if (useMock) {
        docs = await loadMockTransactions(userId);
      } else {
        const col = collection(db, 'transactions');
        const q = query(
          col,
          ...(userId ? [where('userId', '==', userId)] : []),
          orderBy('date', 'desc'),
          fbLimit(limit)
        );
        const snap = await getDocs(q);
        docs = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            amount: typeof data.amount === 'number' ? data.amount : Number(data.amount || 0),
            type: data.type || 'expense',
            category: data.category || 'Misc',
            notes: data.notes || data.note || '',
            date: data.date && data.date.toDate ? data.date.toDate().toISOString() : (data.date ? new Date(data.date).toISOString() : new Date().toISOString()),
            createdAt: data.createdAt || data.created_at || null,
            counterpartyName: data.counterpartyName || data.counterparty || undefined,
            debtId: data.debtId || data.debt_id || undefined,
            direction: data.direction,
          } as Transaction;
        });
      }

      setTransactions(docs);
    } catch (e: any) {
      setError(e);
      console.warn('Failed to fetch transactions', e);
    } finally {
      setLoading(false);
    }
  }, [userId, limit, useMock]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const aggregates = useMemo(() => {
    const agg = { income: 0, expense: 0, debt: 0, repayment: 0 } as Record<string, number>;
    transactions.forEach((t) => {
      const amt = Number(t.amount || 0);
      if (t.type === 'income') agg.income += amt;
      else if (t.type === 'expense') agg.expense += amt;
      else if (t.type === 'debt') agg.debt += amt;
      else if (t.type === 'repayment') agg.repayment += amt;
    });
    return {
      income: agg.income,
      expense: agg.expense,
      debt: agg.debt,
      repayment: agg.repayment,
      net: agg.income - agg.expense - agg.debt + agg.repayment,
    };
  }, [transactions]);

  const groupByMonth = useCallback((months = 6) => {
    // Return last `months` months labels and arrays for income and expense
    const now = new Date();
    const labels: string[] = [];
    const incomeSeries: number[] = [];
    const expenseSeries: number[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString(undefined, { month: 'short' });
      labels.push(label);
      const monthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
      const inc = transactions.filter((t) => new Date(t.date).getFullYear() === d.getFullYear() && new Date(t.date).getMonth() === d.getMonth() && t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
      const exp = transactions.filter((t) => new Date(t.date).getFullYear() === d.getFullYear() && new Date(t.date).getMonth() === d.getMonth() && t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
      incomeSeries.push(inc / 100); // convert to display currency scale (XAF) - keep in smaller units if needed
      expenseSeries.push(exp / 100);
    }

    return { labels, incomeSeries, expenseSeries };
  }, [transactions]);

  return {
    transactions,
    loading,
    error,
    refetch: fetch,
    aggregates,
    groupByMonth,
  };
}

