import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const isExpoGoAndroid = Platform.OS === 'android' && Constants.appOwnership === 'expo';

// Configure how notifications should be handled when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Request notification permissions
export async function requestNotificationPermissions() {
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    const { status } = await Notifications.requestPermissionsAsync();

    if (isExpoGoAndroid) {
        console.warn(
            'Remote push notifications are not available on Expo Go for Android. Use a development build to test push; local notifications still work.'
        );
    }

    return status === 'granted';
}

export function androidExpoGoBlockedPush(): boolean {
    return isExpoGoAndroid;
}

// Schedule a local notification with seconds delay
export async function scheduleLocalNotification(
    title: string,
    body: string,
    seconds: number = 2
) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            sound: true,
            data: { type: 'local' },
        },
        trigger: {
            seconds,
            channelId: 'default',
        },
    });
}

// Schedule a notification for a specific date
export async function scheduleNotificationForDate(
    title: string,
    body: string,
    date: Date
) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            sound: true,
            data: { type: 'scheduled' },
        },
        trigger: {
            date,
            channelId: 'default',
        },
    });
}

// Schedule a reminder notification for debts
export async function scheduleDebtReminder(
    title: string,
    body: string,
    date: Date
): Promise<string> {
    // Convert Date to trigger format
    const triggerDate = new Date(date);

    const id = await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            sound: true,
            data: { type: 'debt_reminder' },
        },
        trigger: {
            date: triggerDate,
            channelId: 'default',
        },
    });

    return id;
}

// Cancel all scheduled notifications
export async function cancelAllScheduledNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
}

// Cancel a specific notification by ID
export async function cancelScheduledNotification(notificationId: string) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
}

// Get current notification permissions
export async function getNotificationPermissions() {
    return await Notifications.getPermissionsAsync();
}

// Test notification function
export async function testNotification() {
    await scheduleLocalNotification(
        'Test Notification 🔔',
        'Local notifications are working! This will fire in 10 seconds.',
        10
    );
}