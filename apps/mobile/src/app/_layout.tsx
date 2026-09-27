import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AuthProvider } from '@/features/auth/auth-provider';
import { supabaseAuthRepository } from '@/platform/auth/supabase-auth-repository';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider repository={supabaseAuthRepository}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F4F6F2' } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth/index" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="measurement/[metricId]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
