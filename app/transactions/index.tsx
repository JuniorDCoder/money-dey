import BottomTabs from '@/components/ui/bottom-tabs';
import Shimmer from '@/components/ui/shimmer';
import TopActions from '@/components/ui/top-actions';
import * as C from '@/constants/colors';
import { auth, db } from '@/lib/firebase';
import { Transaction } from '@/types/models';
import { useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

export default function Transactions() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | Transaction['type']>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      // User not signed in — keep mock data
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'transactions'), where('userId', '==', uid), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      (async () => {
        const items: Transaction[] = [];
        const debtIds = new Set<string>();
        snap.forEach((d) => {
          const data = d.data() as any;
          const debtId = data.debtId || data.debt_id;
          if (debtId) debtIds.add(String(debtId));
          items.push({
            id: d.id,
            amount: typeof data.amount === 'number' ? data.amount : Number(data.amount || 0),
            type: data.type || 'expense',
            category: data.category || 'Misc',
            notes: data.notes || data.note || '',
            date: data.date && data.date.toDate ? data.date.toDate().toISOString() : (data.date ? new Date(data.date).toISOString() : new Date().toISOString()),
            createdAt: data.createdAt || null,
            counterpartyName: data.counterpartyName || data.counterparty || undefined,
            debtId,
            direction: data.direction,
          } as Transaction);
        });

        let debtMap: Record<string, any> = {};
        if (debtIds.size) {
          const results = await Promise.all(Array.from(debtIds).map(async (id) => {
            try {
              const ds = await getDoc(doc(db, 'debts', id));
              return ds.exists() ? { id, data: ds.data() } : null;
            } catch {
              return null;
            }
          }));
          debtMap = results.filter(Boolean).reduce((acc, entry: any) => {
            acc[entry.id] = entry.data;
            return acc;
          }, {} as Record<string, any>);
        }

        const merged = items.map((t) => {
          const debt = t.debtId ? debtMap[t.debtId] : null;
          if (debt) {
            return {
              ...t,
              counterpartyName: debt.counterpartyName || t.counterpartyName,
              direction: debt.direction || t.direction,
              category: t.category || 'Debt',
            } as Transaction;
          }
          return t;
        });

        setTransactions(merged);
        setLoading(false);
      })();
    }, (err) => {
      console.log('Tx snapshot err', err);
      Toast.show({ type: 'error', text1: 'Could not load', text2: 'Unable to load transactions.' });
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    let list = transactions;
    if (filter !== 'all') list = list.filter((t) => t.type === filter);
    if (search) list = list.filter((t) => (t.category || t.notes || t.type).toLowerCase().includes(search.toLowerCase()) || t.amount.toString().includes(search));
    return list;
  }, [transactions, filter, search]);

  const onRefresh = async () => {
    setRefreshing(true);
    // Firestore onSnapshot updates live; just briefly toggle to show UI feedback
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleDelete = async (item?: Transaction) => {
    if (!item?.id) return;
    const isDebtType = item.type === 'debt';
    const isRepayment = item.type === 'repayment';
    const linkedDebtId = (item as any).debtId || (item as any).debt_id;
    
    try {
      // If it's a repayment, restore the debt balance before deleting
      if (isRepayment && linkedDebtId) {
        try {
          // Find the repayment record to get the amount
          const repaymentQuery = query(
            collection(db, 'repayments'),
            where('transactionId', '==', item.id)
          );
          const repaymentSnap = await getDocs(repaymentQuery);
          
          if (!repaymentSnap.empty) {
            const repaymentData = repaymentSnap.docs[0].data();
            const repaymentAmount = repaymentData.amount || item.amount;
            
            // Get current debt state
            const debtSnap = await getDoc(doc(db, 'debts', String(linkedDebtId)));
            if (debtSnap.exists()) {
              const debtData = debtSnap.data();
              const currentRemaining = debtData.remainingAmount ?? debtData.amount;
              const newRemaining = currentRemaining + repaymentAmount;
              const originalAmount = debtData.amount;
              
              // Calculate new status
              let newStatus: 'pending' | 'partial' | 'paid' = 'pending';
              if (newRemaining === originalAmount) {
                newStatus = 'pending';
              } else if (newRemaining > 0 && newRemaining < originalAmount) {
                newStatus = 'partial';
              } else if (newRemaining === 0) {
                newStatus = 'paid';
              }
              
              // Update debt balance
              await updateDoc(doc(db, 'debts', String(linkedDebtId)), {
                remainingAmount: newRemaining,
                status: newStatus,
              });
            }
            
            // Delete the repayment record
            await deleteDoc(doc(db, 'repayments', repaymentSnap.docs[0].id));
          }
        } catch (err) {
          console.log('Restore debt balance error', err);
          Toast.show({ type: 'warning', text1: 'Warning', text2: 'Debt balance may not have been restored.' });
        }
      }
      
      // Delete the transaction
      await deleteDoc(doc(db, 'transactions', item.id));

      // If it's a debt (not repayment), delete the debt record
      if (isDebtType && linkedDebtId) {
        try {
          await deleteDoc(doc(db, 'debts', String(linkedDebtId)));
        } catch (err) {
          console.log('Delete linked debt', err);
          Toast.show({ type: 'info', text1: 'Debt not removed', text2: 'Transaction deleted but debt record may remain.' });
        }
      }

      Toast.show({ type: 'success', text1: 'Deleted', text2: 'Transaction removed.' });
    } catch (e) {
      console.log('Delete tx', e);
      Toast.show({ type: 'error', text1: 'Could not delete', text2: 'Try again.' });
    }
  };

  const renderRightActions = (item: Transaction) => (
    <View style={styles.rowActions}>
      <Pressable style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]} onPress={() => router.push({ pathname: '/transactions/add', params: { id: item.id } } as any)}>
        <Text style={styles.actionText}>Edit</Text>
      </Pressable>
      <Pressable style={[styles.actionBtn, { backgroundColor: '#EF4444' }]} onPress={() => handleDelete(item)}>
        <Text style={styles.actionText}>Delete</Text>
      </Pressable>
    </View>
  );

  const renderItem = ({ item }: { item: Transaction }) => {
    const isRepayment = item.type === 'repayment';
    const isDebt = item.type === 'debt';
    const previousBalance = (item as any).previousBalance;
    const newBalance = (item as any).newBalance;
    
    return (
      <Swipeable renderRightActions={() => renderRightActions(item)}>
        <Pressable onPress={() => router.push(`/transactions/${item.id}`)}>
          <View style={styles.txRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.txCategory}>{(item.type === 'debt' || item.type === 'repayment') ? (item.counterpartyName || 'Debt') : (item.category || item.type)}</Text>
              <Text style={styles.txNotes}>{item.notes || ''}</Text>
              
              {isRepayment && previousBalance !== undefined && newBalance !== undefined && (
                <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
                  <Text style={styles.txBalanceInfo}>
                    {previousBalance.toLocaleString()} XAF → {newBalance.toLocaleString()} XAF
                  </Text>
                </View>
              )}

              {(isDebt || isRepayment) && (
                <Text style={styles.txHint}>Tap to view full details →</Text>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.txAmount, item.type === 'income' ? styles.income : styles.expense]}>
                {item.type === 'income' ? '+' : '-'}{new Intl.NumberFormat(undefined, { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(item.amount)}
              </Text>
              {isRepayment && newBalance === 0 && (
                <Text style={{ fontSize: 11, color: '#10B981', fontWeight: '700', marginTop: 4 }}>✓ Paid</Text>
              )}
            </View>
          </View>
        </Pressable>
      </Swipeable>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <TopActions />
        <View style={styles.header}>
          <Text style={styles.title}>Transactions</Text>
          <Text style={styles.subtitle}>All your expenses, income and transfers</Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Your data stays private</Text>
          <Text style={styles.infoText}>We use your records only to show insights on your device. We never sell or use them for malicious purposes.</Text>
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipText}>Tip: Swipe left on a row to edit or delete a transaction.</Text>
        </View>

        <View style={styles.controls}>
          <TextInput placeholder="Search by category, notes or amount" value={search} onChangeText={setSearch} style={styles.search} />
          <View style={styles.filters}>
            {(['all', 'income', 'expense', 'debt', 'repayment'] as const).map((f) => (
              <Pressable key={f} style={[styles.filterBtn, filter === f && { backgroundColor: C.PRIMARY_PURPLE }]} onPress={() => setFilter(f as any)}>
                <Text style={[styles.filterText, filter === f && { color: C.TEXT_ON_PURPLE }]}>{f}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.listContainer}>
          {loading ? (
            <View style={{ gap: 12 }}>
              {[0,1,2,3].map((i) => (
                <Shimmer key={i} height={70} borderRadius={12} />
              ))}
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No transactions found.</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(t) => t.id}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.PRIMARY_PURPLE} colors={[C.PRIMARY_PURPLE]} />}
              contentContainerStyle={{ paddingBottom: 140, gap: 8 }}
            />
          )}
        </View>

        <Pressable style={styles.fab} onPress={() => router.push('/transactions/add') }>
          <Text style={styles.fabText}>+</Text>
        </Pressable>

        <BottomTabs />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.BACKGROUND_LIGHT, paddingHorizontal: 20 },
  header: { marginTop: 8, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: C.TEXT_PRIMARY },
  subtitle: { color: C.TEXT_SECONDARY, marginTop: 6 },
  infoCard: { backgroundColor: '#EEF2FF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E0E7FF', marginBottom: 10 },
  infoTitle: { color: '#4338CA', fontWeight: '800', marginBottom: 4 },
  infoText: { color: '#4B5563', fontSize: 13, lineHeight: 18 },
  tipCard: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
  tipText: { color: '#475569', fontSize: 13, fontWeight: '700' },
  controls: { marginTop: 12 },
  search: { backgroundColor: C.CARD_LIGHT, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: C.BORDER },
  filters: { flexDirection: 'row', gap: 8, marginTop: 8 },
  filterBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: C.CARD_LIGHT, borderWidth: 1, borderColor: C.BORDER },
  filterText: { fontWeight: '800', color: C.TEXT_PRIMARY },
  listContainer: { flex: 1, marginTop: 12 },
  emptyContainer: { padding: 28, alignItems: 'center' },
  emptyText: { color: C.TEXT_SECONDARY },
  hint: { color: C.TEXT_SECONDARY },
  txRow: { backgroundColor: C.CARD_LIGHT, padding: 12, borderRadius: 12, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: C.BORDER },
  txCategory: { fontWeight: '700', color: C.TEXT_PRIMARY },
  txNotes: { color: C.TEXT_SECONDARY, marginTop: 6, fontSize: 12 },
  txBalanceInfo: { color: '#7C3AED', fontSize: 11, fontWeight: '700', lineHeight: 16 },
  txHint: { color: C.PRIMARY_PURPLE, fontSize: 10, fontWeight: '600', marginTop: 8, opacity: 0.8 },
  txAmount: { fontWeight: '800', fontSize: 14 },
  income: { color: '#10B981' },
  expense: { color: '#EF4444' },
  fab: { position: 'absolute', right: 20, bottom: 120, backgroundColor: C.PRIMARY_PURPLE, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#7C3AED', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  fabText: { color: C.TEXT_ON_PURPLE, fontSize: 30, fontWeight: '900' },
  rowActions: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, overflow: 'hidden' },
  actionBtn: { padding: 12, justifyContent: 'center', alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: '900' },
});
