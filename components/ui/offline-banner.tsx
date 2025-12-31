import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface OfflineBannerProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
}

export default function OfflineBanner({
  isOnline,
  isSyncing,
  pendingCount,
}: OfflineBannerProps) {
  const slideAnim = useRef(new Animated.Value(isOnline && !isSyncing ? -80 : 0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOnline && !isSyncing ? -80 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOnline, isSyncing, slideAnim]);

  // Rotate spinner when syncing
  useEffect(() => {
    if (isSyncing) {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [isSyncing, rotateAnim]);

  const spinInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const isOffline = !isOnline;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          transform: [{ translateY: slideAnim }],
          backgroundColor: isOffline ? '#FCD34D' : isSyncing ? '#DBEAFE' : '#F0F9FF',
        },
      ]}
    >
      <View style={styles.content}>
        {isOffline ? (
          <>
            <MaterialCommunityIcons name="wifi-off" size={18} color="#78350F" />
            <Text style={styles.offlineText}>You're offline</Text>
          </>
        ) : isSyncing ? (
          <>
            <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
              <MaterialCommunityIcons name="sync" size={18} color="#0284C7" />
            </Animated.View>
            <Text style={styles.syncingText}>
              Syncing {pendingCount > 0 ? `(${pendingCount})` : '...'}
            </Text>
          </>
        ) : null}
      </View>

      {isOffline && pendingCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendingCount}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  offlineText: {
    color: '#78350F',
    fontWeight: '700',
    fontSize: 13,
  },
  syncingText: {
    color: '#0284C7',
    fontWeight: '700',
    fontSize: 13,
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 11,
  },
});
