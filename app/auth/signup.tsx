import * as C from '@/constants/colors';
import * as IMG from '@/constants/images';
import { auth, db } from '@/lib/firebase';
import { getFriendlyAuthErrorMessage } from '@/lib/firebaseErrors';
import { SignupPayload, UserProfile } from '@/types/models';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import Toast from 'react-native-toast-message';

const { height } = Dimensions.get('window');
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const strongPwd = (p: string) => p.length >= 8;

export default function Signup() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const canSubmit = name.trim().length >= 2 &&
        emailRegex.test(email) &&
        strongPwd(password) &&
        password === confirm;

    const onSignup = async () => {
        setError('');

        const payload: SignupPayload = {
            name: name.trim(),
            email: email.trim(),
            password,
            confirmPassword: confirm,
        };

        if (!payload.name || !emailRegex.test(payload.email)) {
            const msg = 'Please enter your full name and a valid email address.';
            setError(msg);
            Toast.show({ type: 'error', text1: 'Check your details', text2: msg });
            return;
        }
        if (!strongPwd(payload.password)) {
            const msg = 'Password must be at least 8 characters long.';
            setError(msg);
            Toast.show({ type: 'error', text1: 'Weak password', text2: msg });
            return;
        }
        if (payload.password !== payload.confirmPassword) {
            const msg = 'Passwords do not match.';
            setError(msg);
            Toast.show({ type: 'error', text1: 'Passwords mismatch', text2: msg });
            return;
        }

        setLoading(true);
        try {
            const cred = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
            if (cred.user) {
                try {
                    await updateProfile(cred.user, { displayName: payload.name });
                } catch (err) {
                    console.log('Profile update optional:', err);
                }

                try {
                    const userProfile: UserProfile = {
                        id: cred.user.uid,
                        name: payload.name,
                        email: payload.email,
                        phone: '',
                        countryCode: '',
                        photoURL: cred.user.photoURL ?? null,
                        authProvider: 'password',
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    };

                    await setDoc(doc(db, 'users', cred.user.uid), userProfile);
                } catch (profileError) {
                    console.log('Optional profile save error:', profileError);
                    Toast.show({
                        type: 'info',
                        text1: 'You are signed up',
                        text2: 'We could not save some profile details, but your account is ready.',
                    });
                }
            }

            Toast.show({
                type: 'success',
                text1: 'Account created',
                text2: 'Welcome to Money Dey! Redirecting you to your dashboard.',
            });
            router.replace('/dashboard');
        } catch (e) {
            const msg = getFriendlyAuthErrorMessage(e);
            setError(msg);
            Toast.show({ type: 'error', text1: 'Sign up failed', text2: msg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Header Section */}
                    <View style={styles.headerContainer}>
                        <Image
                            source={{ uri: IMG.ONBOARDING_1 }}
                            style={styles.heroImage}
                            resizeMode="cover"
                        />
                        <View style={styles.overlay} />
                        <View style={styles.headerContent}>
                            <Text style={styles.title}>Create your account</Text>
                            <Text style={styles.subtitle}>
                                Start your journey to financial freedom in Cameroon and across Africa.
                            </Text>
                        </View>
                    </View>

                    {/* Form Card */}
                    <View style={styles.cardContainer}>
                        <View style={styles.card}>
                            {!!error && (
                                <View style={styles.errorContainer}>
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            )}

                            {/* Full Name Input */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Full name</Text>
                                <TextInput
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="e.g., Marie N."
                                    placeholderTextColor={C.TEXT_SECONDARY}
                                    style={styles.input}
                                    autoCapitalize="words"
                                />
                            </View>

                            {/* Email Input */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Email</Text>
                                <TextInput
                                    value={email}
                                    onChangeText={setEmail}
                                    placeholder="you@example.com"
                                    placeholderTextColor={C.TEXT_SECONDARY}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    style={styles.input}
                                />
                            </View>


                            {/* Password Input */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Password</Text>
                                <View style={styles.passwordContainer}>
                                    <TextInput
                                        value={password}
                                        onChangeText={setPassword}
                                        placeholder="Create a strong password"
                                        placeholderTextColor={C.TEXT_SECONDARY}
                                        secureTextEntry={!showPwd}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        style={[styles.input, styles.passwordInput]}
                                    />
                                    <Pressable
                                        onPress={() => setShowPwd((v) => !v)}
                                        style={styles.eyeButton}
                                    >
                                        <Text style={styles.eyeText}>{showPwd ? 'Hide' : 'Show'}</Text>
                                    </Pressable>
                                </View>
                                <Text style={styles.hintText}>
                                    {password.length >= 8 ? '✓ Strong password' : 'Password must be at least 8 characters'}
                                </Text>
                            </View>

                            {/* Confirm Password Input */}
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Confirm password</Text>
                                <TextInput
                                    value={confirm}
                                    onChangeText={setConfirm}
                                    placeholder="Repeat password"
                                    placeholderTextColor={C.TEXT_SECONDARY}
                                    secureTextEntry={!showPwd}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    style={styles.input}
                                />
                                <Text style={[styles.hintText, confirm && password !== confirm ? styles.errorHint : null]}>
                                    {confirm && password !== confirm ? '✗ Passwords do not match' : ''}
                                </Text>
                            </View>

                            {/* Sign Up Button */}
                            <Pressable
                                style={[
                                    styles.signupButton,
                                    (!canSubmit || loading) && styles.signupButtonDisabled
                                ]}
                                onPress={onSignup}
                                disabled={!canSubmit || loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color={C.TEXT_ON_PURPLE} size="small" />
                                ) : (
                                    <Text style={styles.signupButtonText}>Create Account</Text>
                                )}
                            </Pressable>

                            {/* Login Link */}
                            <View style={styles.loginContainer}>
                                <Text style={styles.loginText}>Already have an account?</Text>
                                <Link href="/auth/login" asChild>
                                    <Pressable>
                                        <Text style={styles.loginLink}>Sign In</Text>
                                    </Pressable>
                                </Link>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
            <StatusBar hidden={true} />
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: C.BACKGROUND_LIGHT,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        backgroundColor: C.BACKGROUND_LIGHT,
    },
    headerContainer: {
        height: height * 0.3, // Slightly smaller than login to make room for more form fields
        position: 'relative',
        backgroundColor: C.PRIMARY_PURPLE,
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: C.PRIMARY_PURPLE_DARK,
        opacity: 0.4,
    },
    headerContent: {
        position: 'absolute',
        bottom: 30,
        left: 24,
        right: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: '#F0EBFF',
        lineHeight: 22,
        opacity: 0.95,
    },
    cardContainer: {
        flex: 1,
        paddingHorizontal: 20,
        marginTop: -15, // Less overlap than login since we have more form fields
    },
    card: {
        backgroundColor: C.CARD_LIGHT,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: C.BORDER,
        shadowColor: '#7C3AED',
        shadowOpacity: 0.15,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
    },
    errorContainer: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
        borderWidth: 1,
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
    },
    errorText: {
        color: C.ERROR,
        fontSize: 14,
        textAlign: 'center',
    },
    inputContainer: {
        marginBottom: 16,
    },
    label: {
        color: C.TEXT_SECONDARY,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    hintText: {
        color: C.TEXT_SECONDARY,
        fontSize: 12,
        marginTop: 4,
        marginLeft: 4,
    },
    errorHint: {
        color: C.ERROR,
    },
    input: {
        backgroundColor: '#F8F7FF',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: '#E5DEFF',
        color: C.TEXT_PRIMARY,
        fontSize: 16,
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    passwordInput: {
        flex: 1,
        marginBottom: 0,
    },
    eyeButton: {
        marginLeft: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: '#EFEAFE',
        borderRadius: 12,
        minWidth: 60,
        alignItems: 'center',
    },
    eyeText: {
        color: C.PRIMARY_PURPLE,
        fontWeight: '700',
        fontSize: 14,
    },
    signupButton: {
        backgroundColor: C.PRIMARY_PURPLE,
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 20,
    },
    signupButtonDisabled: {
        opacity: 0.5,
    },
    signupButtonText: {
        color: C.TEXT_ON_PURPLE,
        fontWeight: '800',
        fontSize: 16,
    },
    loginContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    loginText: {
        color: C.TEXT_SECONDARY,
        fontSize: 15,
    },
    loginLink: {
        color: C.PRIMARY_PURPLE,
        fontWeight: '800',
        fontSize: 15,
    },
});