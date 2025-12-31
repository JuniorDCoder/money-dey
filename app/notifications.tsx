import BottomTabs from '@/components/ui/bottom-tabs';
import Shimmer from '@/components/ui/shimmer';
import * as C from '@/constants/colors';
import { auth, db } from '@/lib/firebase';
import { AppNotification } from '@/types/models';
import { addDoc, collection, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

const seedNotifications = async (uid: string) => {
  const base = [
    {
      title: 'Welcome to MoneyDey',
      body: 'We keep your reminders and insights here. Swipe to mark as read.',
      type: 'system' as const,
    },
    {
      title: 'New recommendations ready',
      body: 'Check the Recommendations tab for tips to grow your money habits.',
      type: 'recommendation' as const,
    },
  ];

  await Promise.all(
    base.map((item) =>
      addDoc(collection(db, 'notifications'), {
        userId: uid,
        read: false,
        createdAt: serverTimestamp(),
        ...item,
      })
    )
  );
};

export default function Notifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const seededRef = useRef(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Toast.show({ type: 'error', text1: 'Not signed in', text2: 'Please sign in to view notifications.' });
      return;
    }

    const q = query(collection(db, 'notifications'), where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(100));
    const unsub = onSnapshot(q, async (snap) => {
      const list: AppNotification[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

      if (list.length === 0 && !seededRef.current) {
        seededRef.current = true;
        try {
          await seedNotifications(uid);
        } catch (e) {
          console.log('Seed notifications error', e);
        }
        return;
      }

      setItems(list);
      setLoading(false);
      setRefreshing(false);
    }, (err) => {
      console.log('Notifications snapshot error', err);
      Toast.show({ type: 'error', text1: 'Could not load notifications', text2: 'Try again later.' });
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsub();
  }, []);

  const refreshOnce = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setRefreshing(false);
      return;
    }
    try {
      const q = query(collection(db, 'notifications'), where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      const list: AppNotification[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setItems(list);
    } catch (e) {
      console.log('Refresh notifications error', e);
      Toast.show({ type: 'error', text1: 'Refresh failed', text2: 'Pull to refresh again.' });
    } finally {
      setRefreshing(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true, readAt: serverTimestamp() });
    } catch (e) {
      console.log('Mark read error', e);
      Toast.show({ type: 'error', text1: 'Could not mark as read' });
    }
  };

  const markAllAsRead = async () => {
    const unread = items.filter((n) => !n.read);
    if (unread.length === 0) return;
    setMarkingAll(true);
    try {
      await Promise.all(unread.map((n) => updateDoc(doc(db, 'notifications', n.id), { read: true, readAt: serverTimestamp() })));
      Toast.show({ type: 'success', text1: 'All caught up' });
    } catch (e) {
      console.log('Mark all read error', e);
      Toast.show({ type: 'error', text1: 'Could not mark all' });
    } finally {
      setMarkingAll(false);
    }
  };

  const renderRightActions = (item: AppNotification) => (
    <Pressable style={styles.swipeAction} onPress={() => markAsRead(item.id)}>
      <Text style={styles.swipeText}>Mark read</Text>
    </Pressable>
  );

  const unreadCount = items.filter((i) => !i.read).length;

  return (
    <SafeAreaView style={styles.container}>

      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>Recent alerts, reminders, and tips</Text>
        </View>
        <Pressable style={[styles.markAllBtn, unreadCount === 0 && { opacity: 0.5 }]} disabled={unreadCount === 0 || markingAll} onPress={markAllAsRead}>
          <Text style={styles.markAllText}>{markingAll ? 'Working…' : 'Mark all read'}</Text>
        </Pressable>
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>Swipe to clear</Text>
        <Text style={styles.tipText}>Swipe left on a card to mark it as read. Reminders from debts, tips, and system alerts all land here.</Text>
      </View>

      {loading ? (
        <View style={{ gap: 10, marginTop: 8 }}>
          {[1,2,3,4].map((i) => (
            <View key={i} style={styles.item}>
              <Shimmer width="50%" height={16} />
              <Shimmer width="90%" height={12} style={{ marginTop: 8 }} />
              <Shimmer width="40%" height={10} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>
      ) : items.length === 0 ? (
        <Text style={styles.hint}>No notifications yet.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <Swipeable renderRightActions={() => renderRightActions(item)}>
              <Pressable style={[styles.item, item.read && styles.itemRead]} onPress={() => !item.read && markAsRead(item.id)}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  {!item.read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.itemBody}>{item.body}</Text>
                {item.scheduledFor && (
                  <Text style={styles.metaText}>Reminder for {new Date(item.scheduledFor).toLocaleString()}</Text>
                )}
              </Pressable>
            </Swipeable>
          )}
          contentContainerStyle={{ paddingBottom: 140 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); refreshOnce(); }} />}
        />
      )}

      <BottomTabs />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.BACKGROUND_LIGHT, paddingHorizontal: 20, paddingTop: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: C.TEXT_PRIMARY },
  subtitle: { color: C.TEXT_SECONDARY, marginTop: 6 },
  markAllBtn: { backgroundColor: C.PRIMARY_PURPLE, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  markAllText: { color: C.TEXT_ON_PURPLE, fontWeight: '900' },
  tipCard: { backgroundColor: '#EEF2FF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E0E7FF', marginBottom: 12 },
  tipTitle: { fontWeight: '800', color: '#4338CA', marginBottom: 4 },
  tipText: { color: '#475569', fontSize: 13, lineHeight: 18 },
  hint: { color: C.TEXT_SECONDARY, marginTop: 16 },
  item: { backgroundColor: C.CARD_LIGHT, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.BORDER },
  itemRead: { opacity: 0.65 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemTitle: { fontWeight: '800', color: C.TEXT_PRIMARY, fontSize: 15 },
  itemBody: { color: C.TEXT_SECONDARY, marginTop: 6, lineHeight: 18 },
  metaText: { color: '#6B7280', marginTop: 6, fontSize: 12 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },
  swipeAction: { backgroundColor: '#0EA5E9', justifyContent: 'center', alignItems: 'center', width: 110, height: '100%', borderRadius: 12, marginLeft: 8 },
  swipeText: { color: '#fff', fontWeight: '800' },
});
