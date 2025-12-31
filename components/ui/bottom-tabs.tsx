import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Link } from 'expo-router';
import * as C from '@/constants/colors';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';

export default function BottomTabs() {
  const items = [
    { key: 'home', label: 'Home', href: '/dashboard', icon: () => <MaterialIcons name="home-filled" size={20} color="#fff" /> },
      { key: 'recommend', label: 'Recommendations', href: '/recommendations', icon: () => <Ionicons name="bulb" size={20} color="#fff" /> },
    { key: 'transactions', label: 'Transactions', href: '/transactions', icon: () => <FontAwesome5 name="coins" size={18} color="#fff" /> },
    { key: 'debts', label: 'Debts', href: '/debts', icon: () => <MaterialIcons name="payments" size={20} color="#fff" /> },
    // { key: 'notifications', label: 'Notifications', href: '/notifications', icon: () => <Ionicons name="notifications" size={20} color="#fff" /> },
    // { key: 'settings', label: 'Settings', href: '/settings', icon: () => <MaterialIcons name="settings" size={20} color="#fff" /> },
  ];

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.tabBar}>
        {items.map((it) => (
          <Link key={it.key} href={it.href as any} asChild>
            <Pressable style={styles.tabItem}>
              {it.icon()}
              <Text style={styles.label}>{it.label}</Text>
            </Pressable>
          </Link>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0, bottom: 30, alignItems: 'center' },
  tabBar: { flexDirection: 'row', backgroundColor: C.PRIMARY_PURPLE, paddingVertical: 13, paddingHorizontal: 35, borderRadius: 28, width: '94%', justifyContent: 'space-between', shadowColor: '#7C3AED', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  tabItem: { alignItems: 'center', justifyContent: 'center' },
  label: { color: '#F8F6FF', fontSize: 10, marginTop: 4, fontWeight: '700' },
});
