import DebtCard from '@/components/debts/debt-card';
import BottomTabs from '@/components/ui/bottom-tabs';
import Shimmer from '@/components/ui/shimmer';
import TopActions from '@/components/ui/top-actions';
import * as C from '@/constants/colors';
import { auth, db } from '@/lib/firebase';
import { cancelScheduledNotification, requestNotificationPermissions, scheduleDebtReminder } from '@/lib/notifications';
import { Debt } from '@/types/models';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

export default function Debts() {
  const router = useRouter();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminderModal, setReminderModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [reminderDateTime, setReminderDateTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Toast.show({ type: 'error', text1: 'Not signed in', text2: 'Please sign in to view your debts.' });
      router.replace('/auth/login');
      return;
    }

    const q = query(collection(db, 'debts'), where('ownerId', '==', uid));
    const unsub = onSnapshot(q, (snap) => {
      const items: Debt[] = [];
      snap.forEach((d) => {
        const data = d.data();
        items.push({ id: d.id, ...(data as any) });
      });
      setDebts(items);
      setLoading(false);
      setRefreshing(false);
    }, (err) => {
      console.log('Debts snapshot error', err);
      Toast.show({ type: 'error', text1: 'Could not load debts', text2: 'Try again later.' });
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsub();
  }, [router]);

  const handleRemind = (d: Debt) => {
    setSelectedDebt(d);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    setReminderDateTime(tomorrow);
    setReminderModal(true);
  };

    const scheduleReminder = async () => {
      if (!selectedDebt) {
        Toast.show({ type: 'error', text1: 'Invalid input', text2: 'Please select a debt.' });
        return;
      }

      const uid = auth.currentUser?.uid;
      if (!uid) {
        Toast.show({ type: 'error', text1: 'Not signed in', text2: 'Please sign in to set reminders.' });
        return;
      }

      if (reminderDateTime <= new Date()) {
        Toast.show({ type: 'error', text1: 'Invalid time', text2: 'Reminder must be in the future.' });
        return;
      }

      try {
        const granted = await requestNotificationPermissions();
        if (!granted) {
          Toast.show({ type: 'info', text1: 'Notifications blocked', text2: 'Enable notifications to get reminders.' });
          return;
        }

        const notificationId = await scheduleDebtReminder(
          'Debt Reminder 💰',
          `Reminder for debt with ${selectedDebt.counterpartyName}: ${selectedDebt.amount} ${selectedDebt.currency || 'XAF'}`,
          reminderDateTime
        );

        await addDoc(collection(db, 'notifications'), {
          userId: uid,
          title: 'Debt reminder scheduled',
          body: `Reminder for ${selectedDebt.counterpartyName} on ${reminderDateTime.toLocaleString()}.`,
          type: 'debt',
          relatedId: selectedDebt.id,
          scheduledFor: reminderDateTime.toISOString(),
          read: false,
          createdAt: serverTimestamp(),
        });

        // Update debt document with reminder info
        await updateDoc(doc(db, 'debts', selectedDebt.id), {
          reminderAt: reminderDateTime.toISOString(),
          notificationId,
          updatedAt: serverTimestamp(),
        });

        Toast.show({
          type: 'success',
          text1: 'Reminder set',
          text2: `Scheduled for ${reminderDateTime.toLocaleString()}`
        });
        setReminderModal(false);
        setSelectedDebt(null);
      } catch (e: any) {
        console.log('Schedule reminder error:', e);
        Toast.show({
          type: 'error',
          text1: 'Could not set reminder',
          text2: e.message || 'Try again.'
        });
      }
    };

  const handleSettle = (d: Debt) => {
    const remaining = Number(d.remainingAmount ?? d.amount) || 0;
    Alert.alert('Settle debt', `Mark this debt as fully settled? Remaining: ${d.currency || 'XAF'} ${remaining.toFixed(2)}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Settle', onPress: () => settleDebt(d) },
    ]);
  };

  const settleDebt = async (d: Debt) => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Toast.show({ type: 'error', text1: 'Not signed in', text2: 'Please sign in to settle debts.' });
      router.replace('/auth/login');
      return;
    }

    const remaining = Number(d.remainingAmount ?? d.amount) || 0;
    if (remaining <= 0) {
      Toast.show({ type: 'info', text1: 'Already settled', text2: 'This debt is already cleared.' });
      return;
    }

    setSettlingId(d.id);
    try {
      // Log repayment record
      const repaymentRef = await addDoc(collection(db, 'repayments'), {
        userId: uid,
        debtId: d.id,
        amount: remaining,
        date: new Date().toISOString(),
        counterpartyName: d.counterpartyName,
        direction: d.direction,
        previousBalance: remaining,
        newBalance: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Record repayment transaction
      await addDoc(collection(db, 'transactions'), {
        userId: uid,
        type: 'repayment',
        amount: remaining,
        category: 'Debt settlement',
        date: new Date().toISOString(),
        notes: `Settled debt with ${d.counterpartyName}`,
        debtId: d.id,
        direction: d.direction,
        counterpartyName: d.counterpartyName,
        createdAt: serverTimestamp(),
        repaymentId: repaymentRef.id,
      });

      // Cancel any scheduled reminder for this debt
      if ((d as any).notificationId) {
        try { await cancelScheduledNotification((d as any).notificationId as string); } catch {}
      }

      // Update debt
      await updateDoc(doc(db, 'debts', d.id), {
        remainingAmount: 0,
        status: 'paid',
        reminderAt: null,
        notificationId: null,
        updatedAt: serverTimestamp(),
      });

      Toast.show({ type: 'success', text1: 'Debt settled', text2: 'Marked as fully repaid.' });
    } catch (e) {
      console.log('Settle debt error', e);
      Toast.show({ type: 'error', text1: 'Settle failed', text2: 'Could not settle debt. Try again.' });
    } finally {
      setSettlingId(null);
    }
  };


  const summary = debts.reduce(
    (acc, cur) => {
      const value = Number(cur.remainingAmount ?? cur.amount) || 0;
      if (cur.direction === 'owed') acc.owed += value;
      else acc.owing += value;
      return acc;
    },
    { owed: 0, owing: 0 }
  );

  return (
    <SafeAreaView style={styles.container}>
      <TopActions />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Debts</Text>
            <Text style={styles.subtitle}>Track what you owe and what&apos;s owed to you</Text>
          </View>

        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.shadowCard, { backgroundColor: '#F6F3FF' }]}>
          <Text style={styles.summaryLabel}>Owed to you</Text>
          <Text style={styles.summaryValue}>{`XAF ${summary.owed.toFixed(2)}`}</Text>
          <Text style={styles.summaryHint}>People owing you across all debts.</Text>
        </View>
        <View style={[styles.summaryCard, styles.shadowCard, { backgroundColor: '#FFF3F6' }]}>
          <Text style={styles.summaryLabel}>You owe</Text>
          <Text style={styles.summaryValue}>{`XAF ${summary.owing.toFixed(2)}`}</Text>
          <Text style={styles.summaryHint}>What you owe others.</Text>
        </View>
      </View>

      <View style={styles.infoBanner}>
        <Text style={styles.infoTitle}>Stay on top of debts</Text>
        <Text style={styles.infoText}>Set reminders for due dates and settle to zero the moment you finish paying. We log a repayment transaction and mark the debt paid.</Text>
      </View>

      <View style={styles.listContainer}>
        {loading ? (
          <View style={{ gap: 12 }}>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, styles.shadowCard]}>
                <Shimmer width="60%" height={14} />
                <Shimmer width="80%" height={18} style={{ marginTop: 8 }} />
                <Shimmer width="90%" height={12} style={{ marginTop: 8 }} />
              </View>
              <View style={[styles.summaryCard, styles.shadowCard]}>
                <Shimmer width="60%" height={14} />
                <Shimmer width="80%" height={18} style={{ marginTop: 8 }} />
                <Shimmer width="90%" height={12} style={{ marginTop: 8 }} />
              </View>
            </View>
            {[1,2,3].map((i) => (
              <View key={i} style={[styles.shimmerCard]}>
                <Shimmer width="50%" height={16} />
                <Shimmer width="80%" height={12} style={{ marginTop: 8 }} />
                <Shimmer width="40%" height={10} style={{ marginTop: 8 }} />
              </View>
            ))}
          </View>
        ) : debts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No debts yet. Tap + to add one.</Text>
          </View>
        ) : (
          <FlatList
            data={debts}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <DebtCard debt={item} onRemind={handleRemind} onSettle={handleSettle} />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 140 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
              setRefreshing(true);
              const uid = auth.currentUser?.uid;
              if (!uid) { setRefreshing(false); return; }
              try {
                const q = query(collection(db, 'debts'), where('ownerId', '==', uid));
                const snap = await getDocs(q);
                const items: Debt[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
                setDebts(items);
              } catch (e) {
                console.log('Refresh debts error', e);
                Toast.show({ type: 'error', text1: 'Refresh failed', text2: 'Pull to refresh again.' });
              } finally {
                setRefreshing(false);
              }
            }} />}
          />
        )}
      </View>

      <Pressable style={styles.fab} onPress={() => router.push('/transactions/add') }>
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      <Modal visible={reminderModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Reminder</Text>
            <Text style={styles.modalSubtitle}>Choose when to be reminded about this debt</Text>

            <View style={styles.dateTimeContainer}>
              <Pressable style={styles.dateTimeBtn} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateTimeLabel}>Date</Text>
                <Text style={styles.dateTimeValue}>{reminderDateTime.toLocaleDateString()}</Text>
              </Pressable>

              <Pressable style={styles.dateTimeBtn} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.dateTimeLabel}>Time</Text>
                <Text style={styles.dateTimeValue}>{reminderDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </Pressable>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={reminderDateTime}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(event, date) => {
                  setShowDatePicker(false);
                  if (date) {
                    const newDateTime = new Date(reminderDateTime);
                    newDateTime.setFullYear(date.getFullYear());
                    newDateTime.setMonth(date.getMonth());
                    newDateTime.setDate(date.getDate());
                    setReminderDateTime(newDateTime);
                  }
                }}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={reminderDateTime}
                mode="time"
                display="default"
                onChange={(event, date) => {
                  setShowTimePicker(false);
                  if (date) {
                    const newDateTime = new Date(reminderDateTime);
                    newDateTime.setHours(date.getHours());
                    newDateTime.setMinutes(date.getMinutes());
                    setReminderDateTime(newDateTime);
                  }
                }}
              />
            )}

            <View style={styles.modalButtons}>
              <Pressable style={styles.cancelBtn} onPress={() => setReminderModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={scheduleReminder}>
                <Text style={styles.saveText}>Set Reminder</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <BottomTabs />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.BACKGROUND_LIGHT, paddingHorizontal: 20 },
  header: { marginTop: 8, marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { flex: 1 },
  title: { fontSize: 28, fontWeight: '900', color: C.TEXT_PRIMARY },
  subtitle: { color: C.TEXT_SECONDARY, marginTop: 6 },
  summaryRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  summaryCard: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: C.BORDER },
  summaryHint: { color: C.TEXT_SECONDARY, fontSize: 12, marginTop: 6, textAlign: 'center' },
  summaryLabel: { color: C.TEXT_SECONDARY, fontSize: 12, fontWeight: '700' },
  summaryValue: { color: C.PRIMARY_PURPLE, fontSize: 18, fontWeight: '900', marginTop: 6 },
  shadowCard: { shadowColor: '#7C3AED', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  shimmerCard: { padding: 16, borderRadius: 16, backgroundColor: C.CARD_LIGHT, borderWidth: 1, borderColor: C.BORDER },
  infoBanner: { marginTop: 16, backgroundColor: '#EEF2FF', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E0E7FF' },
  infoTitle: { color: '#4338CA', fontWeight: '800', marginBottom: 4 },
  infoText: { color: '#475569', fontSize: 13, lineHeight: 18 },
  listContainer: { flex: 1, marginTop: 16 },
  emptyContainer: { padding: 28, alignItems: 'center' },
  emptyText: { color: C.TEXT_SECONDARY },
  hint: { color: C.TEXT_SECONDARY },
  fab: { position: 'absolute', right: 20, bottom: 120, backgroundColor: C.PRIMARY_PURPLE, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#7C3AED', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  fabText: { color: C.TEXT_ON_PURPLE, fontSize: 30, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: C.CARD_LIGHT, padding: 24, borderRadius: 20, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: C.TEXT_PRIMARY, marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: C.TEXT_SECONDARY, marginBottom: 20 },
  dateTimeContainer: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  dateTimeBtn: { flex: 1, backgroundColor: '#F8F7FF', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: C.BORDER },
  dateTimeLabel: { fontSize: 12, color: C.TEXT_SECONDARY, fontWeight: '600', marginBottom: 6 },
  dateTimeValue: { fontSize: 16, color: C.TEXT_PRIMARY, fontWeight: '700' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, backgroundColor: '#EFEAFE', borderRadius: 12, alignItems: 'center' },
  cancelText: { color: C.PRIMARY_PURPLE, fontWeight: '800', fontSize: 15 },
  saveBtn: { flex: 1, padding: 14, backgroundColor: C.PRIMARY_PURPLE, borderRadius: 12, alignItems: 'center' },
  saveText: { color: C.TEXT_ON_PURPLE, fontWeight: '900', fontSize: 15 },
});
