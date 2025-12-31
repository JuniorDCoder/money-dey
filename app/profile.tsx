import BottomTabs from '@/components/ui/bottom-tabs';
import Shimmer from '@/components/ui/shimmer';
import * as C from '@/constants/colors';
import { auth, db } from '@/lib/firebase';
import { User } from '@/types/models';
import { EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail, updatePassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
/* eslint-disable @typescript-eslint/no-var-requires */
import React, { useEffect, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);

  const loadProfile = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      Toast.show({ type: 'error', text1: 'Not signed in', text2: 'Please sign in to view your profile.' });
      setLoadingProfile(false);
      setRefreshing(false);
      return;
    }

    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        setUser(snap.data() as User);
      } else {
        setUser({
          id: uid,
          name: auth.currentUser?.displayName || 'User',
          email: auth.currentUser?.email || '',
          phone: (auth.currentUser?.phoneNumber as string) || '',
          countryCode: '+000',
          photoURL: auth.currentUser?.photoURL || null,
          authProvider: 'password',
          createdAt: new Date() as any,
          updatedAt: new Date() as any,
        });
      }
    } catch (e) {
      console.log('Profile load', e);
      Toast.show({ type: 'error', text1: 'Could not load profile', text2: 'Pull to refresh and try again.' });
    } finally {
      setLoadingProfile(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setEmail(user.email || '');
    setPhone(user.phone || '');
    setCountryCode(user.countryCode || '+000');
    setPhotoURL(user.photoURL || '');
  }, [user]);

  const saveProfile = async (photoOverride?: string | null) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Name required', text2: 'Please enter your name.' });
      return;
    }
    setSaving(true);
    try {
      const photoVal = photoOverride !== undefined ? photoOverride : (photoURL ? photoURL.trim() : null);
      await setDoc(doc(db, 'users', uid), {
        id: uid,
        name: name.trim(),
        email,
        phone: phone.trim(),
        countryCode: countryCode.trim(),
        photoURL: photoVal && photoVal.length > 0 ? photoVal : null,
        authProvider: 'password',
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      if (photoOverride) setPhotoURL(photoOverride);
      Toast.show({ type: 'success', text1: 'Saved', text2: 'Profile updated.' });
    } catch (e) {
      console.log('Profile save', e);
      Toast.show({ type: 'error', text1: 'Could not save', text2: 'Try again.' });
    } finally {
      setSaving(false);
    }
  };

  const pickAndUploadPhoto = async () => {
    try {
      setUploadingPhoto(true);
      // Dynamic require to avoid type-time resolution errors if module isn't installed
      let ImagePicker: any;
      try {
        ImagePicker = require('expo-image-picker');
      } catch {
        Toast.show({ type: 'info', text1: 'Missing dependency', text2: 'Please install expo-image-picker to change your photo.' });
        return;
      }
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Toast.show({ type: 'info', text1: 'Permission needed', text2: 'Allow photo library access to change your picture.' });
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1,1], quality: 0.8 });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const asset = res.assets[0];
      const fileUri = asset.uri;
      const fileName = asset.fileName || 'profile.jpg';
      const mimeType = asset.mimeType || 'image/jpeg';

      const form = new FormData();
      form.append('file', { uri: fileUri, name: fileName, type: mimeType } as any);
      form.append('meta', 'profile-photo');

      const url = 'https://httpbin.org/post';
      const uploadRes = await fetch(url, { method: 'POST', body: form });
      const json = await uploadRes.json();

      const echoedDataUrl = (json && json.files && json.files.file) ? String(json.files.file) : undefined;
      const remoteUrl = echoedDataUrl || fileUri;

      await saveProfile(remoteUrl);
      Toast.show({ type: 'success', text1: 'Photo updated' });
    } catch (e) {
      console.log('Upload photo error', e);
      Toast.show({ type: 'error', text1: 'Upload failed', text2: 'Could not upload photo. Try again.' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const sendResetEmail = async () => {
    if (!email) {
      Toast.show({ type: 'error', text1: 'Missing email', text2: 'No email found on this account.' });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      Toast.show({ type: 'success', text1: 'Reset email sent', text2: `Check ${email} for reset instructions.` });
    } catch (e: any) {
      console.log('Reset email error', e);
      Toast.show({ type: 'error', text1: 'Could not send reset', text2: e?.message || 'Try again.' });
    }
  };

  const changePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Toast.show({ type: 'error', text1: 'Password required', text2: 'Enter and confirm your new password.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      Toast.show({ type: 'error', text1: 'Mismatch', text2: 'Passwords do not match.' });
      return;
    }
    const userAuth = auth.currentUser;
    if (!userAuth) {
      Toast.show({ type: 'error', text1: 'Not signed in', text2: 'Please sign in again.' });
      return;
    }

    setChangingPwd(true);
    try {
      if (currentPassword && userAuth.email) {
        const cred = EmailAuthProvider.credential(userAuth.email, currentPassword);
        await reauthenticateWithCredential(userAuth, cred);
      }
      await updatePassword(userAuth, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
      Toast.show({ type: 'success', text1: 'Password updated' });
    } catch (e: any) {
      console.log('Password change error', e);
      let msg = e?.message || 'Could not change password.';
      if (e?.code === 'auth/requires-recent-login') msg = 'Please re-login or provide your current password, then try again.';
      Toast.show({ type: 'error', text1: 'Change failed', text2: msg });
    } finally {
      setChangingPwd(false);
    }
  };

  if (!user) return null;

  if (loadingProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 20, paddingTop: 0 }}>
            <View style={[styles.headerCard, { backgroundColor: '#F3EFFE' }]}>
              <Shimmer width={72} height={72} borderRadius={36} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Shimmer width="60%" height={18} style={{ marginBottom: 8 }} />
                <Shimmer width="40%" height={14} />
              </View>
              <Shimmer width={96} height={34} borderRadius={10} />
            </View>

            <View style={styles.formCard}>
              <Shimmer width="40%" height={16} style={{ marginBottom: 12 }} />
              {[1,2,3,4].map((i) => (
                <View key={i} style={{ marginBottom: 12 }}>
                  <Shimmer width="30%" height={14} style={{ marginBottom: 6 }} />
                  <Shimmer height={44} />
                </View>
              ))}
              <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
                <Shimmer width={120} height={44} borderRadius={12} />
              </View>
            </View>
          </View>
        </ScrollView>
        <BottomTabs />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProfile(); }} />}>
        <View style={{ paddingHorizontal: 20, paddingTop: 0 }}>
          <View style={styles.headerCard}>
            <Image source={ photoURL ? { uri: photoURL } : undefined } style={styles.avatar} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.name}>{name || 'Your Name'}</Text>
              <Text style={styles.email}>{email}</Text>
            </View>
            <Pressable style={[styles.photoBtn, uploadingPhoto && { opacity: 0.7 }]} disabled={uploadingPhoto} onPress={pickAndUploadPhoto}>
              <Text style={styles.photoBtnText}>{uploadingPhoto ? 'Uploading…' : 'Change Photo'}</Text>
            </Pressable>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.cardTitle}>Edit Profile</Text>
            <View style={styles.inputRow}><Text style={styles.inputLabel}>Name</Text><TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Enter your name" placeholderTextColor={C.TEXT_SECONDARY} /></View>
            <View style={styles.inputRow}><Text style={styles.inputLabel}>Email</Text><TextInput value={email} editable={false} style={[styles.input, { backgroundColor: '#F3F4F6' }]} /></View>
            <View style={styles.inputRow}><Text style={styles.inputLabel}>Country Code</Text><TextInput value={countryCode} onChangeText={setCountryCode} style={styles.input} placeholder="+237" placeholderTextColor={C.TEXT_SECONDARY} /></View>
            <View style={styles.inputRow}><Text style={styles.inputLabel}>Phone</Text><TextInput value={phone} onChangeText={setPhone} style={styles.input} placeholder="6XXXXXXXX" placeholderTextColor={C.TEXT_SECONDARY} keyboardType="phone-pad" /></View>
            

            <View style={styles.actionsRow}>
              <Pressable style={styles.saveBtn} onPress={() => saveProfile()} disabled={saving}>
                <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.cardTitle}>Password</Text>
            <Text style={styles.infoText}>Change your password or send a reset link to your email.</Text>
            <View style={styles.inputRow}><Text style={styles.inputLabel}>Current password (optional)</Text><TextInput value={currentPassword} onChangeText={setCurrentPassword} style={styles.input} placeholder="Enter current password" placeholderTextColor={C.TEXT_SECONDARY} secureTextEntry /></View>
            <View style={styles.inputRow}><Text style={styles.inputLabel}>New password</Text><TextInput value={newPassword} onChangeText={setNewPassword} style={styles.input} placeholder="Enter new password" placeholderTextColor={C.TEXT_SECONDARY} secureTextEntry /></View>
            <View style={styles.inputRow}><Text style={styles.inputLabel}>Confirm new password</Text><TextInput value={confirmPassword} onChangeText={setConfirmPassword} style={styles.input} placeholder="Confirm new password" placeholderTextColor={C.TEXT_SECONDARY} secureTextEntry /></View>
            <View style={styles.actionsRowSpread}>
              <Pressable style={[styles.saveBtn, styles.resetBtn, { flex: 1, marginRight: 8 }]} onPress={sendResetEmail}>
                <Text style={styles.saveText}>Send reset email</Text>
              </Pressable>
              <Pressable style={[styles.saveBtn, { flex: 1 }]} onPress={changePassword} disabled={changingPwd}>
                <Text style={styles.saveText}>{changingPwd ? 'Updating…' : 'Update password'}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Tip</Text>
            <Text style={styles.infoText}>Use a clear display name and keep your contact details up-to-date so we can personalize insights for you.</Text>
          </View>
        </View>
      </ScrollView>

      <BottomTabs />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.BACKGROUND_LIGHT },
  headerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.PRIMARY_PURPLE, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#EFEAFE' },
  name: { fontSize: 20, fontWeight: '900', color: C.TEXT_ON_PURPLE },
  email: { color: '#F0EBFF', marginTop: 4 },
  formCard: { backgroundColor: C.CARD_LIGHT, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER, marginTop: 16 },
  cardTitle: { color: C.TEXT_PRIMARY, fontWeight: '900', marginBottom: 8 },
  inputRow: { marginBottom: 12 },
  inputLabel: { color: C.TEXT_SECONDARY, fontWeight: '800', marginBottom: 6 },
  input: { backgroundColor: '#F8F7FF', borderWidth: 1, borderColor: C.BORDER, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: C.TEXT_PRIMARY, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  actionsRowSpread: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  saveBtn: { backgroundColor: C.PRIMARY_PURPLE, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
  saveText: { color: C.TEXT_ON_PURPLE, fontWeight: '900' },
  resetBtn: { backgroundColor: '#0EA5E9' },
  infoCard: { marginTop: 16, backgroundColor: '#EEF2FF', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E0E7FF' },
  infoTitle: { color: '#4338CA', fontWeight: '800', marginBottom: 4 },
  infoText: { color: '#475569', fontSize: 13, lineHeight: 18 },
  photoBtn: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DBEAFE', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  photoBtnText: { color: C.PRIMARY_PURPLE, fontWeight: '900' },
});
