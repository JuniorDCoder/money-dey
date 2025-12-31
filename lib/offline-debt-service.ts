import { auth, db } from '@/lib/firebase';
import { OfflineQueue } from '@/lib/offline-queue';
import { Debt, Repayment } from '@/types/models';
import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import Toast from 'react-native-toast-message';

export class OfflineDebtService {
  /**
   * Add debt with offline support
   */
  static async addDebt(debtData: Partial<Debt>) {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('User not authenticated');

      const data = {
        ...debtData,
        ownerId: uid,
        createdAt: new Date().toISOString(),
      };

      try {
        const docRef = await addDoc(collection(db, 'debts'), data);
        Toast.show({
          type: 'success',
          text1: 'Debt recorded',
          text2: 'Your debt is synced',
        });
        return docRef.id;
      } catch (e) {
        console.log('Failed to save debt online, queuing offline', e);
        const id = await OfflineQueue.addOperation(
          'create',
          'debts',
          `temp_${Date.now()}`,
          data
        );

        Toast.show({
          type: 'info',
          text1: 'Offline mode',
          text2: 'Debt saved locally and will sync when online',
        });

        return id;
      }
    } catch (e) {
      console.error('Failed to add debt', e);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to record debt',
      });
      throw e;
    }
  }

  /**
   * Update debt with offline support
   */
  static async updateDebt(debtId: string, updates: Partial<Debt>) {
    try {
      try {
        await updateDoc(doc(db, 'debts', debtId), updates);
        Toast.show({
          type: 'success',
          text1: 'Updated',
          text2: 'Changes synced',
        });
      } catch (e) {
        console.log('Failed to update debt online, queuing offline', e);
        await OfflineQueue.addOperation('update', 'debts', debtId, updates);

        Toast.show({
          type: 'info',
          text1: 'Offline mode',
          text2: 'Changes saved locally and will sync when online',
        });
      }
    } catch (e) {
      console.error('Failed to update debt', e);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to update debt',
      });
      throw e;
    }
  }

  /**
   * Delete debt with offline support
   */
  static async deleteDebt(debtId: string) {
    try {
      try {
        await deleteDoc(doc(db, 'debts', debtId));
        Toast.show({
          type: 'success',
          text1: 'Deleted',
          text2: 'Debt removed',
        });
      } catch (e) {
        console.log('Failed to delete debt online, queuing offline', e);
        await OfflineQueue.addOperation('delete', 'debts', debtId, {});

        Toast.show({
          type: 'info',
          text1: 'Offline mode',
          text2: 'Deletion queued and will sync when online',
        });
      }
    } catch (e) {
      console.error('Failed to delete debt', e);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to delete debt',
      });
      throw e;
    }
  }

  /**
   * Add repayment with offline support
   */
  static async addRepayment(repaymentData: Partial<Repayment>) {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('User not authenticated');

      const data = {
        ...repaymentData,
        userId: uid,
        createdAt: new Date().toISOString(),
      };

      try {
        const docRef = await addDoc(collection(db, 'repayments'), data);
        Toast.show({
          type: 'success',
          text1: 'Repayment recorded',
          text2: 'Your repayment is synced',
        });
        return docRef.id;
      } catch (e) {
        console.log('Failed to save repayment online, queuing offline', e);
        const id = await OfflineQueue.addOperation(
          'create',
          'repayments',
          `temp_${Date.now()}`,
          data
        );

        Toast.show({
          type: 'info',
          text1: 'Offline mode',
          text2: 'Repayment saved locally and will sync when online',
        });

        return id;
      }
    } catch (e) {
      console.error('Failed to add repayment', e);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to record repayment',
      });
      throw e;
    }
  }
}
