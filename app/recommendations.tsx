import BottomTabs from '@/components/ui/bottom-tabs';
import Shimmer from '@/components/ui/shimmer';
import TopActions from '@/components/ui/top-actions';
import * as C from '@/constants/colors';
import { useTransactions } from '@/hooks/use-transactions';
import { auth, db } from '@/lib/firebase';
import { Debt, Repayment } from '@/types/models';
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    Vibration,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.85;
const CARD_SPACING = 16;

type Message = {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp: Date;
};

type Recommendation = {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    type: 'success' | 'warning' | 'info';
    priority: number;
};

export default function Recommendations() {
    const currentUid = auth?.currentUser?.uid;
    const useMock = !currentUid;
    const { transactions, loading, refetch, aggregates } = useTransactions({ userId: useMock ? undefined : currentUid, useMock });

    const [refreshing, setRefreshing] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [chatLoading, setChatLoading] = useState(false);
    const [chatFullscreen, setChatFullscreen] = useState(false);
    const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});
    const scrollViewRef = useRef<ScrollView>(null);
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [debts, setDebts] = useState<Debt[]>([]);
    const [repayments, setRepayments] = useState<Repayment[]>([]);
    
    // Auto-scroll refs
    const flatListRef = useRef<FlatList>(null);
    const autoScrollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const currentIndex = useRef(0);

    const totals = useMemo(() => {
        const income = Number(aggregates?.income || 0);
        const expense = Number(aggregates?.expense || 0);
        const savings = income - expense;
        const savingsRate = income > 0 ? savings / income : 0;
        const labelFor = (t: any) => {
            if (t.type === 'debt' || t.type === 'repayment') {
                return t.counterpartyName || 'Debt';
            }
            return (t.category && t.category !== 'Misc') ? t.category : undefined;
        };

        const byLabel = transactions
            .filter((t) => t.type === 'expense')
            .reduce<Record<string, number>>((acc, t) => {
                const label = labelFor(t);
                if (!label) return acc;
                acc[label] = (acc[label] || 0) + Number(t.amount || 0);
                return acc;
            }, {});
        const topEntity = Object.entries(byLabel).sort((a, b) => b[1] - a[1])[0];

        // Use remainingAmount to show actual outstanding balance after repayments
        const owingSum = debts.filter((d) => d.direction === 'owing').reduce((s, d) => s + Number((d.remainingAmount ?? d.amount) || 0), 0);
        const owedSum = debts.filter((d) => d.direction === 'owed').reduce((s, d) => s + Number((d.remainingAmount ?? d.amount) || 0), 0);

        const upcomingOwing = debts
            .filter((d) => d.direction === 'owing' && d.dueDate)
            .sort((a, b) => new Date(a.dueDate as any).getTime() - new Date(b.dueDate as any).getTime());
        const upcomingOwed = debts
            .filter((d) => d.direction === 'owed' && d.dueDate)
            .sort((a, b) => new Date(a.dueDate as any).getTime() - new Date(b.dueDate as any).getTime());

        return { income, expense, savings, savingsRate, topEntity, owingSum, owedSum, upcomingOwing, upcomingOwed };
    }, [aggregates, transactions, debts]);

    useEffect(() => {
        const next: Recommendation[] = [];

        if (totals.income > 0) {
            if (totals.savingsRate < 0.1) {
                next.push({
                    id: 'save-more',
                    title: 'Increase savings rate',
                    description: 'You are saving less than 10% of income. Aim for 20% this month by trimming two categories you spend most on.',
                    icon: <MaterialIcons name="savings" size={24} color="#F59E0B" />,
                    type: 'warning',
                    priority: 1,
                });
            } else {
                next.push({
                    id: 'savings-good',
                    title: 'Nice savings momentum',
                    description: `You are saving ${(totals.savingsRate * 100).toFixed(0)}% of income. Keep at least 20% to hit your goals faster.`,
                    icon: <MaterialIcons name="check-circle" size={24} color="#10B981" />,
                    type: 'success',
                    priority: 2,
                });
            }
        }

        if (totals.expense > totals.income * 0.9 && totals.income > 0) {
            next.push({
                id: 'spend-high',
                title: 'Spending is near income',
                description: 'Your expenses are close to your income. Set a hard cap and move XAF 20% to savings on payday.',
                icon: <MaterialIcons name="trending-up" size={24} color="#EF4444" />,
                type: 'warning',
                priority: 3,
            });
        }

        if (totals.topEntity) {
            next.push({
                id: 'top-entity',
                title: `High spend on ${totals.topEntity[0]}`,
                description: `You spent XAF ${Number(totals.topEntity[1]).toLocaleString()} on ${totals.topEntity[0]}. Drop this by 10% to free up savings.`,
                icon: <MaterialIcons name="pie-chart" size={24} color="#3B82F6" />,
                type: 'info',
                priority: 4,
            });
        }

        if (!transactions.length) {
            next.push({
                id: 'add-data',
                title: 'Add your first transactions',
                description: 'Log income and expenses to unlock personalized insights and budgeting tips.',
                icon: <FontAwesome5 name="hand-holding-usd" size={20} color="#8B5CF6" />,
                type: 'info',
                priority: 5,
            });
        }

        if (totals.owingSum > 0) {
            next.push({
                id: 'owing-summary',
                title: 'Plan to clear debts you owe',
                description: `You owe XAF ${Number(totals.owingSum).toLocaleString()}. Set aside funds now to avoid late fees.`,
                icon: <MaterialIcons name="warning" size={24} color="#F59E0B" />,
                type: 'warning',
                priority: 6,
            });
        }
        if (totals.owedSum > 0) {
            next.push({
                id: 'owed-summary',
                title: 'Collect money owed to you',
                description: `People owe you XAF ${Number(totals.owedSum).toLocaleString()}. Send reminders to improve cash flow.`,
                icon: <MaterialIcons name="attach-money" size={24} color="#10B981" />,
                type: 'info',
                priority: 7,
            });
        }

        const daysUntil = (dateStr?: string) => {
            if (!dateStr) return null;
            const due = new Date(dateStr).getTime();
            const now = Date.now();
            return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
        };

        // Only show reminders for debts that still have outstanding balance (not fully paid)
        totals.upcomingOwing
            .filter((d) => (d.remainingAmount ?? d.amount) > 0)
            .slice(0, 2)
            .forEach((d) => {
                const days = daysUntil(d.dueDate as any);
                const when = days !== null ? (days >= 0 ? `${days} day(s)` : `overdue by ${Math.abs(days)} day(s)`) : 'soon';
                const remaining = Number((d.remainingAmount ?? d.amount) || 0);
                next.push({
                    id: `owing-${d.id}`,
                    title: `Upcoming payment to ${d.counterpartyName || 'contact'}`,
                    description: `Remember to secure XAF ${remaining.toLocaleString()} to pay your debt — due ${new Date(d.dueDate as any).toLocaleDateString()} (${when}).`,
                    icon: <MaterialIcons name="event" size={24} color="#EF4444" />,
                    type: days !== null && days < 0 ? 'warning' : 'info',
                    priority: 8,
                });
            });
        
        // Only show collection reminders for debts that still have outstanding balance
        totals.upcomingOwed
            .filter((d) => (d.remainingAmount ?? d.amount) > 0)
            .slice(0, 2)
            .forEach((d) => {
                const days = daysUntil(d.dueDate as any);
                const when = days !== null ? (days >= 0 ? `${days} day(s)` : `overdue by ${Math.abs(days)} day(s)`) : 'soon';
                const remaining = Number((d.remainingAmount ?? d.amount) || 0);
                next.push({
                    id: `owed-${d.id}`,
                    title: `Collect from ${d.counterpartyName || 'contact'}`,
                    description: `Contact ${d.counterpartyName || 'contact'} to collect XAF ${remaining.toLocaleString()} — due ${new Date(d.dueDate as any).toLocaleDateString()} (${when}).`,
                    icon: <MaterialIcons name="event-available" size={24} color="#3B82F6" />,
                    type: days !== null && days < 0 ? 'warning' : 'info',
                    priority: 9,
                });
            });

        setRecommendations(next.length ? next.sort((a, b) => a.priority - b.priority) : []);
    }, [totals, transactions.length]);

    // Auto-scroll effect
    useEffect(() => {
        if (recommendations.length > 1) {
            autoScrollInterval.current = setInterval(() => {
                currentIndex.current = (currentIndex.current + 1) % recommendations.length;
                flatListRef.current?.scrollToIndex({
                    index: currentIndex.current,
                    animated: true,
                });
            }, 5000); // Auto-scroll every 5 seconds

            return () => {
                if (autoScrollInterval.current) {
                    clearInterval(autoScrollInterval.current);
                }
            };
        }
    }, [recommendations.length]);

    useEffect(() => {
        if (!currentUid) {
            setDebts([]);
            return;
        }
        const qOwner = query(collection(db, 'debts'), where('ownerId', '==', currentUid));
        const qCounter = query(collection(db, 'debts'), where('counterpartyId', '==', currentUid));
        const items: Record<string, Debt> = {};
        const unsubOwner = onSnapshot(qOwner, (snap) => {
            snap.forEach((d) => { items[d.id] = { id: d.id, ...(d.data() as any) }; });
            setDebts(Object.values(items));
        });
        const unsubCounter = onSnapshot(qCounter, (snap) => {
            snap.forEach((d) => { items[d.id] = { id: d.id, ...(d.data() as any) }; });
            setDebts(Object.values(items));
        });
        return () => { unsubOwner(); unsubCounter(); };
    }, [currentUid]);

    // Load repayments for comprehensive debt tracking
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
        });
        return () => unsub();
    }, [currentUid]);

    const MAX_CHAT_CHARS = 320;

    const toggleExpand = (id: string) => {
        setExpandedMessages((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const handleCopy = async (text: string) => {
        try {
            await Clipboard.setStringAsync(text);
            Toast.show({ type: 'success', text1: 'Copied', text2: 'Message copied to clipboard.' });
        } catch (e: any) {
            Toast.show({ type: 'error', text1: 'Copy failed', text2: e?.message || 'Unable to copy text.' });
        }
    };

    const renderInline = (text: string, isUser?: boolean) => {
        return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((segment, idx) => {
            const isBold = segment.startsWith('**') && segment.endsWith('**');
            const clean = isBold ? segment.slice(2, -2) : segment;
            return (
                <Text key={idx} style={[isBold ? styles.mdBold : undefined, isUser ? styles.userText : undefined]}>
                    {clean}
                </Text>
            );
        });
    };

    const renderMarkdown = (text: string, id: string, isUser?: boolean) => {
        const expanded = expandedMessages[id];
        const isLong = text.length > MAX_CHAT_CHARS;
        const displayText = isLong && !expanded ? `${text.slice(0, MAX_CHAT_CHARS)}…` : text;
        const lines = displayText.split(/\n+/);

        return (
            <View style={styles.mdContainer}>
                {lines.map((line, idx) => {
                    const trimmed = line.trim();
                    const heading = trimmed.match(/^(#{1,3})\s+(.*)/);
                    const isBullet = /^[-*]\s+/.test(trimmed);
                    const content = heading ? heading[2] : isBullet ? trimmed.replace(/^[-*]\s+/, '') : trimmed;

                    let textStyle = styles.mdText;
                    if (heading) {
                        textStyle = heading[1].length === 1 ? styles.mdHeading1 : heading[1].length === 2 ? styles.mdHeading2 : styles.mdHeading3;
                    }

                    return (
                        <View key={`${id}-line-${idx}`} style={isBullet ? styles.mdBulletRow : styles.mdLine}>
                            {isBullet && <Text style={[styles.mdBullet, isUser ? styles.userText : undefined]}>•</Text>}
                            <Text style={[textStyle, isUser ? styles.userText : undefined]}>
                                {renderInline(content, isUser)}
                            </Text>
                        </View>
                    );
                })}

                {isLong && (
                    <Pressable style={styles.readMore} onPress={() => toggleExpand(id)}>
                        <Text style={styles.readMoreText}>{expanded ? 'Show less' : 'Read more'}</Text>
                    </Pressable>
                )}
            </View>
        );
    };

    const callAi = async (prompt: string) => {
        try {
            const apiKey = process.env.EXPO_PUBLIC_GEMINI_KEY;
            if (!apiKey) throw new Error('Missing EXPO_PUBLIC_GEMINI_KEY');

            const model = 'gemini-2.5-flash';
            const nonDebtTx = transactions.filter((t) => t.type !== 'debt' && t.type !== 'repayment');
            
            // Build detailed debt information with repayment history
            const debtDetails = debts.map(d => {
                const original = Number(d.amount || 0);
                const remaining = Number((d.remainingAmount ?? d.amount) || 0);
                const paid = original - remaining;
                const status = d.status || 'pending';
                const paymentsForDebt = repayments.filter(r => r.debtId === d.id);
                const paymentCount = paymentsForDebt.length;
                const paymentHistory = paymentsForDebt
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map(r => `${new Date(r.date).toLocaleDateString()}:XAF${Number(r.amount).toLocaleString()}`)
                    .join(', ');
                
                return `${d.counterpartyName || 'Unknown'}(${d.direction}): Original=XAF${original.toLocaleString()}, Paid=XAF${paid.toLocaleString()}, Remaining=XAF${remaining.toLocaleString()}, Status=${status}, Payments=${paymentCount}${paymentHistory ? `, History=[${paymentHistory}]` : ''}`;
            }).join(' | ');
            
            const body = {
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: `${prompt}\n\nInstructions:\n- Always use currency XAF (Central African CFA franc).\n- Prefix amounts with 'XAF' and use thousands separators.\n- Avoid using $ or other currencies.\n- Debts include full repayment history showing original amounts, paid amounts, and remaining balances.\n- Consider debt repayment patterns when giving advice.\n\nFinancial Context:\nIncome: XAF${aggregates.income.toLocaleString()}\nExpense: XAF${aggregates.expense.toLocaleString()}\nDebts owing (remaining): XAF${totals.owingSum.toLocaleString()}\nDebts owed (remaining): XAF${totals.owedSum.toLocaleString()}\nTop spend: ${totals.topEntity ? `${totals.topEntity[0]} (XAF${Number(totals.topEntity[1]).toLocaleString()})` : 'n/a'}\nUpcoming owing: ${totals.upcomingOwing.slice(0,3).map(d => `${d.counterpartyName}:XAF${Number(d.remainingAmount ?? d.amount).toLocaleString()}:Due ${d.dueDate}`).join('; ')}\nUpcoming owed: ${totals.upcomingOwed.slice(0,3).map(d => `${d.counterpartyName}:XAF${Number(d.remainingAmount ?? d.amount).toLocaleString()}:Due ${d.dueDate}`).join('; ')}\n\nDetailed Debt & Repayment Data:\n${debtDetails || 'No debts'}\n\nTotal Repayments Made: ${repayments.length}\n\nRecent Transactions (non-debt): ${nonDebtTx.slice(0, 20).map(t => `${t.type}:${t.category || t.counterpartyName || ''}:XAF${Number(t.amount).toLocaleString()}`).join(', ')}` }
                        ]
                    }
                ]
            };

            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey,
                },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errText = await res.text();
                console.log('AI response error', errText);
                throw new Error(`AI request failed (${res.status}): ${errText || 'no response body'}`);
            }

            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return text || 'I suggest setting a simple budget and targeting 20% savings.';
        } catch (e: any) {
            console.log('AI call error', e);
            Toast.show({ type: 'error', text1: 'AI unavailable', text2: e?.message || 'Could not get a response. Try again shortly.' });
            return null;
        }
    };

    const handleSend = async () => {
        if (!inputText.trim()) return;

        const text = inputText.trim();
        setInputText('');
        setIsTyping(true);
        Vibration.vibrate(10);

        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);

        if (currentUid) {
            try {
                await addDoc(collection(db, 'userChats', currentUid, 'messages'), {
                    text,
                    sender: 'user',
                    createdAt: serverTimestamp(),
                });
            } catch (e: any) {
                Toast.show({ type: 'error', text1: 'Could not send', text2: e?.message || 'Failed to save chat message.' });
            }
        } else {
            setMessages(prev => [...prev, { id: Date.now().toString(), text, sender: 'user', timestamp: new Date() }]);
            Toast.show({ type: 'info', text1: 'Not signed in', text2: 'Sign in to sync your chat messages.' });
        }

        const aiText = await callAi(text);
        if (!aiText) {
            setIsTyping(false);
            return;
        }

        if (currentUid) {
            try {
                await addDoc(collection(db, 'userChats', currentUid, 'messages'), {
                    text: aiText,
                    sender: 'ai',
                    createdAt: serverTimestamp(),
                });
            } catch (e: any) {
                Toast.show({ type: 'error', text1: 'AI save failed', text2: e?.message || 'Could not save AI response.' });
            }
        } else {
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), text: aiText, sender: 'ai', timestamp: new Date() }]);
        }
        setIsTyping(false);

        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const renderMessageItem = ({ item }: { item: Message }) => {
        const isUser = item.sender === 'user';
        return (
            <View style={[
                styles.messageBubble,
                isUser ? styles.userBubble : styles.aiBubble
            ]}>
                <View style={styles.messageHeader}>
                    <Text style={[
                        styles.senderName,
                        isUser ? styles.userName : styles.aiName
                    ]}>
                        {isUser ? 'You' : 'Finance AI'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    </View>
                </View>
                {renderMarkdown(item.text, item.id, isUser)}
                <View style={{flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center'}}>
                    <Pressable style={styles.iconButton} onPress={() => handleCopy(item.text)}>
                        <MaterialIcons name="content-copy" size={16} color="#94A3B8" />
                    </Pressable>
                    <Text style={styles.messageTime}>
                        {formatTime(item.timestamp)}
                    </Text>
                    <Pressable onPress={() => handleDeleteMessage(item)} style={styles.iconButton}>
                        <MaterialIcons name="delete" size={16} color="#9CA3AF" />
                    </Pressable>
                </View>
            </View>
        );
    };

    useEffect(() => {
        if (!currentUid) {
            setMessages([{
                id: 'greet',
                text: "Hello! I'm your financial assistant. I can help analyze your spending, suggest budgets, and answer money-related questions. How can I help you today?",
                sender: 'ai',
                timestamp: new Date(),
            }]);
            return;
        }
        setChatLoading(true);
        const q = query(collection(db, 'userChats', currentUid, 'messages'), orderBy('createdAt', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            const items: Message[] = [];
            snap.forEach((d) => {
                const data = d.data() as any;
                items.push({
                    id: d.id,
                    text: data.text || '',
                    sender: data.sender === 'user' ? 'user' : 'ai',
                    timestamp: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                });
            });
            setMessages(items.length ? items : [{ id: 'greet', text: 'Welcome! Ask me anything about your money.', sender: 'ai', timestamp: new Date() }]);
            setChatLoading(false);
        }, (err) => {
            console.log('Chat snapshot error', err);
            Toast.show({ type: 'error', text1: 'Chat load failed', text2: 'Could not load your messages.' });
            setChatLoading(false);
        });
        return () => unsub();
    }, [currentUid]);

    const handleDeleteMessage = async (msg: Message) => {
        Vibration.vibrate(10);
        if (currentUid && msg.id) {
            try {
                await deleteDoc(doc(db, 'userChats', currentUid, 'messages', msg.id));
                Toast.show({ type: 'success', text1: 'Deleted', text2: 'Message removed.' });
            } catch (e: any) {
                Toast.show({ type: 'error', text1: 'Delete failed', text2: e?.message || 'Try again.' });
            }
        } else {
            setMessages((prev) => prev.filter((m) => m.id !== msg.id));
            Toast.show({ type: 'success', text1: 'Deleted', text2: 'Message removed (local).' });
        }
    };

    const AnimatedRecommendationCard = ({ item, index }: { item: Recommendation; index: number }) => {
        const scaleAnim = useRef(new Animated.Value(0)).current;

        useEffect(() => {
            Animated.spring(scaleAnim, {
                toValue: 1,
                delay: index * 100,
                useNativeDriver: true,
                tension: 50,
                friction: 7,
            }).start();
        }, []);

        return (
            <Animated.View
                style={[
                    styles.recommendationCardHorizontal,
                    {
                        transform: [{ scale: scaleAnim }],
                        borderLeftColor:
                            item.type === 'success' ? '#10B981' :
                            item.type === 'warning' ? '#F59E0B' : '#3B82F6'
                    }
                ]}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.recommendationIconLarge}>
                        {item.icon}
                    </View>
                    <View style={[
                        styles.typeBadge,
                        {
                            backgroundColor:
                                item.type === 'success' ? '#D1FAE5' :
                                item.type === 'warning' ? '#FEF3C7' : '#DBEAFE'
                        }
                    ]}>
                        <Text style={[
                            styles.typeBadgeText,
                            {
                                color:
                                    item.type === 'success' ? '#065F46' :
                                    item.type === 'warning' ? '#92400E' : '#1E40AF'
                            }
                        ]}>
                            {item.type === 'success' ? 'Good' : item.type === 'warning' ? 'Action' : 'Info'}
                        </Text>
                    </View>
                </View>
                <Text style={styles.recommendationTitleLarge}>{item.title}</Text>
                <Text style={styles.recommendationDescriptionLarge}>{item.description}</Text>
            </Animated.View>
        );
    };

    const getItemLayout = (_: any, index: number) => ({
        length: CARD_WIDTH + CARD_SPACING,
        offset: (CARD_WIDTH + CARD_SPACING) * index,
        index,
    });

    return (
        <SafeAreaView style={styles.container}>
            <TopActions />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoid}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <ScrollView
                    ref={scrollViewRef}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refetch(); setRefreshing(false); }} tintColor={C.PRIMARY_PURPLE} colors={[C.PRIMARY_PURPLE]} />}
                >
                    {loading ? (
                        <Shimmer height={84} borderRadius={18} style={{ marginBottom: 24 }} />
                    ) : (
                        <View style={styles.header}>
                            <View style={styles.headerTitleRow}>
                                <Ionicons name="bulb" size={24} color={C.PRIMARY_PURPLE} />
                                <Text style={styles.title}>Financial Insights</Text>
                            </View>
                            <Text style={styles.subtitle}>AI-powered recommendations and chat assistance</Text>
                        </View>
                    )}

                    {/* Horizontal Recommendations Carousel */}
                    <View style={styles.sectionCompact}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Personalized Recommendations</Text>
                            <Text style={styles.sectionSubtitle}>Swipe to explore • Auto-scrolling</Text>
                        </View>

                        {loading ? (
                            <View style={{ paddingLeft: 20 }}>
                                <Shimmer height={200} width={CARD_WIDTH} borderRadius={20} />
                            </View>
                        ) : recommendations.length > 0 ? (
                            <FlatList
                                ref={flatListRef}
                                data={recommendations}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item, index }) => (
                                    <AnimatedRecommendationCard item={item} index={index} />
                                )}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                snapToInterval={CARD_WIDTH + CARD_SPACING}
                                decelerationRate="fast"
                                contentContainerStyle={styles.carouselContent}
                                getItemLayout={getItemLayout}
                                onScrollToIndexFailed={(info) => {
                                    setTimeout(() => {
                                        flatListRef.current?.scrollToIndex({
                                            index: info.index,
                                            animated: true,
                                        });
                                    }, 100);
                                }}
                            />
                        ) : (
                            <View style={[styles.emptyBox, { marginHorizontal: 20 }]}>
                                <Text style={styles.emptyText}>Add transactions to unlock personalized recommendations.</Text>
                            </View>
                        )}
                    </View>

                    {/* AI Chat Section */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <View style={styles.chatHeaderRow}>
                                <MaterialIcons name="chat" size={20} color={C.PRIMARY_PURPLE} />
                                <Text style={styles.sectionTitle}>Chat with Financial AI</Text>
                                <Pressable style={styles.fullBtn} onPress={() => setChatFullscreen(true)}>
                                    <MaterialIcons name="fullscreen" size={18} color={C.PRIMARY_PURPLE} />
                                </Pressable>
                            </View>
                            <Text style={styles.sectionSubtitle}>Ask questions about your finances</Text>
                        </View>

                        <View style={styles.chatContainer}>
                            {chatLoading ? (
                                <View style={styles.messagesList}>
                                    {[0,1,2].map((i) => (
                                        <Shimmer key={i} height={70} borderRadius={18} />
                                    ))}
                                </View>
                            ) : (
                                <FlatList
                                    data={messages}
                                    keyExtractor={(item) => item.id}
                                    renderItem={renderMessageItem}
                                    scrollEnabled={false}
                                    showsVerticalScrollIndicator={false}
                                    contentContainerStyle={styles.messagesList}
                                />
                            )}

                            {isTyping && (
                                <View style={styles.typingIndicator}>
                                    <ActivityIndicator size="small" color={C.PRIMARY_PURPLE} />
                                    <Text style={styles.typingText}>AI is typing...</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                value={inputText}
                                onChangeText={setInputText}
                                placeholder="Ask about your finances..."
                                placeholderTextColor="#94A3B8"
                                multiline
                                maxLength={500}
                            />
                            <Pressable
                                style={[
                                    styles.sendButton,
                                    (!inputText.trim() || isTyping) && styles.sendButtonDisabled
                                ]}
                                onPress={handleSend}
                                disabled={!inputText.trim() || isTyping}
                            >
                                <MaterialIcons name="send" size={20} color={C.TEXT_ON_PURPLE} />
                            </Pressable>
                        </View>

                        <View style={styles.sampleQuestions}>
                            <Text style={styles.sampleQuestionsTitle}>Try asking:</Text>
                            <View style={styles.sampleQuestionsRow}>
                                {['Show budget tips', 'Analyze spending', 'Savings advice'].map((question) => (
                                    <Pressable
                                        key={question}
                                        style={styles.sampleQuestionButton}
                                        onPress={() => setInputText(question)}
                                    >
                                        <Text style={styles.sampleQuestionText}>{question}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    </View>

                    <View style={{ height: 120 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            <BottomTabs />

            <Modal visible={chatFullscreen} animationType="slide" onRequestClose={() => setChatFullscreen(false)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: C.BACKGROUND_LIGHT }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <MaterialIcons name="chat" size={20} color={C.PRIMARY_PURPLE} />
                            <Text style={{ fontSize: 18, fontWeight: '800', color: C.TEXT_PRIMARY }}>Chat</Text>
                        </View>
                        <Pressable onPress={() => setChatFullscreen(false)}>
                            <MaterialIcons name="fullscreen-exit" size={20} color={C.PRIMARY_PURPLE} />
                        </Pressable>
                    </View>

                    <View style={[styles.chatContainer, { marginHorizontal: 16, flex: 1 }]}>
                        {chatLoading ? (
                            <View style={styles.messagesList}>
                                {[0,1,2,3].map((i) => (
                                    <Shimmer key={i} height={70} borderRadius={18} />
                                ))}
                            </View>
                        ) : (
                            <FlatList
                                data={messages}
                                showsVerticalScrollIndicator={false}
                                keyExtractor={(item) => item.id}
                                renderItem={renderMessageItem}
                                contentContainerStyle={styles.messagesList}
                            />
                        )}
                    </View>

                    <View style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                value={inputText}
                                onChangeText={setInputText}
                                placeholder="Ask about your finances..."
                                placeholderTextColor="#94A3B8"
                                multiline
                                maxLength={500}
                            />
                            <Pressable
                                style={[
                                    styles.sendButton,
                                    (!inputText.trim() || isTyping) && styles.sendButtonDisabled
                                ]}
                                onPress={handleSend}
                                disabled={!inputText.trim() || isTyping}
                            >
                                <MaterialIcons name="send" size={20} color={C.TEXT_ON_PURPLE} />
                            </Pressable>
                        </View>
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.BACKGROUND_LIGHT,
    },
    keyboardAvoid: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 20,
        paddingBottom: 20,
    },
    header: {
        marginBottom: 32,
        paddingHorizontal: 20,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: C.TEXT_PRIMARY,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: C.TEXT_SECONDARY,
        lineHeight: 22,
    },
    section: {
        marginBottom: 32,
        paddingHorizontal: 20,
    },
    sectionCompact: {
        marginBottom: 32,
    },
    sectionHeader: {
        marginBottom: 20,
        paddingHorizontal: 20,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: C.TEXT_PRIMARY,
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 14,
        color: C.TEXT_SECONDARY,
    },
    chatHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    fullBtn: {
        marginLeft: 'auto',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
    },
    carouselContent: {
        paddingLeft: 20,
        paddingRight: 20 - CARD_SPACING,
    },
    recommendationCardHorizontal: {
        backgroundColor: C.CARD_LIGHT,
        width: CARD_WIDTH,
        marginRight: CARD_SPACING,
        padding: 24,
        borderRadius: 20,
        borderLeftWidth: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        minHeight: 200,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    recommendationIconLarge: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    typeBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    typeBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    recommendationTitleLarge: {
        fontSize: 20,
        fontWeight: '800',
        color: C.TEXT_PRIMARY,
        marginBottom: 12,
        lineHeight: 26,
    },
    recommendationDescriptionLarge: {
        fontSize: 15,
        color: C.TEXT_SECONDARY,
        lineHeight: 22,
    },
    chatContainer: {
        backgroundColor: '#F8FAFC',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        minHeight: 300,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    messagesList: {
        gap: 16,
    },
    messageBubble: {
        borderRadius: 18,
        padding: 10,
        maxWidth: '85%',
    },
    userBubble: {
        backgroundColor: C.PRIMARY_PURPLE,
        alignSelf: 'flex-end',
        borderBottomRightRadius: 4,
    },
    aiBubble: {
        backgroundColor: '#FFFFFF',
        alignSelf: 'flex-start',
        borderBottomLeftRadius: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    messageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    senderName: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    userName: {
        color: '#F0EBFF',
    },
    aiName: {
        color: '#475569',
    },
    messageTime: {
        fontSize: 11,
        color: '#94A3B8',
    },
    iconButton: {
        padding: 6,
        borderRadius: 8,
    },
    userText: {
        color: '#FFFFFF',
    },
    typingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        paddingHorizontal: 14,
    },
    typingText: {
        fontSize: 13,
        color: C.TEXT_SECONDARY,
        fontStyle: 'italic',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 12,
        marginBottom: 16,
    },
    input: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        paddingHorizontal: 18,
        paddingVertical: 14,
        fontSize: 16,
        color: C.TEXT_PRIMARY,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        maxHeight: 120,
        textAlignVertical: 'top',
    },
    sendButton: {
        backgroundColor: C.PRIMARY_PURPLE,
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: C.PRIMARY_PURPLE,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    sendButtonDisabled: {
        backgroundColor: '#CBD5E1',
        shadowOpacity: 0,
    },
    sampleQuestions: {
        marginTop: 8,
    },
    sampleQuestionsTitle: {
        fontSize: 14,
        color: C.TEXT_SECONDARY,
        marginBottom: 8,
        fontWeight: '600',
    },
    sampleQuestionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    sampleQuestionButton: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    sampleQuestionText: {
        fontSize: 13,
        color: '#475569',
        fontWeight: '600',
    },
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
    },
    emptyText: {
        fontSize: 14,
        color: C.TEXT_SECONDARY,
        textAlign: 'center',
    },
    mdContainer: {
        gap: 6,
    },
    mdLine: {
        flexDirection: 'row',
    },
    mdBulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
    },
    mdBullet: {
        fontSize: 14,
        color: C.TEXT_PRIMARY,
        marginTop: 2,
    },
    mdText: {
        fontSize: 15,
        lineHeight: 22,
        color: C.TEXT_PRIMARY,
    },
    mdBold: {
        fontWeight: '700',
        color: C.TEXT_PRIMARY,
    },
    mdHeading1: {
        fontSize: 18,
        fontWeight: '800',
        color: C.TEXT_PRIMARY,
        marginBottom: 4,
        lineHeight: 24,
    },
    mdHeading2: {
        fontSize: 17,
        fontWeight: '800',
        color: C.TEXT_PRIMARY,
        marginBottom: 2,
        lineHeight: 23,
    },
    mdHeading3: {
        fontSize: 16,
        fontWeight: '700',
        color: C.TEXT_PRIMARY,
        lineHeight: 22,
    },
    readMore: {
        marginTop: 4,
        alignSelf: 'flex-start',
    },
    readMoreText: {
        fontSize: 13,
        fontWeight: '700',
        color: C.PRIMARY_PURPLE,
    },
});