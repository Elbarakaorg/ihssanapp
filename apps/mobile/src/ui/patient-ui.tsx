import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radii, spacing } from './palette';
import { themedStyles, useScheme } from '@/ui/palette';

export function Page({ children }: PropsWithChildren) {
  useScheme();
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function PreviewNotice() {
  useScheme();
  return (
    <View style={styles.notice}>
      <View style={styles.noticeDot} />
      <Text style={styles.noticeText}>Preview build. Use fictional health information.</Text>
    </View>
  );
}

export function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  useScheme();
  return (
    <View style={styles.heading}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      {children ? <Text style={styles.description}>{children}</Text> : null}
    </View>
  );
}

export function SectionHeading({ title, detail }: { title: string; detail?: string }) {
  useScheme();
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
    </View>
  );
}

export function BrandMark() {
  useScheme();
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandIcon}>
        <View style={styles.brandStem} />
        <View style={styles.brandCross} />
      </View>
      <Text style={styles.brandName}>ihssan</Text>
    </View>
  );
}

export const uiStyles = themedStyles(() => StyleSheet.create({
  card: {
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderCurve: 'continuous',
    borderRadius: radii.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  iconTile: {
    alignItems: 'center',
    backgroundColor: palette.leaf,
    borderCurve: 'continuous',
    borderRadius: radii.small,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
}));

const styles = themedStyles(() => StyleSheet.create({
  safeArea: {
    backgroundColor: palette.paper,
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    maxWidth: 720,
    paddingBottom: 120,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    width: '100%',
  },
  notice: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.leaf,
    borderCurve: 'continuous',
    borderRadius: 6,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  noticeDot: {
    backgroundColor: palette.forest,
    borderRadius: radii.full,
    height: 6,
    width: 6,
  },
  noticeText: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: '500',
  },
  heading: {
    marginBottom: spacing.lg,
  },
  eyebrow: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  title: {
    color: palette.ink,
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: -0.6,
    lineHeight: 38,
  },
  description: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
    maxWidth: 560,
  },
  sectionHeading: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '600',
  },
  sectionDetail: {
    color: palette.muted,
    fontSize: 13,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    marginBottom: 14,
  },
  brandIcon: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    height: 26,
    justifyContent: 'center',
    position: 'relative',
    width: 26,
  },
  brandStem: {
    backgroundColor: palette.forest,
    borderRadius: 1,
    height: 17,
    width: 3,
  },
  brandCross: {
    backgroundColor: palette.forest,
    borderRadius: 1,
    height: 3,
    position: 'absolute',
    width: 17,
  },
  brandName: {
    color: palette.ink,
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: 0.15,
  },
}));