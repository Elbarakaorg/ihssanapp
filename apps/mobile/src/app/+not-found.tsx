import { Link, Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette } from '@/ui/palette';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>This screen doesn't exist.</Text>
        <Link href="/" asChild>
          <Pressable accessibilityRole="button" style={styles.link}>
            <Text style={styles.linkText}>Return to Ihssan</Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.paper,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    color: palette.ink,
    fontFamily: 'Georgia',
    fontSize: 24,
  },
  link: {
    backgroundColor: palette.forest,
    borderRadius: 7,
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  linkText: {
    fontSize: 14,
    color: palette.white,
    fontWeight: '700',
  },
});
