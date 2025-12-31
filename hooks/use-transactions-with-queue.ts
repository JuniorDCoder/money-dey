import { OfflineQueue, QueuedOperation } from '@/lib/offline-queue';
import { Transaction } from '@/types/models';
import { useEffect, useMemo, useState } from 'react';
import { useTransactions } from './use-transactions';

export function useTransactionsWithQueue(opts?: { userId?: string; limit?: number; useMock?: boolean }) {
  // useTransactions uses Firestore onSnapshot which works offline with cached data
  const { transactions, loading, refetch, aggregates } = useTransactions(opts);
  const [queuedOperations, setQueuedOperations] = useState<QueuedOperation[]>([]);

  useEffect(() => {
    const loadQueue = async () => {
      try {
        const ops = await OfflineQueue.getPendingOperations();
        const txOps = ops.filter((op) => op.collection === 'transactions');
        setQueuedOperations(txOps);
      } catch (e) {
        console.error('Failed to load queued transactions', e);
      }
    };

    loadQueue();

    // Subscribe to queue changes (works both online and offline)
    const unsubscribe = OfflineQueue.onQueueChange(loadQueue);
    return () => unsubscribe();
  }, []);

  // Merge Firestore transactions with queued creates, filter out updates/deletes to already-synced items
  const mergedTransactions = useMemo(() => {
    const txMap: Record<string, Transaction> = {};

    // Add Firestore transactions
    transactions.forEach((tx) => {
      txMap[tx.id] = { ...tx, synced: true };
    });

    // Apply queued operations (creates, updates, deletes)
    queuedOperations.forEach((op) => {
      if (op.type === 'create') {
        // New transaction from queue
        txMap[op.id] = {
          id: op.id,
          ...op.data,
          synced: false,
        } as Transaction;
      } else if (op.type === 'update') {
        // Update existing transaction
        if (txMap[op.docId]) {
          txMap[op.docId] = {
            ...txMap[op.docId],
            ...op.data,
            synced: false,
          };
        }
      } else if (op.type === 'delete') {
        // Mark as deleted (don't show in list)
        delete txMap[op.docId];
      }
    });

    return Object.values(txMap);
  }, [transactions, queuedOperations]);

  // Recalculate aggregates with merged data
  const mergedAggregates = useMemo(() => {
    const agg = { income: 0, expense: 0, debt: 0, repayment: 0 } as Record<string, number>;
    mergedTransactions.forEach((t) => {
      const type = (t as any).type;
      if (type === 'income' || type === 'expense' || type === 'debt' || type === 'repayment') {
        agg[type] = (agg[type] || 0) + Number((t as any).amount || 0);
      }
    });
    return agg;
  }, [mergedTransactions]);

  return {
    transactions: mergedTransactions,
    loading,
    refetch,
    aggregates: mergedAggregates,
  };
}
