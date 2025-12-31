import { auth, db } from '@/lib/firebase';
import { OfflineQueue, QueuedOperation } from '@/lib/offline-queue';
import { Debt } from '@/types/models';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useNetworkStatus } from './use-network-status';

export function useDebtsWithQueue() {
  const { isOnline } = useNetworkStatus();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [queuedOperations, setQueuedOperations] = useState<QueuedOperation[]>([]);
  const [loading, setLoading] = useState(true);

  const uid = auth.currentUser?.uid;

  // Load Firestore debts (works offline with cached data)
  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'debts'), where('ownerId', '==', uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: Debt[] = [];
        snap.forEach((d) => items.push({ id: d.id, ...(d.data() as any) }));
        setDebts(items);
        setLoading(false);
      },
      (err) => {
        console.error('Debts snapshot error', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  // Load queued debt operations (works both online and offline)
  useEffect(() => {
    const loadQueue = async () => {
      try {
        const ops = await OfflineQueue.getPendingOperations();
        const debtOps = ops.filter((op) => op.collection === 'debts' || op.collection === 'repayments');
        setQueuedOperations(debtOps);
      } catch (e) {
        console.error('Failed to load queued debts', e);
      }
    };

    loadQueue();
    const unsubscribe = OfflineQueue.onQueueChange(loadQueue);
    return () => unsubscribe();
  }, []);

  // Merge Firestore debts with queued operations
  const mergedDebts = useMemo(() => {
    const debtMap: Record<string, Debt> = {};

    // Add Firestore debts
    debts.forEach((d) => {
      debtMap[d.id] = { ...d, synced: true };
    });

    // Apply queued operations
    queuedOperations.forEach((op) => {
      if (op.type === 'create') {
        debtMap[op.id] = {
          id: op.id,
          ...op.data,
          synced: false,
        } as Debt;
      } else if (op.type === 'update') {
        if (debtMap[op.docId]) {
          debtMap[op.docId] = {
            ...debtMap[op.docId],
            ...op.data,
            synced: false,
          };
        }
      } else if (op.type === 'delete') {
        delete debtMap[op.docId];
      }
    });

    return Object.values(debtMap);
  }, [debts, queuedOperations]);

  return {
    debts: mergedDebts,
    loading,
  };
}
