import * as C from '@/constants/colors';
import * as IMG from '@/constants/images';
import { auth } from '@/lib/firebase';
import { getFriendlyAuthErrorMessage } from '@/lib/firebaseErrors';
import { AuthCredentials } from '@/types/models';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { signInWithEmailAndPassword } from 'firebase/auth';
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

export default function Login() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const canSubmit = emailRegex.test(email) && password.length >= 8;

    const onLogin = async () => {
        setError('');
        const credentials: AuthCredentials = {
            email: email.trim(),
            password,
        };

        if (!emailRegex.test(credentials.email) || credentials.password.length < 8) {
            const msg = 'Please enter a valid email and password (min 8 characters).';
            setError(msg);
            Toast.show({ type: 'error', text1: 'Check your details', text2: msg });
            return;
        }
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
            Toast.show({
                type: 'success',
                text1: 'Welcome back',
                text2: 'You are now signed in.',
            });
            router.replace('/dashboard');
        } catch (e) {
            const msg = getFriendlyAuthErrorMessage(e);
            setError(msg);
            Toast.show({ type: 'error', text1: 'Sign in failed', text2: msg });
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
                            source={{ uri: IMG.ONBOARDING_2 }}
                            style={styles.heroImage}
                            resizeMode="cover"
                        />
                        <View style={styles.overlay} />
                        <View style={styles.headerContent}>
                            <Text style={styles.title}>Welcome back</Text>
                            <Text style={styles.subtitle}>
                                Sign in to manage your money in XAF. For Cameroon and Africa.
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
                                        placeholder="••••••••"
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
                            </View>

                            {/* Login Button */}
                            <Pressable
                                style={[
                                    styles.loginButton,
                                    (!canSubmit || loading) && styles.loginButtonDisabled
                                ]}
                                onPress={onLogin}
                                disabled={!canSubmit || loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color={C.TEXT_ON_PURPLE} size="small" />
                                ) : (
                                    <Text style={styles.loginButtonText}>Sign In</Text>
                                )}
                            </Pressable>

                            {/* Divider */}
                            <View style={styles.dividerContainer}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerText}>or continue with</Text>
                                <View style={styles.dividerLine} />
                            </View>

                            {/* Social Login Buttons */}
                            <View style={styles.socialContainer}>
                                <Pressable
                                    style={[styles.socialButton, styles.googleButton]}
                                    accessibilityLabel="Continue with Google"
                                >
                                    <Image
                                        source={{ uri: 'https://cdn-icons-png.flaticon.com/512/300/300221.png' }}
                                        style={styles.socialIcon}
                                    />
                                    <Text style={styles.socialText}>Google</Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.socialButton, styles.appleButton]}
                                    accessibilityLabel="Continue with Apple"
                                >
                                    <Image
                                        source={{ uri: 'https://cdn-icons-png.flaticon.com/512/0/747.png' }}
                                        style={[styles.socialIcon, styles.appleIcon]}
                                    />
                                    <Text style={[styles.socialText, styles.appleText]}>Apple</Text>
                                </Pressable>
                            </View>

                            {/* Sign Up Link */}
                            <View style={styles.signupContainer}>
                                <Text style={styles.signupText}>New to Money Dey?</Text>
                                <Link href="/auth/signup" asChild>
                                    <Pressable>
                                        <Text style={styles.signupLink}>Create account</Text>
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
        height: height * 0.35, // Use percentage instead of fixed height
        position: 'relative',
        backgroundColor: C.PRIMARY_PURPLE, // Fallback color
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
        marginTop: -20, // Slight overlap with header
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
        marginBottom: 20,
    },
    label: {
        color: C.TEXT_SECONDARY,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
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
    loginButton: {
        backgroundColor: C.PRIMARY_PURPLE,
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 24,
    },
    loginButtonDisabled: {
        opacity: 0.5,
    },
    loginButtonText: {
        color: C.TEXT_ON_PURPLE,
        fontWeight: '800',
        fontSize: 16,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: C.BORDER,
    },
    dividerText: {
        color: C.TEXT_SECONDARY,
        fontSize: 13,
        marginHorizontal: 12,
        fontWeight: '500',
    },
    socialContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    socialButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
    },
    googleButton: {
        backgroundColor: '#FFFFFF',
        borderColor: C.BORDER,
    },
    appleButton: {
        backgroundColor: '#000000',
        borderColor: '#333333',
    },
    socialIcon: {
        width: 20,
        height: 20,
    },
    appleIcon: {
        tintColor: '#FFFFFF',
    },
    socialText: {
        color: C.TEXT_PRIMARY,
        fontWeight: '700',
        fontSize: 15,
    },
    appleText: {
        color: '#FFFFFF',
    },
    signupContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    signupText: {
        color: C.TEXT_SECONDARY,
        fontSize: 15,
    },
    signupLink: {
        color: C.PRIMARY_PURPLE,
        fontWeight: '800',
        fontSize: 15,
    },
});

