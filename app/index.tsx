import * as C from '@/constants/colors';
import { auth } from '@/lib/firebase';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { onAuthStateChanged } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    let handled = false;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;
      try {
        if (user) {
          // If user is authenticated, go straight to dashboard
          if (!handled) {
            handled = true;
            router.replace('/dashboard');
          }
        } else {
          // Not authenticated: check onboarding flag
          const seen = await SecureStore.getItemAsync('has_seen_onboarding');
          if (!handled) {
            handled = true;
            if (seen === 'true') {
              router.replace('/auth/login');
            } else {
              router.replace('/onboarding');
            }
          }
        }
      } catch {
        if (!handled) {
          handled = true;
          router.replace('/onboarding');
        }
      } finally {
        if (mounted) setChecking(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [router]);

  if (!checking) return null; // Navigation will take over

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={C.PRIMARY_PURPLE} />
      <Text style={styles.text}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.BACKGROUND_LIGHT },
  text: { marginTop: 12, color: C.TEXT_SECONDARY },
});
