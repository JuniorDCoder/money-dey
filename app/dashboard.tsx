import SummaryPieChart from '@/components/charts/summary-pie-chart';
import BottomTabs from '@/components/ui/bottom-tabs';
import Shimmer from '@/components/ui/shimmer';
import SummaryCard from '@/components/ui/summary-card';
import TopActions from '@/components/ui/top-actions';
import * as C from '@/constants/colors';
import { useTransactions } from '@/hooks/use-transactions';
import { auth, db } from '@/lib/firebase';
import { Debt, Repayment, Transaction, UserProfile } from '@/types/models';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

export default function Dashboard() {
    const router = useRouter();
    // If a user is signed in, use live Firestore; otherwise fall back to mock data for preview
    const currentUid = auth?.currentUser?.uid;
    const useMock = !currentUid; // use mock when not signed-in
    const effectiveUserId = useMock ? undefined : currentUid;

    const { transactions, loading, aggregates, refetch } = useTransactions({ userId: effectiveUserId, useMock });
    const [refreshing, setRefreshing] = useState(false);

    const [debts, setDebts] = useState<Debt[]>([]);
    const [repayments, setRepayments] = useState<Repayment[]>([]);

    // Simple fade-in animations using Animated API
    const headerAnim = useRef(new Animated.Value(0)).current;
    const cardsAnim = useRef(new Animated.Value(0)).current;
    const txAnim = useRef(new Animated.Value(0)).current; // Separate animation for transactions

    // User display name
    const [displayName, setDisplayName] = useState<string | null>(auth?.currentUser?.displayName || null);

    useEffect(() => {
        Animated.sequence([
            Animated.timing(headerAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true
            }),
            Animated.timing(cardsAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true
            }),
            // Use native driver false for text-heavy animations
            Animated.timing(txAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: false // Changed to false for better text rendering
            }),
        ]).start();
    }, [headerAnim, cardsAnim, txAnim]);

    // Try to load user profile from Firestore for nicer name
    useEffect(() => {
        let mounted = true;
        async function loadProfile() {
            if (!currentUid) return;
            try {
                const d = await getDoc(doc(db, 'users', currentUid));
                if (d.exists() && mounted) {
                    const data = d.data() as Partial<UserProfile>;
                    if (data.name) setDisplayName(data.name);
                }
            } catch (e) {
                console.log('Failed to load user profile', e);
            }
        }
        loadProfile();
        return () => { mounted = false; };
    }, [currentUid]);

    // Load debts to drive owed/owing cards and labels
    useEffect(() => {
        if (!currentUid) {
            setDebts([]);
            return;
        }

        const q = query(collection(db, 'debts'), where('ownerId', '==', currentUid));
        const unsub = onSnapshot(q, (snap) => {
            const items: Debt[] = [];
            snap.forEach((d) => items.push({ id: d.id, ...(d.data() as any) }));
            setDebts(items);
        }, (err) => {
            console.log('Dashboard debts load error', err);
        });

        return () => unsub();
    }, [currentUid]);

    // Load repayments to track payment history
    useEffect(() => {
        if (!currentUid) {
            setRepayments([]);
            return;
        }

        const q = query(collection(db, 'repayments'), where('userId', '==', currentUid));
        const unsub = onSnapshot(q, (snap) => {
            const items: Repayment[] = [];
            snap.forEach((d) => items.push({ id: d.id, ...(d.data() as any) }));
            setRepayments(items);
        }, (err) => {
            console.log('Dashboard repayments load error', err);
        });

        return () => unsub();
    }, [currentUid]);

    const onRefresh = async () => {
        try {
            setRefreshing(true);
            await refetch();
        } finally {
            setRefreshing(false);
        }
    };

    const handleDelete = async (t: Transaction) => {
        // preview/mock mode: inform user
        if (useMock) {
            Toast.show({ type: 'info', text1: 'Preview mode', text2: 'Deleting transactions is not available in preview.' });
            return;
        }

        try {
            await deleteDoc(doc(db, 'transactions', t.id));
            Toast.show({ type: 'success', text1: 'Deleted', text2: 'Transaction removed.' });
            // refresh list
            await refetch();
        } catch (e) {
            console.log('Delete failed', e);
            Toast.show({ type: 'error', text1: 'Delete failed', text2: 'Could not remove transaction. Try again.' });
        }
    };

    const debtSummary = useMemo(() => {
        return debts.reduce(
            (acc, cur) => {
                // Use remainingAmount to show actual outstanding balance after repayments
                const amt = Number(cur.remainingAmount ?? cur.amount) || 0;
                if (cur.direction === 'owed') acc.owed += amt;
                else acc.owing += amt;
                return acc;
            },
            { owed: 0, owing: 0 }
        );
    }, [debts]);

    // Build 6-month window for charting
    const monthBuckets = useMemo(() => {
        const now = new Date();
        return Array.from({ length: 6 }).map((_, idx) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
            return {
                label: d.toLocaleString(undefined, { month: 'short' }),
                year: d.getFullYear(),
                month: d.getMonth(),
            };
        });
    }, []);

    const analyticsData = useMemo(() => {
        // Colors aligned with SummaryCard rows
        return [
            { label: 'Income', value: Number(aggregates.income || 0), color: C.PRIMARY_PURPLE },
            { label: 'Expenses', value: Number(aggregates.expense || 0), color: C.ACCENT_BLUE },
            { label: 'Owed to you', value: Number(debtSummary.owed || 0), color: '#10B981' },
            { label: 'You owe', value: Number(debtSummary.owing || 0), color: '#F97316' },
        ];
    }, [aggregates.income, aggregates.expense, debtSummary.owed, debtSummary.owing]);

    const findDebtName = (t: Transaction) => {
        if (t.counterpartyName) return t.counterpartyName;
        if (t.debtId) {
            const matchById = debts.find((d) => d.id === t.debtId);
            if (matchById?.counterpartyName) return matchById.counterpartyName;
        }
        const match = debts.find((d) => Math.round(Number(d.amount)) === Math.round(Number(t.amount)));
        return match?.counterpartyName;
    };

    return (
        <SafeAreaView style={styles.container}>
            <TopActions />
            <ScrollView
                contentContainerStyle={{ paddingBottom: 120, paddingTop: 40, paddingHorizontal: 20 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.PRIMARY_PURPLE} colors={[C.PRIMARY_PURPLE]} />}
            >
                {loading ? (
                    <Shimmer height={96} borderRadius={20} />
                ) : (
                    <Animated.View style={[styles.headerCard, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }] }>
                        <Text style={styles.title}>Welcome {displayName ? `${displayName} 👋` : '👋'}</Text>
                        <Text style={styles.subtitle}>A smart view of your finances — income vs expenses</Text>
                    </Animated.View>
                )}

                {loading ? (
                    <View style={styles.summaryRow}>
                        <Shimmer height={88} borderRadius={14} style={{ flex: 1, marginRight: 8 }} />
                        <Shimmer height={88} borderRadius={14} style={{ flex: 1, marginLeft: 8 }} />
                    </View>
                ) : (
                    <Animated.View style={[styles.summaryRow, { opacity: cardsAnim }] }>
                        <SummaryCard title="Total Income" amount={aggregates.income} subtitle="This month" />
                        <SummaryCard title="Expenses" amount={aggregates.expense} subtitle="This month" color={C.ACCENT_BLUE} />
                    </Animated.View>
                )}

                {loading ? (
                    <View style={[styles.summaryRow, { marginTop: 8 }]}>
                        <Shimmer height={88} borderRadius={14} style={{ flex: 1, marginRight: 8 }} />
                        <Shimmer height={88} borderRadius={14} style={{ flex: 1, marginLeft: 8 }} />
                    </View>
                ) : (
                    <Animated.View style={[styles.summaryRow, { opacity: cardsAnim, marginTop: 8 }] }>
                        <SummaryCard title="Owed to you" amount={debtSummary.owed} subtitle="People owe you" color={'#10B981'} />
                        <SummaryCard title="You owe" amount={debtSummary.owing} subtitle="You owe others" color={'#F97316'} />
                    </Animated.View>
                )}

                <View style={styles.chartContainer}>
                    {loading ? (
                        <Shimmer height={220} borderRadius={16} />
                    ) : (
                        <SummaryPieChart data={analyticsData} />
                    )}
                </View>

                <View style={{ height: 24 }} />

                <View style={styles.recentContainer}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent transactions</Text>
                        {!loading && transactions.length > 0 && (
                            <Pressable onPress={() => router.push('/transactions')} hitSlop={8}>
                                <Text style={styles.linkText}>Show all →</Text>
                            </Pressable>
                        )}
                    </View>
                    {loading ? (
                        <View>
                            {[0,1,2,3].map((i) => (
                                <Shimmer key={i} height={68} borderRadius={12} style={{ marginBottom: 10 }} />
                            ))}
                        </View>
                    ) : transactions.length === 0 ? (
                        <View style={styles.emptyBox}>
                            <Text style={styles.emptyText}>No transactions yet — add your first expense or income.</Text>
                        </View>
                    ) : (
                        transactions.slice(0, 4).map((t, index) => (
                            <Swipeable
                                key={t.id}
                                renderRightActions={() => (
                                    <Pressable onPress={() => handleDelete(t)} style={styles.deleteAction}>
                                        <Text style={styles.deleteText}>Delete</Text>
                                    </Pressable>
                                )}
                            >
                                <Animated.View style={[
                                    styles.txRow,
                                    {
                                        opacity: txAnim,
                                        // Optional: Staggered animation for each item
                                        transform: [{
                                            translateY: txAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [20, 0]
                                            })
                                        }]
                                    }
                                ]}>
                                    <View style={styles.txLeft}>
                                        <Text style={styles.txCategory}>
                                            {t.type === 'debt' || t.type === 'repayment'
                                                ? findDebtName(t) || t.category || 'Debt'
                                                : t.category || t.type}
                                        </Text>
                                        <Text style={styles.txNotes}>
                                            {t.notes || (t.type === 'debt' ? 'Debt recorded' : '')}
                                        </Text>
                                    </View>
                                    <Text style={[
                                        styles.txAmount,
                                        t.type === 'income' ? styles.incomeColor : styles.expenseColor
                                    ]}>
                                        {t.type === 'income' ? '+' : '-'}
                                        {new Intl.NumberFormat(undefined, {
                                            style: 'currency',
                                            currency: 'XAF',
                                            maximumFractionDigits: 0
                                        }).format(t.amount)}
                                    </Text>
                                </Animated.View>
                            </Swipeable>
                        ))
                    )}
                </View>

            </ScrollView>

            <Pressable style={styles.aiFab} accessibilityLabel="See recommendations" onPress={() => router.push('/recommendations')}>
                <MaterialCommunityIcons name="robot-happy-outline" size={22} color={C.TEXT_ON_PURPLE} />
            </Pressable>
            <Pressable style={styles.fab} accessibilityLabel="Add transaction" onPress={() => router.push('/transactions/add')}>
                <Text style={{ color: C.TEXT_ON_PURPLE, fontSize: 28, fontWeight: '900' }}>+</Text>
            </Pressable>
            {/* Bottom navigation stays on top of content */}
            <BottomTabs />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.BACKGROUND_LIGHT,
        
    },
    headerCard: {
        backgroundColor: C.PRIMARY_PURPLE,
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        alignItems: 'center'
    },
    title: {
        color: C.TEXT_ON_PURPLE,
        fontSize: 22,
        fontWeight: '800',
        textShadowColor: 'rgba(0, 0, 0, 0.1)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    subtitle: {
        color: '#F0EBFF',
        textAlign: 'center',
        marginTop: 6,
        opacity: 0.9,
    },
    summaryRow: {
        flexDirection: 'row',
        marginTop: 16,
        justifyContent: 'space-around'
    },
    chartContainer: {
        marginTop: 18,
        alignItems: 'center'
    },
    recentContainer: {
        marginTop: 18
    },
    sectionTitle: {
        fontSize: 16,
        color: C.TEXT_PRIMARY,
        fontWeight: '800',
        marginBottom: 12
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12
    },
    linkText: {
        color: C.PRIMARY_PURPLE,
        fontWeight: '800',
        fontSize: 13
    },
    emptyBox: {
        padding: 18,
        borderRadius: 12,
        backgroundColor: C.CARD_LIGHT,
        borderWidth: 1,
        borderColor: C.BORDER
    },
    emptyText: {
        color: C.TEXT_SECONDARY
    },
    txRow: {
        backgroundColor: C.CARD_LIGHT,
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: C.BORDER
    },
    txLeft: {
        flex: 1,
        marginRight: 12,
    },
    txCategory: {
        fontWeight: '700',
        color: C.TEXT_PRIMARY,
        fontSize: 15,
        includeFontPadding: false, // Helps with text rendering
        textAlignVertical: 'center',
    },
    txNotes: {
        color: C.TEXT_SECONDARY,
        marginTop: 4,
        fontSize: 13,
        includeFontPadding: false,
        textAlignVertical: 'center',
    },
    txAmount: {
        fontWeight: '800',
        fontSize: 16,
        includeFontPadding: false,
        textAlignVertical: 'center',
    },
    incomeColor: {
        color: '#10B981',
        textShadowColor: 'rgba(16, 185, 129, 0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    expenseColor: {
        color: '#EF4444',
        textShadowColor: 'rgba(239, 68, 68, 0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    deleteAction: {
        backgroundColor: '#FECDD3',
        justifyContent: 'center',
        alignItems: 'center',
        width: 90,
        borderRadius: 12,
        marginLeft: 8,
        height: 68
    },
    deleteText: {
        color: '#9B1C1C',
        fontWeight: '800'
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 120,
        backgroundColor: C.PRIMARY_PURPLE,
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#7C3AED',
        shadowOpacity: 0.2,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
        elevation: 14,
    },
    aiFab: {
        position: 'absolute',
        right: 25,
        bottom: 200,
        backgroundColor: '#0EA5E9',
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#0EA5E9',
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10
    },
});