import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Color from '@/constants/colors';

// Placeholder screens
const Screen = ({ title, navigation, next }) => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Color.BACKGROUND_LIGHT }}>
    <Text style={{ fontSize: 24, color: Color.TEXT_PRIMARY, marginBottom: 12 }}>{title}</Text>
    {next && (
      <Pressable
        onPress={() => navigation.navigate(next)}
        style={{ backgroundColor: Color.PRIMARY_PURPLE, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
      >
        <Text style={{ color: Color.TEXT_ON_PURPLE }}>Go to {next}</Text>
      </Pressable>
    )}
  </View>
);

const LoginScreen = ({ navigation }) => <Screen title="Login" navigation={navigation} next="Signup" />;
const SignupScreen = ({ navigation }) => <Screen title="Signup" navigation={navigation} next="Dashboard" />;
const DashboardScreen = ({ navigation }) => <Screen title="Dashboard" navigation={navigation} next="Transactions" />;
const TransactionsScreen = ({ navigation }) => <Screen title="Transactions" navigation={navigation} next="Recommendations" />;
const RecommendationsScreen = ({ navigation }) => <Screen title="Recommendations" navigation={navigation} next="Settings" />;
const SettingsScreen = () => <Screen title="Settings" />;

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Color.BACKGROUND_LIGHT,
    primary: Color.PRIMARY_PURPLE,
    card: Color.CARD_LIGHT,
    text: Color.TEXT_PRIMARY,
    border: Color.BORDER,
    notification: Color.ACCENT_ORANGE,
  },
};

export default function AppNavigator() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: Color.CARD_LIGHT },
            headerTintColor: Color.TEXT_PRIMARY,
            headerTitleStyle: { fontWeight: '600' },
            animation: 'fade',
            gestureEnabled: true,
          }}
        >
          {/* Auth */}
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: true }} />
          <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: true, title: 'Sign Up' }} />
          {/* Main */}
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Transactions" component={TransactionsScreen} />
          <Stack.Screen name="Recommendations" component={RecommendationsScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
