import { auth, db } from '@/lib/firebase';
import { OfflineQueue } from '@/lib/offline-queue';
import { Transaction } from '@/types/models';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  updateDoc
} from 'firebase/firestore';
import Toast from 'react-native-toast-message';

export class OfflineTransactionService {
  /**
   * Add transaction with offline support
   */
  static async addTransaction(transactionData: Partial<Transaction>) {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('User not authenticated');

      const data = {
        ...transactionData,
        userId: uid,
        createdAt: new Date().toISOString(),
      };

      try {
        // Try online first
        const docRef = await addDoc(collection(db, 'transactions'), data);
        Toast.show({
          type: 'success',
          text1: 'Transaction saved',
          text2: 'Your transaction is synced',
        });
        return docRef.id;
      } catch (e) {
        // Fall back to offline queue
        console.log('Failed to save online, queuing offline', e);
        const id = await OfflineQueue.addOperation(
          'create',
          'transactions',
          `temp_${Date.now()}`,
          data
        );

        Toast.show({
          type: 'info',
          text1: 'Offline mode',
          text2: 'Transaction saved locally and will sync when online',
        });

        return id;
      }
    } catch (e) {
      console.error('Failed to add transaction', e);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save transaction',
      });
      throw e;
    }
  }

  /**
   * Update transaction with offline support
   */
  static async updateTransaction(
    transactionId: string,
    updates: Partial<Transaction>
  ) {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('User not authenticated');

      try {
        // Try online first
        await updateDoc(doc(db, 'transactions', transactionId), updates);
        Toast.show({
          type: 'success',
          text1: 'Updated',
          text2: 'Changes synced',
        });
      } catch (e) {
        // Fall back to offline queue
        console.log('Failed to update online, queuing offline', e);
        await OfflineQueue.addOperation(
          'update',
          'transactions',
          transactionId,
          updates
        );

        Toast.show({
          type: 'info',
          text1: 'Offline mode',
          text2: 'Changes saved locally and will sync when online',
        });
      }
    } catch (e) {
      console.error('Failed to update transaction', e);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update transaction',
      });
      throw e;
    }
  }

  /**
   * Delete transaction with offline support
   */
  static async deleteTransaction(transactionId: string) {
    try {
      try {
        // Try online first
        await deleteDoc(doc(db, 'transactions', transactionId));
        Toast.show({
          type: 'success',
          text1: 'Deleted',
          text2: 'Transaction removed',
        });
      } catch (e) {
        // Fall back to offline queue
        console.log('Failed to delete online, queuing offline', e);
        await OfflineQueue.addOperation(
          'delete',
          'transactions',
          transactionId,
          {}
        );

        Toast.show({
          type: 'info',
          text1: 'Offline mode',
          text2: 'Deletion queued and will sync when online',
        });
      }
    } catch (e) {
      console.error('Failed to delete transaction', e);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete transaction',
      });
      throw e;
    }
  }
}
