import { db } from '@/lib/firebase';
import { OfflineQueue, QueuedOperation } from '@/lib/offline-queue';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  updateDoc
} from 'firebase/firestore';
import Toast from 'react-native-toast-message';

export class SyncService {
  /**
   * Process queued operations and sync with Firestore
   */
  static async syncOperations(): Promise<{ success: number; failed: number }> {
    try {
      const operations = await OfflineQueue.getPendingOperations();

      if (operations.length === 0) {
        return { success: 0, failed: 0 };
      }

      let successCount = 0;
      let failedCount = 0;

      for (const operation of operations) {
        try {
          await this.processOperation(operation);
          await OfflineQueue.removeOperation(operation.id);
          successCount++;
        } catch (e) {
          console.error(`Failed to sync operation ${operation.id}`, e);
          await OfflineQueue.updateOperationStatus(
            operation.id,
            'failed',
            (e as Error).message
          );
          failedCount++;
        }
      }

      // Show summary toast
      if (successCount > 0) {
        Toast.show({
          type: 'success',
          text1: 'Sync complete',
          text2: `${successCount} change${successCount > 1 ? 's' : ''} synced successfully`,
        });
      }

      if (failedCount > 0) {
        Toast.show({
          type: 'error',
          text1: 'Sync failed',
          text2: `${failedCount} change${failedCount > 1 ? 's' : ''} failed to sync. Will retry later.`,
        });
      }

      return { success: successCount, failed: failedCount };
    } catch (e) {
      console.error('Sync error', e);
      Toast.show({
        type: 'error',
        text1: 'Sync error',
        text2: 'Failed to sync changes',
      });
      return { success: 0, failed: 0 };
    }
  }

  /**
   * Process individual operation
   */
  private static async processOperation(operation: QueuedOperation): Promise<void> {
    const { type, collection: collName, docId, data } = operation;

    switch (type) {
      case 'create':
        // For creates, generate new doc ID if temp ID
        if (docId.startsWith('temp_')) {
          await addDoc(collection(db, collName), data);
        } else {
          await addDoc(collection(db, collName), { ...data, id: docId });
        }
        break;

      case 'update':
        await updateDoc(doc(db, collName, docId), data);
        break;

      case 'delete':
        await deleteDoc(doc(db, collName, docId));
        break;

      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  }

  /**
   * Get sync status summary
   */
  static async getSyncSummary(): Promise<{
    totalPending: number;
    totalFailed: number;
    byCollection: Record<string, number>;
  }> {
    const queue = await OfflineQueue.getQueue();

    const byCollection: Record<string, number> = {};
    let totalFailed = 0;

    queue.forEach((op) => {
      byCollection[op.collection] = (byCollection[op.collection] || 0) + 1;
      if (op.status === 'failed') totalFailed++;
    });

    return {
      totalPending: queue.length,
      totalFailed,
      byCollection,
    };
  }

  /**
   * Clear failed operations (optional - for manual retry)
   */
  static async retryFailedOperations(): Promise<{ success: number; failed: number }> {
    const queue = await OfflineQueue.getQueue();
    const failedOps = queue.filter((op) => op.status === 'failed');

    if (failedOps.length === 0) {
      return { success: 0, failed: 0 };
    }

    // Reset all failed to pending
    for (const op of failedOps) {
      await OfflineQueue.updateOperationStatus(op.id, 'pending');
    }

    // Sync again
    return this.syncOperations();
  }
}
