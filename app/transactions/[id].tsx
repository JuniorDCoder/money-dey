import BottomTabs from '@/components/ui/bottom-tabs';
import Shimmer from '@/components/ui/shimmer';
import * as C from '@/constants/colors';
import { auth, db } from '@/lib/firebase';
import { Debt, Repayment, Transaction } from '@/types/models';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [repaymentDetails, setRepaymentDetails] = useState<Repayment | null>(null);
  const [linkedDebt, setLinkedDebt] = useState<Debt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      Toast.show({ type: 'error', text1: 'Invalid ID', text2: 'Transaction ID is missing.' });
      router.back();
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
      Toast.show({ type: 'error', text1: 'Not signed in', text2: 'Please sign in.' });
      router.replace('/auth/login');
      return;
    }

    let unsubscribeDebt: (() => void) | null = null;

    (async () => {
      try {
        const snap = await getDoc(doc(db, 'transactions', id));
        if (snap.exists()) {
          const data = snap.data() as any;
          if (data.userId !== uid) {
            Toast.show({ type: 'error', text1: 'Access denied', text2: 'You cannot view this transaction.' });
            router.back();
            return;
          }
          const txData = { id: snap.id, ...data };
          setTransaction(txData);
          
          const debtIdRef = data.debtId || data.debt_id;
          
          // If it's a repayment, load additional repayment details
          if (data.type === 'repayment') {
            try {
              const repayQuery = query(
                collection(db, 'repayments'),
                where('transactionId', '==', id)
              );
              const repaySnap = await getDocs(repayQuery);
              if (!repaySnap.empty) {
                setRepaymentDetails({ id: repaySnap.docs[0].id, ...repaySnap.docs[0].data() } as Repayment);
              }
            } catch (e) {
              console.log('Load repayment details error', e);
            }
          }
          
          // Load linked debt details with real-time listener (for BOTH debt and repayment types)
          if ((data.type === 'debt' || data.type === 'repayment') && debtIdRef) {
            try {
              // Subscribe to real-time updates on the debt
              unsubscribeDebt = onSnapshot(
                doc(db, 'debts', debtIdRef),
                (debtSnap) => {
                  if (debtSnap.exists()) {
                    setLinkedDebt({ id: debtSnap.id, ...debtSnap.data() } as Debt);
                  }
                },
                (error) => {
                  console.log('Real-time debt listener error', error);
                }
              );
            } catch (e) {
              console.log('Load debt details error', e);
            }
          }
        } else {
          Toast.show({ type: 'error', text1: 'Not found', text2: 'Transaction not found.' });
          router.back();
        }
      } catch (e) {
        console.log('Load tx detail', e);
        Toast.show({ type: 'error', text1: 'Could not load', text2: 'Failed to load transaction details.' });
        router.back();
      } finally {
        setLoading(false);
      }
    })();

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribeDebt) {
        unsubscribeDebt();
      }
    };
  }, [id, router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeContainer}>
        <ScrollView style={styles.container}>
          <View style={{ gap: 12 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Shimmer key={i} height={64} borderRadius={14} />
            ))}
          </View>
        </ScrollView>
        <BottomTabs />
      </SafeAreaView>
    );
  }

  if (!transaction) return null;

  const formattedAmount = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(transaction.amount);
  const formattedDate = new Date(transaction.date).toLocaleDateString();
  const created = (transaction as any).createdAt;
  const createdDate = created?.seconds ? new Date(created.seconds * 1000) : created ? new Date(created) : null;
  const formattedCreated = createdDate ? createdDate.toLocaleString() : 'N/A';
  const counterparty = (transaction as any).counterpartyName || (transaction as any).counterparty;
  const direction = (transaction as any).direction;
  const debtId = (transaction as any).debtId || (transaction as any).debt_id;
  const due = (transaction as any).dueDate;
  const status = (transaction as any).status;
  const formattedDue = due ? new Date(due.seconds ? due.seconds * 1000 : due).toLocaleDateString() : null;

  return (
    <SafeAreaView style={styles.safeContainer}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Transaction Details</Text>
        </View>

        <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Type</Text>
          <Text style={styles.value}>{transaction.type}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Amount</Text>
          <Text style={[styles.value, transaction.type === 'income' ? styles.income : styles.expense]}>{transaction.type === 'income' ? '+' : '-'}{formattedAmount}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Category</Text>
          <Text style={styles.value}>{transaction.category || (transaction.type === 'debt' ? 'Debt' : 'N/A')}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.value}>{formattedDate}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Notes</Text>
          <Text style={styles.value}>{transaction.notes || 'No notes'}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Created</Text>
          <Text style={styles.value}>{formattedCreated}</Text>
        </View>

        {(transaction.type === 'debt' || transaction.type === 'repayment') && (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>Counterparty</Text>
              <Text style={styles.value}>{counterparty || 'Unknown'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Direction</Text>
              <Text style={styles.value}>{direction === 'owed' ? 'They owe me' : direction === 'owing' ? 'I owe them' : 'N/A'}</Text>
            </View>
            
            {transaction.type === 'repayment' && repaymentDetails && linkedDebt && (
              <>
                {/* Narrative Explanation */}
                <View style={styles.narrativeBox}>
                  <Text style={styles.narrativeText}>
                    <Text style={{ fontWeight: '900' }}>{counterparty}</Text>
                    {direction === 'owed' ? ' owed you ' : ' was owing you '}
                    <Text style={{ fontWeight: '900', color: '#EF4444' }}>
                      {linkedDebt.amount.toLocaleString()} XAF
                    </Text>
                    {' initially. On '}
                    <Text style={{ fontWeight: '700' }}>{formattedDate}</Text>
                    {', '}
                    <Text style={{ fontWeight: '900', color: '#10B981' }}>
                      he made a payment of {transaction.amount.toLocaleString()} XAF
                    </Text>
                    {', and now '}
                    <Text style={{ fontWeight: '900', color: (repaymentDetails.newBalance ?? 0) === 0 ? '#10B981' : '#7C3AED' }}>
                      {(repaymentDetails.newBalance ?? 0) === 0 
                        ? 'the debt is fully cleared! ✓' 
                        : `he still owes ${(repaymentDetails.newBalance ?? 0).toLocaleString()} XAF`
                      }
                    </Text>
                  </Text>
                </View>

                <View style={[styles.row, { paddingTop: 16, borderTopWidth: 2, borderTopColor: C.PRIMARY_PURPLE, marginTop: 8 }]}>
                  <Text style={[styles.label, { fontWeight: '900', fontSize: 15 }]}>Payment Summary</Text>
                </View>
                
                <View style={styles.row}>
                  <Text style={styles.label}>Original Amount</Text>
                  <Text style={[styles.value, { color: '#EF4444', fontWeight: '700' }]}>
                    {linkedDebt.amount.toLocaleString()} XAF
                  </Text>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Before this Payment</Text>
                  <Text style={styles.value}>
                    {repaymentDetails.previousBalance?.toLocaleString() || 'N/A'} XAF
                  </Text>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Payment Received</Text>
                  <Text style={[styles.value, { color: '#10B981', fontWeight: '700' }]}>
                    +{transaction.amount.toLocaleString()} XAF
                  </Text>
                </View>

                <View style={[styles.row, { backgroundColor: '#F3F4F6', marginHorizontal: -20, paddingHorizontal: 20 }]}>
                  <Text style={[styles.label, { fontWeight: '800' }]}>Remaining Due</Text>
                  <Text style={[
                    styles.value, 
                    { 
                      fontWeight: '900', 
                      fontSize: 16,
                      color: repaymentDetails.newBalance === 0 ? '#10B981' : '#7C3AED'
                    }
                  ]}>
                    {repaymentDetails.newBalance?.toLocaleString() || 'N/A'} XAF
                  </Text>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Current Status</Text>
                  <Text style={[
                    styles.value, 
                    styles.statusText,
                    linkedDebt.status === 'paid' && { color: '#10B981' },
                    linkedDebt.status === 'partial' && { color: '#F59E0B' },
                    linkedDebt.status === 'pending' && { color: '#EF4444' }
                  ]}>
                    {linkedDebt.status === 'paid' 
                      ? '✓ Fully Paid' 
                      : linkedDebt.status === 'partial' 
                      ? 'Partial Payment' 
                      : 'Pending'}
                  </Text>
                </View>

                {linkedDebt.status === 'paid' && (
                  <View style={[styles.row, { backgroundColor: '#ECFDF5', marginHorizontal: -20, paddingHorizontal: 20 }]}>
                    <Text style={{ color: '#10B981', fontWeight: '900', fontSize: 14 }}>✓ Debt fully cleared!</Text>
                  </View>
                )}
              </>
            )}
            
            {transaction.type === 'debt' && linkedDebt && (
              <>
                {/* Narrative Explanation */}
                <View style={styles.narrativeBox}>
                  <Text style={styles.narrativeText}>
                    <Text style={{ fontWeight: '900' }}>{counterparty}</Text>
                    {direction === 'owed' ? ' owes you ' : ' you owe '}
                    <Text style={{ fontWeight: '900', color: '#EF4444' }}>
                      {linkedDebt.amount.toLocaleString()} XAF
                    </Text>
                    {' (created on '}
                    <Text style={{ fontWeight: '700' }}>{formattedDate}</Text>
                    {')'}
                    {linkedDebt.remainingAmount && linkedDebt.remainingAmount < linkedDebt.amount && (
                      <>
                        {'. So far, '}
                        <Text style={{ fontWeight: '900', color: '#10B981' }}>
                          {(linkedDebt.amount - linkedDebt.remainingAmount).toLocaleString()} XAF
                        </Text>
                        {' has been paid, leaving '}
                        <Text style={{ fontWeight: '900', color: '#7C3AED' }}>
                          {linkedDebt.remainingAmount.toLocaleString()} XAF
                        </Text>
                        {' remaining'}
                      </>
                    )}
                    {linkedDebt.remainingAmount === 0 && (
                      <>
                        {'. '}
                        <Text style={{ fontWeight: '900', color: '#10B981' }}>This debt is now fully settled! ✓</Text>
                      </>
                    )}
                  </Text>
                </View>

                <View style={[styles.row, { paddingTop: 16, borderTopWidth: 2, borderTopColor: C.PRIMARY_PURPLE, marginTop: 8 }]}>
                  <Text style={[styles.label, { fontWeight: '900', fontSize: 15 }]}>Debt Overview</Text>
                </View>
                
                <View style={styles.row}>
                  <Text style={styles.label}>Total Amount</Text>
                  <Text style={[styles.value, { color: '#EF4444', fontWeight: '700' }]}>
                    {linkedDebt.amount.toLocaleString()} XAF
                  </Text>
                </View>

                {linkedDebt.remainingAmount && linkedDebt.remainingAmount < linkedDebt.amount && (
                  <>
                    <View style={styles.row}>
                      <Text style={styles.label}>Already Paid</Text>
                      <Text style={[styles.value, { color: '#10B981', fontWeight: '700' }]}>
                        +{(linkedDebt.amount - linkedDebt.remainingAmount).toLocaleString()} XAF
                      </Text>
                    </View>
                  </>
                )}

                <View style={[styles.row, { backgroundColor: '#F3F4F6', marginHorizontal: -20, paddingHorizontal: 20 }]}>
                  <Text style={[styles.label, { fontWeight: '800' }]}>Currently Owed</Text>
                  <Text style={[
                    styles.value, 
                    { 
                      fontWeight: '900', 
                      fontSize: 16,
                      color: (linkedDebt.remainingAmount ?? linkedDebt.amount) === 0 ? '#10B981' : '#7C3AED'
                    }
                  ]}>
                    {(linkedDebt.remainingAmount ?? linkedDebt.amount).toLocaleString()} XAF
                  </Text>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Status</Text>
                  <Text style={[
                    styles.value, 
                    styles.statusText,
                    linkedDebt.status === 'paid' && { color: '#10B981' },
                    linkedDebt.status === 'partial' && { color: '#F59E0B' },
                    linkedDebt.status === 'pending' && { color: '#EF4444' }
                  ]}>
                    {linkedDebt.status === 'paid' 
                      ? '✓ Fully Paid' 
                      : linkedDebt.status === 'partial' 
                      ? 'Partial Payment' 
                      : 'Pending'}
                  </Text>
                </View>

                {formattedDue && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Due Date</Text>
                    <Text style={styles.value}>{formattedDue}</Text>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </View>

      <Pressable style={styles.editBtn} onPress={() => router.push({ pathname: '/transactions/add', params: { id: transaction.id } })}>
        <Text style={styles.editText}>Edit Transaction</Text>
      </Pressable>

      <View style={{ height: 100 }} />
      </ScrollView>
      <BottomTabs />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: C.BACKGROUND_LIGHT },
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  header: { marginTop: 8, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: C.TEXT_PRIMARY },
  loading: { textAlign: 'center', color: C.TEXT_SECONDARY, marginTop: 50 },
  card: { backgroundColor: C.CARD_LIGHT, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.BORDER },
  label: { color: C.TEXT_SECONDARY, fontWeight: '700' },
  value: { color: C.TEXT_PRIMARY, fontWeight: '600' },
  valueMono: { color: C.TEXT_PRIMARY, fontWeight: '600', fontFamily: 'monospace', maxWidth: '60%' },
  income: { color: '#10B981' },
  expense: { color: '#EF4444' },
  balanceText: { color: '#7C3AED', fontWeight: '800' },
  statusText: { textTransform: 'capitalize', color: '#F59E0B', fontWeight: '700' },
  narrativeBox: { backgroundColor: '#F3F4F6', padding: 16, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: C.PRIMARY_PURPLE, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  narrativeText: { color: C.TEXT_PRIMARY, fontSize: 15, lineHeight: 24, fontWeight: '500' },
  editBtn: { backgroundColor: C.PRIMARY_PURPLE, padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  editText: { color: C.TEXT_ON_PURPLE, fontWeight: '900' },
});
