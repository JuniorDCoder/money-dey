import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface SyncStatusIndicatorProps {
  isOnline: boolean;
  isSyncing: boolean;
  hasFailures?: boolean;
}

export default function SyncStatusIndicator({
  isOnline,
  isSyncing,
  hasFailures = false,
}: SyncStatusIndicatorProps) {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Rotate spinner when syncing
  useEffect(() => {
    if (isSyncing) {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotateAnim.setValue(0);
    }
  }, [isSyncing, rotateAnim]);

  // Pulse animation for online status
  useEffect(() => {
    if (isOnline && !isSyncing) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        pulseAnim.setValue(1);
      });
    }
  }, [isOnline, isSyncing, pulseAnim]);

  const spinInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (hasFailures) {
    return (
      <View style={styles.container}>
        <View style={[styles.indicator, styles.failureIndicator]}>
          <MaterialCommunityIcons name="alert-circle" size={14} color="#EF4444" />
        </View>
      </View>
    );
  }

  if (isSyncing) {
    return (
      <View style={styles.container}>
        <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
          <View style={[styles.indicator, styles.syncingIndicator]}>
            <MaterialCommunityIcons name="sync" size={14} color="#0284C7" />
          </View>
        </Animated.View>
      </View>
    );
  }

  if (!isOnline) {
    return (
      <View style={styles.container}>
        <View style={[styles.indicator, styles.offlineIndicator]}>
          <MaterialCommunityIcons name="wifi-off" size={14} color="#F59E0B" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.indicator,
          styles.onlineIndicator,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <MaterialCommunityIcons name="wifi" size={14} color="#10B981" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineIndicator: {
    backgroundColor: '#ECFDF5',
  },
  offlineIndicator: {
    backgroundColor: '#FEF3C7',
  },
  syncingIndicator: {
    backgroundColor: '#DBEAFE',
  },
  failureIndicator: {
    backgroundColor: '#FEE2E2',
  },
});
