import * as C from '@/constants/colors';
import { auth, db } from '@/lib/firebase';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Link, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const actions = [
  { key: 'notifications', icon: (active: boolean) => <Ionicons name="notifications" size={20} color={active ? C.TEXT_ON_PURPLE : C.TEXT_PRIMARY} />, href: '/notifications' },
  { key: 'profile', icon: (active: boolean) => <MaterialIcons name="person" size={20} color={active ? C.TEXT_ON_PURPLE : C.TEXT_PRIMARY} />, href: '/profile' },
  { key: 'settings', icon: (active: boolean) => <MaterialIcons name="settings" size={20} color={active ? C.TEXT_ON_PURPLE : C.TEXT_PRIMARY} />, href: '/settings' },
];

export default function TopActions() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setUnread(0);
      return;
    }

    const q = query(collection(db, 'notifications'), where('userId', '==', uid), where('read', '==', false));
    const unsub = onSnapshot(q, (snap) => {
      setUnread(snap.size);
    }, (err) => {
      console.log('TopActions unread error', err);
      setUnread(0);
    });

    return () => unsub();
  }, [pathname]);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.bar}>
        {actions.map((action) => {
          const active = pathname?.startsWith(action.href);
          return (
            <Link key={action.key} href={action.href as any} asChild>
              <Pressable style={[styles.btn, active && styles.activeBtn]}>
                <View style={styles.iconWrap}>
                  {action.icon(active)}
                  {action.key === 'notifications' && unread > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            </Link>
          );
        })}
      </View>
      <StatusBar hidden={true} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 32,
    right: 16,
    zIndex: 20,
    alignItems: 'flex-end',
  },
  bar: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: '#FFFFFFEE',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: C.BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  btn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  activeBtn: {
    backgroundColor: C.PRIMARY_PURPLE,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    paddingHorizontal: 4,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
