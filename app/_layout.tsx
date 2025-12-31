import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import Toast from 'react-native-toast-message';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { androidExpoGoBlockedPush, requestNotificationPermissions } from '@/lib/notifications';

// Configure notifications only if available (SDK 53+ requires development build for remote notifications)
let Notifications: any;
try {
    Notifications = require('expo-notifications');
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
} catch (e) {
    console.warn('Notifications not available in this environment');
}

export default function RootLayout() {
    const colorScheme = useColorScheme();

    useEffect(() => {
        const setupNotifications = async () => {
            try {
                const granted = await requestNotificationPermissions();

                if (androidExpoGoBlockedPush()) {
                    Toast.show({
                        type: 'info',
                        text1: 'Build required for push',
                        text2: 'Expo Go on Android cannot receive remote push. Use a development build; local notifications still work.',
                    });
                    return;
                }

                if (!granted) {
                    Toast.show({ type: 'info', text1: 'Notifications off', text2: 'Enable notifications to receive alerts.' });
                }
            } catch (e) {
                console.warn('Failed to setup notifications:', e);
            }
        };

        if (Notifications) {
            setupNotifications();
        }
    }, []);

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <Stack screenOptions={{ headerShown: false, }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="onboarding" />
                    <Stack.Screen name="auth/login" />
                    <Stack.Screen name="auth/signup" />
                    <Stack.Screen name="dashboard" />
                    <Stack.Screen name="transactions" />
                    <Stack.Screen name="transactions/add" />
                    <Stack.Screen name="[id]" />
                    <Stack.Screen name="debts" />
                    <Stack.Screen name="recommendations" />
                    <Stack.Screen name="notifications" />
                    <Stack.Screen name="settings" />
                    <Stack.Screen name="profile" />
                </Stack>
                <StatusBar style="auto" />
                <Toast />
            </ThemeProvider>
        </GestureHandlerRootView>
    );
}