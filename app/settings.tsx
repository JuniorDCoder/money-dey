import BottomTabs from '@/components/ui/bottom-tabs';
import * as C from '@/constants/colors';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL || 'https://money-dey-financial-peace.vercel.app/terms';
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || 'https://money-dey-financial-peace.vercel.app/privacy';

type Currency = 'XAF' | 'NGN' | 'USD' | 'EUR';

export default function Settings() {
  const router = useRouter();
  const [currency, setCurrency] = useState<Currency>('XAF');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Toast.show({ type: 'error', text1: 'Not signed in', text2: 'Please sign in to view settings.' });
      router.replace('/auth/login');
      return;
    }

    let mounted = true;
    async function loadSettings() {
      try {
        const ref = doc(db, 'userSettings', uid);
        const snap = await getDoc(ref);
        if (mounted && snap.exists()) {
          const data = snap.data() as any;
          if (data.currency) setCurrency(data.currency as Currency);
        }
      } catch (e) {
        console.log('Failed to load settings', e);
      }
    }
    loadSettings();
    return () => { mounted = false; };
  }, [router]);

  const saveCurrency = async (next: Currency) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'userSettings', uid), { currency: next, updatedAt: new Date().toISOString() }, { merge: true });
      setCurrency(next);
      Toast.show({ type: 'success', text1: 'Saved', text2: `Currency set to ${next}.` });
    } catch (e) {
      console.log('Save settings error', e);
      Toast.show({ type: 'error', text1: 'Could not save', text2: 'Try again.' });
    } finally {
      setSaving(false);
    }
  };

  const currencies: Currency[] = useMemo(() => (
    ['XAF','NGN','GHS','ZAR','KES','USD','EUR','GBP','CAD','AUD','JPY','CNY'] as Currency[]
  ), []);
  const [customCurrency, setCustomCurrency] = useState('');

  const handleLogout = async () => {
    try {
      await signOut(auth);
      Toast.show({ type: 'success', text1: 'Signed out', text2: 'You have been signed out.' });
      router.replace('/auth/login');
    } catch (e) {
      console.log('Logout error', e);
      Toast.show({ type: 'error', text1: 'Could not sign out', text2: 'Try again.' });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ paddingHorizontal: 20, paddingTop: 0 }}>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Pressable style={styles.row} onPress={() => router.push('/profile' as any)}>
          <Text style={styles.rowLabel}>Profile</Text>
        </Pressable>
        <Pressable style={[styles.row, styles.logout]} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <Text style={styles.subtle}>Choose your default currency. Scroll horizontally to see more, or enter a custom code.</Text>
        <FlatList
          data={currencies}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.currencyRow}
          renderItem={({ item: c }) => (
            <Pressable style={[styles.currencyBtn, currency === c && styles.currencyActive]} onPress={() => saveCurrency(c)} disabled={saving}>
              <Text style={[styles.currencyText, currency === c && styles.currencyTextActive]}>{c}</Text>
            </Pressable>
          )}
        />
        <View style={styles.customRow}>
          <TextInput
            value={customCurrency}
            onChangeText={(t) => setCustomCurrency(t.toUpperCase())}
            placeholder="Enter custom currency (e.g., XAF)"
            placeholderTextColor={C.TEXT_SECONDARY}
            style={styles.input}
            autoCapitalize="characters"
            maxLength={5}
          />
          <Pressable
            style={[styles.saveSmallBtn, customCurrency.trim().length === 0 && { opacity: 0.5 }]}
            disabled={saving || customCurrency.trim().length === 0}
            onPress={() => saveCurrency(customCurrency.trim() as Currency)}
          >
            <Text style={styles.saveSmallText}>Save</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>
        <Pressable style={styles.row} onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}>
          <Text style={styles.rowLabel}>Privacy Policy</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}>
          <Text style={styles.rowLabel}>Terms of Service</Text>
        </Pressable>
      </View>

      </View>

      <BottomTabs />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.BACKGROUND_LIGHT },
  title: { fontSize: 26, fontWeight: '900', color: C.TEXT_PRIMARY },
  section: { marginTop: 20, backgroundColor: C.CARD_LIGHT, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER },
  sectionTitle: { color: C.TEXT_SECONDARY, fontWeight: '800', marginBottom: 8 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.BORDER },
  rowLabel: { color: C.TEXT_PRIMARY, fontWeight: '700' },
  logout: { borderBottomWidth: 0, marginTop: 8, backgroundColor: '#FFF3F3', borderRadius: 10, padding: 12 },
  logoutText: { color: '#B91C1C', fontWeight: '900' },
  subtle: { color: C.TEXT_SECONDARY, marginBottom: 10 },
  currencyRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  currencyBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F8F7FF', borderWidth: 1, borderColor: C.BORDER },
  currencyActive: { backgroundColor: C.PRIMARY_PURPLE },
  currencyText: { color: C.TEXT_PRIMARY, fontWeight: '800' },
  currencyTextActive: { color: C.TEXT_ON_PURPLE },
  customRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#F8F7FF', borderWidth: 1, borderColor: C.BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: C.TEXT_PRIMARY, fontWeight: '700' },
  saveSmallBtn: { backgroundColor: C.PRIMARY_PURPLE, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  saveSmallText: { color: C.TEXT_ON_PURPLE, fontWeight: '900' },
});
