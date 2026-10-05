import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { EBGaramond_500Medium, EBGaramond_600SemiBold, useFonts } from '@expo-google-fonts/eb-garamond';

import { AuthProvider } from '@/features/auth/auth-provider';
import { LocaleProvider } from '@/platform/locale/locale-provider';
import { supabaseAuthRepository } from '@/platform/auth/supabase-auth-repository';
import { ThemeProvider, useThemeMode } from '@/platform/theme/theme-provider';
import { palette, useScheme } from '@/ui/palette';

function AppShell() {
  useScheme();
  const { scheme } = useThemeMode();
  // Headings fall back to the system serif if the font fails to load, so never block the app on it.
  useFonts({ EBGaramond_500Medium, EBGaramond_600SemiBold });

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.paper } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/index" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="auth/callback" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="auth/complete-profile" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="account" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="measurement/[metricId]" options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: true }} />
        <Stack.Screen name="scan" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="share/profile" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="my-patients/[grantId]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider repository={supabaseAuthRepository}>
          <LocaleProvider>
            <AppShell />
          </LocaleProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
