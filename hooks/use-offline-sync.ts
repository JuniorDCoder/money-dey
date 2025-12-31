import { useNetworkStatus } from '@/hooks/use-network-status';
import { OfflineQueue, QueuedOperation } from '@/lib/offline-queue';
import { useCallback, useEffect, useState } from 'react';

export interface SyncState {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime?: string;
  failedCount: number;
}

export function useOfflineSync(onSync?: (operations: QueuedOperation[]) => Promise<void>) {
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    pendingCount: 0,
    failedCount: 0,
  });

  const { isOnline } = useNetworkStatus();

  // Update pending count on mount and when queue changes
  useEffect(() => {
    const updatePendingCount = async () => {
      try {
        const queue = await OfflineQueue.getQueue();
        const failedCount = queue.filter((op) => op.status === 'failed').length;
        setSyncState((prev) => ({
          ...prev,
          pendingCount: queue.length,
          failedCount,
        }));
      } catch (e) {
        console.error('Failed to update pending count', e);
      }
    };

    updatePendingCount();

    const unsubscribe = OfflineQueue.onQueueChange(updatePendingCount);
    return () => unsubscribe();
  }, []);

  // Auto-sync when coming back online
  const performSync = useCallback(async () => {
    if (!isOnline || syncState.isSyncing) return;

    try {
      setSyncState((prev) => ({ ...prev, isSyncing: true }));

      const operations = await OfflineQueue.getPendingOperations();

      if (operations.length === 0) {
        setSyncState((prev) => ({
          ...prev,
          isSyncing: false,
          lastSyncTime: new Date().toISOString(),
        }));
        return;
      }

      if (onSync) {
        await onSync(operations);
      }

      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date().toISOString(),
      }));
    } catch (e) {
      console.error('Sync failed', e);
      setSyncState((prev) => ({ ...prev, isSyncing: false }));
    }
  }, [isOnline, syncState.isSyncing, onSync]);

  // Auto-sync when online
  useEffect(() => {
    if (isOnline && !syncState.isSyncing) {
      const timer = setTimeout(performSync, 500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, syncState.isSyncing, performSync]);

  return {
    ...syncState,
    isOnline,
    performSync,
  };
}
