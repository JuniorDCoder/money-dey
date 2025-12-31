import SummaryPieChart from '@/components/charts/summary-pie-chart';
import BottomTabs from '@/components/ui/bottom-tabs';
import OfflineBanner from '@/components/ui/offline-banner';
import Shimmer from '@/components/ui/shimmer';
import SummaryCard from '@/components/ui/summary-card';
import SyncStatusIndicator from '@/components/ui/sync-status-indicator';
import TopActions from '@/components/ui/top-actions';
import * as C from '@/constants/colors';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { useTransactionsWithQueue } from '@/hooks/use-transactions-with-queue';
import { auth, db } from '@/lib/firebase';
import { Debt, Repayment, Transaction, UserProfile } from '@/types/models';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

export default function Dashboard() {
    const router = useRouter();
    // If a user is signed in, use live Firestore; otherwise fall back to mock data for preview
    const currentUid = auth?.currentUser?.uid;
    const useMock = !currentUid; // use mock when not signed-in
    const effectiveUserId = useMock ? undefined : currentUid;

    const { transactions, loading, aggregates, refetch } = useTransactionsWithQueue({ userId: effectiveUserId, useMock });
    const [refreshing, setRefreshing] = useState(false);

    // Network and sync state
    const networkStatus = useNetworkStatus();
    const syncState = useOfflineSync();

    const [debts, setDebts] = useState<Debt[]>([]);
    const [repayments, setRepayments] = useState<Repayment[]>([]);

    // Simple fade-in animations using Animated API
    const headerAnim = useRef(new Animated.Value(0)).current;
    const cardsAnim = useRef(new Animated.Value(0)).current;
    const txAnim = useRef(new Animated.Value(0)).current; // Separate animation for transactions

    // User display name
    const [displayName, setDisplayName] = useState<string | null>(auth?.currentUser?.displayName || null);

    // Feature tour state
    const [showFeatureTour, setShowFeatureTour] = useState(false);
    const [currentTourStep, setCurrentTourStep] = useState(0);
    const tourOpacity = useRef(new Animated.Value(0)).current;

    const featureSteps = [
        { title: 'Welcome! 👋', description: 'See your income, expenses, and financial overview at a glance.' },
        { title: 'Offline support', description: 'Keep working without internet — changes queue locally and sync automatically when you reconnect.', icon: 'cloud-off' },
        { title: 'Add Transactions', description: 'Track every transaction — income, expenses, and debts right from here.', icon: 'plus-circle' },
        { title: 'Get Recommendations', description: 'AI-powered tips to help you make smarter financial decisions.', icon: 'lightbulb' },
        { title: 'View All Transactions', description: 'Access detailed transaction history and manage your finances.', icon: 'history' },
    ];

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

        // Show feature tour only on first dashboard visit
        checkFirstDashboardVisit();
    }, [headerAnim, cardsAnim, txAnim]);

    const checkFirstDashboardVisit = async () => {
        try {
            const visited = await SecureStore.getItemAsync('dashboard_visited');
            if (!visited) {
                await SecureStore.setItemAsync('dashboard_visited', 'true');
                setTimeout(() => {
                    setShowFeatureTour(true);
                    animateTourIn();
                }, 1200);
            }
        } catch (e) {
            console.log('Failed to check dashboard visit', e);
        }
    };

    const animateTourIn = () => {
        Animated.timing(tourOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true
        }).start();
    };

    const handleNextTourStep = () => {
        if (currentTourStep < featureSteps.length - 1) {
            setCurrentTourStep(currentTourStep + 1);
        } else {
            closeTourWithAnimation();
        }
    };

    const closeTourWithAnimation = () => {
        Animated.timing(tourOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true
        }).start(() => {
            setShowFeatureTour(false);
            setCurrentTourStep(0);
        });
    };

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

    // Calculate available balance: income - expenses - debt_owed + repayments_made
    const availableBalance = useMemo(() => {
        const income = Number(aggregates.income || 0);
        const expenses = Number(aggregates.expense || 0);
        const owing = debtSummary.owing;
        return income - expenses - owing;
    }, [aggregates.income, aggregates.expense, debtSummary.owing]);

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
            <OfflineBanner
                isOnline={networkStatus.isOnline}
                isSyncing={syncState.isSyncing}
                pendingCount={syncState.pendingCount}
            />
            <TopActions />
            <ScrollView
                contentContainerStyle={{ paddingBottom: 120, paddingTop: 10, paddingHorizontal: 20 }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.PRIMARY_PURPLE} colors={[C.PRIMARY_PURPLE]} />}
            >
                {loading ? (
                    <Shimmer height={96} borderRadius={20} />
                ) : (
                    <Animated.View style={[styles.headerCard, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }] }>
                        <View style={styles.headerTitleRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.title}>Welcome {displayName ? `${displayName} 👋` : '👋'}</Text>
                                <Text style={styles.subtitle}>A smart view of your finances</Text>
                            </View>
                            <SyncStatusIndicator
                                isOnline={networkStatus.isOnline}
                                isSyncing={syncState.isSyncing}
                                hasFailures={syncState.failedCount > 0}
                            />
                        </View>
                    </Animated.View>
                )}

                {/* Available Balance Card */}
                {!loading && (
                    <Animated.View style={[styles.balanceCard, { opacity: cardsAnim }]}>
                        <View style={styles.balanceHeader}>
                            <Text style={styles.balanceLabel}>Available Balance</Text>
                            <MaterialCommunityIcons name="wallet" size={20} color={C.PRIMARY_PURPLE} />
                        </View>
                        <Text style={styles.balanceAmount}>
                            {new Intl.NumberFormat(undefined, {
                                style: 'currency',
                                currency: 'XAF',
                                maximumFractionDigits: 0
                            }).format(Math.max(0, availableBalance))}
                        </Text>
                        <Text style={[styles.balanceNote, { color: availableBalance >= 0 ? '#10B981' : '#EF4444' }]}>
                            {availableBalance >= 0 ? '✓ Good standing' : '⚠ Negative balance'}
                        </Text>
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

            {/* Feature Tour Modal */}
            <Modal visible={showFeatureTour} transparent animationType="none">
                <Animated.View style={[styles.tourOverlay, { opacity: tourOpacity }]}>
                    <View style={styles.blurContainer} />
                    <View style={styles.tourContent}>
                        <Pressable onPress={closeTourWithAnimation} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </Pressable>

                        <View style={styles.tourCard}>
                            {featureSteps[currentTourStep].icon && (
                                <View style={styles.tourIconContainer}>
                                    <MaterialCommunityIcons 
                                        name={featureSteps[currentTourStep].icon as any} 
                                        size={48} 
                                        color={C.PRIMARY_PURPLE} 
                                    />
                                </View>
                            )}
                            <Text style={styles.tourTitle}>{featureSteps[currentTourStep].title}</Text>
                            <Text style={styles.tourDescription}>{featureSteps[currentTourStep].description}</Text>

                            {/* Progress dots */}
                            <View style={styles.tourDots}>
                                {featureSteps.map((_, idx) => (
                                    <View
                                        key={idx}
                                        style={[
                                            styles.tourDot,
                                            idx === currentTourStep ? styles.tourDotActive : {}
                                        ]}
                                    />
                                ))}
                            </View>

                            <Pressable 
                                onPress={handleNextTourStep}
                                style={[styles.tourButton, { backgroundColor: C.PRIMARY_PURPLE }]}
                            >
                                <Text style={styles.tourButtonText}>
                                    {currentTourStep === featureSteps.length - 1 ? 'Get Started' : 'Next'}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </Animated.View>
            </Modal>
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
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
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
        marginTop: 6,
        opacity: 0.9,
    },
    balanceCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 20,
        marginTop: 16,
        borderWidth: 2,
        borderColor: C.PRIMARY_PURPLE,
        shadowColor: '#7C3AED',
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
    },
    balanceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    balanceLabel: {
        fontSize: 14,
        color: C.TEXT_SECONDARY,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    balanceAmount: {
        fontSize: 32,
        fontWeight: '900',
        color: C.PRIMARY_PURPLE,
        marginBottom: 8,
    },
    balanceNote: {
        fontSize: 13,
        fontWeight: '700',
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
    // Feature Tour Styles
    tourOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    blurContainer: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    tourContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        zIndex: 10000,
    },
    tourCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 28,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 12 },
        elevation: 20,
    },
    tourIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#EFEAFE',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    tourTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: C.TEXT_PRIMARY,
        marginBottom: 12,
        textAlign: 'center',
    },
    tourDescription: {
        fontSize: 14,
        color: C.TEXT_SECONDARY,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 20,
    },
    tourDots: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
        alignItems: 'center',
    },
    tourDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#E5E7EB',
    },
    tourDotActive: {
        width: 24,
        backgroundColor: C.PRIMARY_PURPLE,
    },
    tourButton: {
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
    },
    tourButtonText: {
        color: '#FFF',
        fontWeight: '900',
        fontSize: 16,
    },
    closeButton: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 10001,
        padding: 8,
    },
});