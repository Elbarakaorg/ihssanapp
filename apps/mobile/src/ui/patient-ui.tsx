import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radii, spacing } from './palette';

export function Page({ children }: PropsWithChildren) {
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
  return (
    <View style={styles.notice}>
      <View style={styles.noticeDot} />
      <Text style={styles.noticeText}>Preview only · Use fictional health information</Text>
    </View>
  );
}

export function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      {children ? <Text style={styles.description}>{children}</Text> : null}
    </View>
  );
}

export function SectionHeading({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
    </View>
  );
}

export function BrandMark() {
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

export const uiStyles = StyleSheet.create({
  card: {
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderCurve: 'continuous',
    borderRadius: radii.medium,
    borderWidth: 1,
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
});

const styles = StyleSheet.create({
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
    borderRadius: radii.small,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeDot: {
    backgroundColor: palette.coral,
    borderRadius: radii.full,
    height: 8,
    width: 8,
  },
  noticeText: {
    color: palette.forest,
    fontSize: 11,
    fontWeight: '600',
  },
  heading: {
    marginBottom: spacing.lg,
  },
  eyebrow: {
    color: palette.forest,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  title: {
    color: palette.ink,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 36,
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
    fontSize: 18,
    fontWeight: '700',
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
    backgroundColor: palette.forest,
    borderRadius: 9,
    height: 30,
    justifyContent: 'center',
    position: 'relative',
    width: 30,
  },
  brandStem: {
    backgroundColor: palette.white,
    borderRadius: 2,
    height: 15,
    width: 4,
  },
  brandCross: {
    backgroundColor: palette.white,
    borderRadius: 2,
    height: 4,
    position: 'absolute',
    width: 15,
  },
  brandName: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '700',
  },
});