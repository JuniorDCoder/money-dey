import BottomTabs from '@/components/ui/bottom-tabs';
import Shimmer from '@/components/ui/shimmer';
import * as C from '@/constants/colors';
import { auth, db } from '@/lib/firebase';
import { Debt, Repayment, Transaction } from '@/types/models';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

type Params = { id?: string };

export default function AddTransaction() {
    const router = useRouter();
    const params = useLocalSearchParams() as Params;
    const editingId = params?.id;

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'debt' | 'repayment'>('expense');
  const [loading, setLoading] = useState(false);
    const [initializing, setInitializing] = useState(!!editingId);

    // Fields for debt/repayment
    const [counterpartyName, setCounterpartyName] = useState('');
    const [debtDirection, setDebtDirection] = useState<'owed' | 'owing'>('owing');
    const [dueDate, setDueDate] = useState('');
    const [debtId, setDebtId] = useState<string | undefined>(undefined);

    // Repayment specific fields
    const [availableDebts, setAvailableDebts] = useState<Debt[]>([]);
    const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
    const [showDebtPicker, setShowDebtPicker] = useState(false);
    const [loadingDebts, setLoadingDebts] = useState(false);

    useEffect(() => {
        if (!editingId) return;
        (async () => {
            try {
                setInitializing(true);
                const snap = await getDoc(doc(db, 'transactions', editingId));
                if (snap.exists()) {
                    const data = snap.data() as any;
          setAmount(String(data.amount || ''));
          setCategory(data.category || '');
          setNotes(data.notes || '');
          setType(data.type || 'expense');
          setDate(data.date ? (data.date.toDate ? data.date.toDate() : new Date(data.date)) : new Date());
          if (data.type === 'debt' || data.type === 'repayment') {
            setCounterpartyName(data.counterpartyName || data.counterparty || '');
            setDebtDirection((data.direction as any) || 'owing');
            setDebtId(data.debtId || data.debt_id || undefined);
            if (data.dueDate) {
              setDueDate(data.dueDate.toDate ? data.dueDate.toDate().toISOString().slice(0, 10) : String(data.dueDate).slice(0, 10));
            }

            // If we have a linked debt, load fresher details from debts collection
            const linkedId = data.debtId || data.debt_id;
            if (linkedId) {
                try {
                    const debtSnap = await getDoc(doc(db, 'debts', linkedId));
                    if (debtSnap.exists()) {
                        const debt = debtSnap.data() as any;
                        setCounterpartyName(debt.counterpartyName || counterpartyName || '');
                        setDebtDirection(debt.direction || debtDirection);
                        if (debt.dueDate) setDueDate(debt.dueDate.slice(0, 10));
                        
                        // For repayment editing, set selected debt
                        if (data.type === 'repayment') {
                            setSelectedDebt({ id: linkedId, ...debt } as Debt);
                        }
                    }
                } catch {}
            }
          }
                } else {
                    Toast.show({ type: 'error', text1: 'Not found', text2: 'Transaction not found.' });
                }
            } catch (e) {
                console.log('Load tx', e);
                Toast.show({ type: 'error', text1: 'Could not load', text2: 'Failed to load transaction for editing.' });
            } finally {
                setInitializing(false);
            }
        })();
    }, [editingId]);

    // Load available debts when type switches to repayment
    useEffect(() => {
        if (type !== 'repayment' || editingId) return;
        
        const uid = auth.currentUser?.uid;
        if (!uid) return;

        (async () => {
            setLoadingDebts(true);
            try {
                const q = query(
                    collection(db, 'debts'),
                    where('ownerId', '==', uid)
                );
                const snapshot = await getDocs(q);
                const debts: Debt[] = [];
                snapshot.forEach((d) => {
                    const data = d.data() as any;
                    const remaining = data.remainingAmount ?? data.amount;
                    // Only show debts that aren't fully paid
                    if (remaining > 0) {
                        debts.push({
                            id: d.id,
                            ...data,
                            remainingAmount: remaining,
                        } as Debt);
                    }
                });
                setAvailableDebts(debts);
            } catch (e) {
                console.log('Load debts error', e);
                Toast.show({ type: 'error', text1: 'Could not load debts', text2: 'Unable to fetch your debts.' });
            } finally {
                setLoadingDebts(false);
            }
        })();
    }, [type, editingId]);

    const validate = () => {
        if (!amount || Number(isNaN(Number(amount)) ? 0 : Number(amount)) <= 0) {
            Toast.show({ type: 'error', text1: 'Invalid amount', text2: 'Please enter a valid amount greater than zero.' });
            return false;
        }

        if (!category && (type === 'income' || type === 'expense')) {
            Toast.show({ type: 'error', text1: 'Category required', text2: 'Please enter a category for this transaction.' });
            return false;
        }

        if (type === 'debt') {
            if (!counterpartyName || counterpartyName.trim() === '') {
                Toast.show({ type: 'error', text1: 'Name required', text2: 'Please enter the person\'s name.' });
                return false;
            }
        }

        if (type === 'repayment') {
            if (!selectedDebt && !editingId) {
                Toast.show({ type: 'error', text1: 'Select debt', text2: 'Please select a debt to repay.' });
                return false;
            }
            const repayAmount = Number(amount);
            const remaining = selectedDebt?.remainingAmount ?? selectedDebt?.amount ?? 0;
            if (repayAmount > remaining && !editingId) {
                Toast.show({ 
                    type: 'error', 
                    text1: 'Amount too large', 
                    text2: `Repayment cannot exceed remaining balance of ${remaining.toLocaleString()} XAF.` 
                });
                return false;
            }
        }

        return true;
    };

    const handleSave = async () => {
        if (!validate()) return;
        const uid = auth.currentUser?.uid;
        if (!uid) {
            Toast.show({ type: 'error', text1: 'Not signed in', text2: 'Please sign in to save transactions.' });
            router.replace('/auth/login');
            return;
        }

        setLoading(true);
        try {
            const sanitize = (obj: Record<string, any>) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
            const parsedDue = dueDate ? new Date(dueDate) : null;
            const dueIso = parsedDue && !isNaN(parsedDue.getTime()) ? parsedDue.toISOString() : null;

            const basePayload: Partial<Transaction> = {
                userId: uid,
                amount: Number(amount),
                type,
                category: isDebtType ? 'Debt' : category,
                notes,
                date: date.toISOString(),
            };

            if (!editingId) {
                (basePayload as any).createdAt = serverTimestamp();
            }

            // Handle repayment type
            if (type === 'repayment') {
                const repayAmount = Number(amount);
                const debt = selectedDebt || (debtId ? await getDoc(doc(db, 'debts', debtId)).then(s => s.exists() ? { id: s.id, ...s.data() } as Debt : null) : null);
                
                if (!debt) {
                    Toast.show({ type: 'error', text1: 'Debt not found', text2: 'The linked debt could not be found.' });
                    setLoading(false);
                    return;
                }

                const previousBalance = debt.remainingAmount ?? debt.amount;
                const newBalance = Math.max(0, previousBalance - repayAmount);
                const newStatus: 'pending' | 'partial' | 'paid' = newBalance === 0 ? 'paid' : (previousBalance === debt.amount ? 'partial' : debt.status || 'partial');

                (basePayload as any).counterpartyName = debt.counterpartyName;
                (basePayload as any).direction = debt.direction;
                (basePayload as any).debtId = debt.id;
                (basePayload as any).previousBalance = previousBalance;
                (basePayload as any).newBalance = newBalance;

                if (editingId) {
                    // Editing existing repayment
                    await updateDoc(doc(db, 'transactions', editingId), sanitize({
                        ...basePayload,
                        updatedAt: serverTimestamp() as any
                    }));

                    // Update or create corresponding repayment record
                    const repaymentSnap = await getDocs(query(collection(db, 'repayments'), where('transactionId', '==', editingId)));
                    if (!repaymentSnap.empty) {
                        const repaymentDoc = repaymentSnap.docs[0];
                        await updateDoc(doc(db, 'repayments', repaymentDoc.id), {
                            amount: repayAmount,
                            date: date.toISOString(),
                            notes,
                            updatedAt: serverTimestamp(),
                        });
                    }

                    Toast.show({ type: 'success', text1: 'Updated', text2: 'Repayment updated successfully.' });
                } else {
                    // Creating new repayment
                    const txRef = await addDoc(collection(db, 'transactions'), sanitize(basePayload) as any);

                    // Create repayment record
                    const repaymentPayload: Partial<Repayment> = {
                        userId: uid,
                        debtId: debt.id,
                        transactionId: txRef.id,
                        amount: repayAmount,
                        date: date.toISOString(),
                        notes,
                        counterpartyName: debt.counterpartyName,
                        direction: debt.direction,
                        previousBalance,
                        newBalance,
                        createdAt: serverTimestamp() as any,
                    };
                    await addDoc(collection(db, 'repayments'), sanitize(repaymentPayload) as any);

                    // Update debt with new balance and status
                    await updateDoc(doc(db, 'debts', debt.id), {
                        remainingAmount: newBalance,
                        status: newStatus,
                        updatedAt: serverTimestamp(),
                    });

                    Toast.show({ type: 'success', text1: 'Repayment recorded', text2: `Debt balance: ${newBalance.toLocaleString()} XAF` });
                }

                router.back();
                return;
            }

            // Handle debt type
            if (type === 'debt') {
                (basePayload as any).counterpartyName = counterpartyName.trim();
                (basePayload as any).direction = debtDirection;
            } else {
                (basePayload as any).counterpartyName = null;
                (basePayload as any).direction = null;
                (basePayload as any).debtId = null;
            }

            const debtPayload: any = type === 'debt' ? {
                ownerId: uid,
                counterpartyName: counterpartyName.trim(),
                amount: Number(amount),
                remainingAmount: Number(amount),
                currency: 'XAF',
                direction: debtDirection,
                status: 'pending',
                dueDate: dueIso,
                notes,
                updatedAt: serverTimestamp(),
            } : null;

            if (type === 'debt' && editingId) {
                // ensure debt exists or create one, then update both records
                let nextDebtId = debtId;
                if (nextDebtId) {
                    await updateDoc(doc(db, 'debts', nextDebtId), debtPayload as any);
                } else {
                    const created = await addDoc(collection(db, 'debts'), { ...debtPayload, createdAt: serverTimestamp() });
                    nextDebtId = created.id;
                    setDebtId(nextDebtId);
                }

                await updateDoc(doc(db, 'transactions', editingId), sanitize({
                    ...basePayload,
                    debtId: nextDebtId,
                    updatedAt: serverTimestamp() as any
                }));
                Toast.show({ type: 'success', text1: 'Updated', text2: 'Transaction updated successfully.' });
            } else if (type === 'debt' && !editingId) {
                // create debt first, then transaction referencing it
                const createdDebt = await addDoc(collection(db, 'debts'), { ...debtPayload, createdAt: serverTimestamp() });
                const debtRefId = createdDebt.id;
                await addDoc(collection(db, 'transactions'), sanitize({ ...basePayload, debtId: debtRefId }) as any);
                Toast.show({ type: 'success', text1: 'Saved', text2: 'Transaction added successfully.' });
                Toast.show({ type: 'success', text1: 'Debt saved', text2: 'Debt record created successfully.' });
            } else {
                // non-debt path
                if (editingId) {
                    await updateDoc(doc(db, 'transactions', editingId), sanitize({
                        ...basePayload,
                        debtId: null,
                        updatedAt: serverTimestamp() as any
                    }));
                    Toast.show({ type: 'success', text1: 'Updated', text2: 'Transaction updated successfully.' });
                } else {
                    await addDoc(collection(db, 'transactions'), sanitize({ ...basePayload, debtId: null }) as any);
                    Toast.show({ type: 'success', text1: 'Saved', text2: 'Transaction added successfully.' });
                }
            }

            router.back();
        } catch (e: any) {
            console.log('Save tx', e);
            Toast.show({
                type: 'error',
                text1: 'Could not save',
                text2: e?.message || 'An error occurred while saving.'
            });
        } finally {
            setLoading(false);
        }
    };

    const isDebtType = type === 'debt' || type === 'repayment';

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoid}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.title}>
                        {editingId ? 'Edit Transaction' : 'Add Transaction'}
                    </Text>

                    {initializing && editingId ? (
                        <View style={{ gap: 12, marginVertical: 12 }}>
                            {[0,1,2,3,4].map((i) => (
                                <Shimmer key={i} height={48} borderRadius={12} />
                            ))}
                        </View>
                    ) : (
                        <>

                    <Text style={styles.label}>Type</Text>
                    <View style={styles.typeRow}>
                        {(['income', 'expense', 'debt', 'repayment'] as const).map((t) => (
                            <Pressable
                                key={t}
                                style={[
                                    styles.typeBtn,
                                    type === t && { backgroundColor: C.PRIMARY_PURPLE }
                                ]}
                                onPress={() => {
                                    setType(t);
                                    // Reset counterparty name when switching away from debt/repayment
                                    if (!(t === 'debt' || t === 'repayment')) {
                                        setCounterpartyName('');
                                    }
                                }}
                            >
                                <Text style={[
                                    styles.typeText,
                                    type === t && { color: C.TEXT_ON_PURPLE }
                                ]}>
                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    <Text style={styles.label}>Amount (XAF)</Text>
                    <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        value={amount}
                        onChangeText={setAmount}
                        placeholder="0.00"
                    />

                    {!isDebtType && (
                        <>
                            <Text style={styles.label}>Category</Text>
                            <TextInput
                                style={styles.input}
                                value={category}
                                onChangeText={setCategory}
                                placeholder="e.g., Food, Salary, Rent"
                            />
                        </>
                    )}

                    {type === 'repayment' && (
                        <>
                            <Text style={styles.label}>Select Debt to Repay *</Text>
                            {loadingDebts ? (
                                <Shimmer height={48} borderRadius={12} />
                            ) : (
                                <Pressable 
                                    style={styles.debtPickerBtn} 
                                    onPress={() => {
                                        if (availableDebts.length === 0) {
                                            Toast.show({ type: 'info', text1: 'No debts', text2: 'You have no outstanding debts to repay.' });
                                        } else {
                                            setShowDebtPicker(true);
                                        }
                                    }}
                                    disabled={editingId !== undefined}
                                >
                                    <Text style={selectedDebt ? styles.debtPickerTextSelected : styles.debtPickerTextPlaceholder}>
                                        {selectedDebt 
                                            ? `${selectedDebt.counterpartyName} - ${(selectedDebt.remainingAmount ?? selectedDebt.amount).toLocaleString()} XAF ${selectedDebt.direction === 'owed' ? '(they owe you)' : '(you owe them)'}`
                                            : availableDebts.length === 0
                                            ? 'No outstanding debts'
                                            : 'Tap to select a debt'
                                        }
                                    </Text>
                                </Pressable>
                            )}

                            {selectedDebt && (
                                <View style={styles.debtInfo}>
                                    <Text style={styles.debtInfoLabel}>Remaining Balance:</Text>
                                    <Text style={styles.debtInfoValue}>{(selectedDebt.remainingAmount ?? selectedDebt.amount).toLocaleString()} XAF</Text>
                                </View>
                            )}
                        </>
                    )}

                    {type === 'debt' && (
                        <>
                            <Text style={styles.label}>Person&#39;s Name *</Text>
                            <TextInput
                                style={styles.input}
                                value={counterpartyName}
                                onChangeText={setCounterpartyName}
                                placeholder="Enter the person's name"
                                autoCapitalize="words"
                            />

                            <Text style={styles.label}>Direction *</Text>
                            <View style={styles.typeRow}>
                                <Pressable
                                    style={[
                                        styles.typeBtn,
                                        debtDirection === 'owed' && {
                                            backgroundColor: C.PRIMARY_PURPLE
                                        }
                                    ]}
                                    onPress={() => setDebtDirection('owed')}
                                >
                                    <Text style={[
                                        styles.typeText,
                                        debtDirection === 'owed' && {
                                            color: C.TEXT_ON_PURPLE
                                        }
                                    ]}>
                                        They owe me
                                    </Text>
                                </Pressable>
                                <Pressable
                                    style={[
                                        styles.typeBtn,
                                        debtDirection === 'owing' && {
                                            backgroundColor: C.PRIMARY_PURPLE
                                        }
                                    ]}
                                    onPress={() => setDebtDirection('owing')}
                                >
                                    <Text style={[
                                        styles.typeText,
                                        debtDirection === 'owing' && {
                                            color: C.TEXT_ON_PURPLE
                                        }
                                    ]}>
                                        I owe them
                                    </Text>
                                </Pressable>
                            </View>

                            <Text style={styles.label}>Due Date (Optional)</Text>
                            <TextInput
                                style={styles.input}
                                value={dueDate}
                                onChangeText={setDueDate}
                                placeholder="YYYY-MM-DD"
                            />
                        </>
                    )}

                    <Text style={styles.label}>Date</Text>
                    <Pressable style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                        <Text style={styles.datePickerText}>{date.toLocaleDateString()}</Text>
                    </Pressable>

                    {showDatePicker && (
                        <DateTimePicker
                            value={date}
                            mode="date"
                            display="default"
                            onChange={(event, selectedDate) => {
                                setShowDatePicker(false);
                                if (selectedDate) {
                                    setDate(selectedDate);
                                }
                            }}
                        />
                    )}

                    <Text style={styles.label}>Notes (Optional)</Text>
                    <TextInput
                        style={[styles.input, { height: 80 }]}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Add any additional notes..."
                        multiline
                        textAlignVertical="top"
                    />

                    <Pressable
                        style={[
                            styles.save,
                            (loading || initializing) && { opacity: 0.6 }
                        ]}
                        onPress={handleSave}
                        disabled={loading || initializing}
                    >
                        {loading || initializing ? (
                            <ActivityIndicator color={C.TEXT_ON_PURPLE} size="small" />
                        ) : (
                            <Text style={styles.saveText}>
                                {editingId ? 'Update' : 'Save'}
                            </Text>
                        )}
                    </Pressable>

                    {/* Add extra padding at bottom for better spacing */}
                    <View style={{ height: 100 }} />
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Debt Picker Modal */}
            <Modal visible={showDebtPicker} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Select Debt to Repay</Text>
                            <Pressable onPress={() => setShowDebtPicker(false)}>
                                <Text style={styles.modalClose}>✕</Text>
                            </Pressable>
                        </View>
                        <ScrollView style={styles.modalScroll}>
                            {availableDebts.map((debt) => {
                                const remaining = debt.remainingAmount ?? debt.amount;
                                const isSelected = selectedDebt?.id === debt.id;
                                return (
                                    <Pressable
                                        key={debt.id}
                                        style={[styles.debtOption, isSelected && styles.debtOptionSelected]}
                                        onPress={() => {
                                            setSelectedDebt(debt);
                                            setDebtId(debt.id);
                                            setCounterpartyName(debt.counterpartyName);
                                            setDebtDirection(debt.direction);
                                            setShowDebtPicker(false);
                                        }}
                                    >
                                        <View style={styles.debtOptionLeft}>
                                            <Text style={styles.debtOptionName}>{debt.counterpartyName}</Text>
                                            <Text style={styles.debtOptionDirection}>
                                                {debt.direction === 'owed' ? 'They owe you' : 'You owe them'}
                                            </Text>
                                        </View>
                                        <View style={styles.debtOptionRight}>
                                            <Text style={styles.debtOptionAmount}>{remaining.toLocaleString()} XAF</Text>
                                            {debt.status && debt.status !== 'pending' && (
                                                <Text style={styles.debtOptionStatus}>{debt.status}</Text>
                                            )}
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            <BottomTabs />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.BACKGROUND_LIGHT
    },
    keyboardAvoid: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        color: C.TEXT_PRIMARY,
        marginTop: 12,
        marginBottom: 16
    },
    label: {
        marginTop: 16,
        color: C.TEXT_SECONDARY,
        fontWeight: '800',
        fontSize: 14
    },
    input: {
        backgroundColor: C.CARD_LIGHT,
        padding: 12,
        borderRadius: 10,
        marginTop: 8,
        borderWidth: 1,
        borderColor: C.BORDER,
        fontSize: 16,
        color: C.TEXT_PRIMARY
    },
    datePickerBtn: {
        backgroundColor: C.CARD_LIGHT,
        padding: 14,
        borderRadius: 10,
        marginTop: 8,
        borderWidth: 1,
        borderColor: C.BORDER,
        alignItems: 'center'
    },
    datePickerText: {
        fontSize: 16,
        color: C.TEXT_PRIMARY,
        fontWeight: '600'
    },
    typeRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
        flexWrap: 'wrap'
    },
    typeBtn: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        backgroundColor: C.CARD_LIGHT,
        borderWidth: 1,
        borderColor: C.BORDER,
        minWidth: 80
    },
    typeText: {
        fontWeight: '800',
        color: C.TEXT_PRIMARY,
        fontSize: 14
    },
    save: {
        marginTop: 32,
        backgroundColor: C.PRIMARY_PURPLE,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 40
    },
    saveText: {
        color: C.TEXT_ON_PURPLE,
        fontWeight: '900',
        fontSize: 16
    },
    debtPickerBtn: {
        backgroundColor: C.CARD_LIGHT,
        padding: 14,
        borderRadius: 10,
        marginTop: 8,
        borderWidth: 1,
        borderColor: C.BORDER,
    },
    debtPickerTextSelected: {
        fontSize: 15,
        color: C.TEXT_PRIMARY,
        fontWeight: '600',
    },
    debtPickerTextPlaceholder: {
        fontSize: 15,
        color: C.TEXT_SECONDARY,
        fontWeight: '500',
    },
    debtInfo: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#EEF2FF',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E0E7FF',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    debtInfoLabel: {
        color: '#4338CA',
        fontWeight: '700',
        fontSize: 14,
    },
    debtInfoValue: {
        color: '#4338CA',
        fontWeight: '900',
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: C.BACKGROUND_LIGHT,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%',
        paddingBottom: 30,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: C.BORDER,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: C.TEXT_PRIMARY,
    },
    modalClose: {
        fontSize: 28,
        color: C.TEXT_SECONDARY,
        fontWeight: '300',
    },
    modalScroll: {
        padding: 16,
    },
    debtOption: {
        backgroundColor: C.CARD_LIGHT,
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: C.BORDER,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    debtOptionSelected: {
        borderColor: C.PRIMARY_PURPLE,
        borderWidth: 2,
        backgroundColor: '#F5F3FF',
    },
    debtOptionLeft: {
        flex: 1,
    },
    debtOptionName: {
        fontSize: 16,
        fontWeight: '800',
        color: C.TEXT_PRIMARY,
        marginBottom: 4,
    },
    debtOptionDirection: {
        fontSize: 13,
        color: C.TEXT_SECONDARY,
        fontWeight: '600',
    },
    debtOptionRight: {
        alignItems: 'flex-end',
    },
    debtOptionAmount: {
        fontSize: 18,
        fontWeight: '900',
        color: C.PRIMARY_PURPLE,
        marginBottom: 2,
    },
    debtOptionStatus: {
        fontSize: 11,
        color: '#F59E0B',
        fontWeight: '700',
        textTransform: 'capitalize',
    },
});