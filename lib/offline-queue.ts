import AsyncStorage from '@react-native-async-storage/async-storage';

export interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  collection: string;
  docId: string;
  data: any;
  createdAt: string;
  status: 'pending' | 'syncing' | 'failed';
  errorMessage?: string;
  retryCount: number;
}

const QUEUE_KEY = 'offline_operations_queue';
const SYNC_STATUS_KEY = 'sync_status';

export class OfflineQueue {
  /**
   * Add operation to queue
   */
  static async addOperation(
    type: 'create' | 'update' | 'delete',
    collection: string,
    docId: string,
    data: any
  ): Promise<string> {
    try {
      const queue = await this.getQueue();
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const operation: QueuedOperation = {
        id,
        type,
        collection,
        docId,
        data,
        createdAt: new Date().toISOString(),
        status: 'pending',
        retryCount: 0,
      };

      queue.push(operation);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

      // Emit event for UI updates
      this.notifyQueueChanged();

      return id;
    } catch (e) {
      console.error('Failed to add operation to queue', e);
      throw e;
    }
  }

  /**
   * Get all queued operations
   */
  static async getQueue(): Promise<QueuedOperation[]> {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to get queue', e);
      return [];
    }
  }

  /**
   * Get pending operations only
   */
  static async getPendingOperations(): Promise<QueuedOperation[]> {
    const queue = await this.getQueue();
    return queue.filter((op) => op.status === 'pending' || op.status === 'failed');
  }

  /**
   * Update operation status
   */
  static async updateOperationStatus(
    id: string,
    status: 'pending' | 'syncing' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    try {
      const queue = await this.getQueue();
      const op = queue.find((o) => o.id === id);

      if (op) {
        op.status = status;
        if (errorMessage) op.errorMessage = errorMessage;
        if (status === 'failed') op.retryCount += 1;

        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        this.notifyQueueChanged();
      }
    } catch (e) {
      console.error('Failed to update operation status', e);
    }
  }

  /**
   * Remove operation from queue after successful sync
   */
  static async removeOperation(id: string): Promise<void> {
    try {
      const queue = await this.getQueue();
      const filtered = queue.filter((o) => o.id !== id);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
      this.notifyQueueChanged();
    } catch (e) {
      console.error('Failed to remove operation', e);
    }
  }

  /**
   * Clear all queued operations
   */
  static async clearQueue(): Promise<void> {
    try {
      await AsyncStorage.removeItem(QUEUE_KEY);
      this.notifyQueueChanged();
    } catch (e) {
      console.error('Failed to clear queue', e);
    }
  }

  /**
   * Get sync status
   */
  static async getSyncStatus(): Promise<{
    isSyncing: boolean;
    pendingCount: number;
    lastSyncTime?: string;
  }> {
    try {
      const stored = await AsyncStorage.getItem(SYNC_STATUS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      return { isSyncing: false, pendingCount: 0 };
    } catch (e) {
      return { isSyncing: false, pendingCount: 0 };
    }
  }

  /**
   * Set sync status
   */
  static async setSyncStatus(
    isSyncing: boolean,
    pendingCount: number,
    lastSyncTime?: string
  ): Promise<void> {
    try {
      const status = { isSyncing, pendingCount, lastSyncTime };
      await AsyncStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(status));
      this.notifyQueueChanged();
    } catch (e) {
      console.error('Failed to set sync status', e);
    }
  }

  /**
   * Global queue change listeners
   */
  private static listeners: Set<() => void> = new Set();

  static onQueueChange(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private static notifyQueueChanged(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (e) {
        console.error('Error in queue listener', e);
      }
    });
  }
}
