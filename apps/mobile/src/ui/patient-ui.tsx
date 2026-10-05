import type { PropsWithChildren, ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Svg, { Path, Text as SvgText } from 'react-native-svg';

import { display, palette, radii, spacing, themedStyles, useScheme, wobble } from './palette';

export function Page({ children }: PropsWithChildren) {
  useScheme();
  return (
    <SafeAreaView style={[styles.safeArea, paperGrain]} edges={['top', 'left', 'right']}>
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
      <Ornament />
      {children ? <Text style={styles.description}>{children}</Text> : null}
    </View>
  );
}

/** A hand-drawn ink line with a small Victorian fleuron; the stroke is deliberately a little uneven. */
export function Ornament({ width = 168 }: { width?: number }) {
  useScheme();
  return (
    <Svg accessibilityElementsHidden height={16} importantForAccessibility="no-hide-descendants" style={{ marginVertical: 10 }} viewBox="0 0 168 16" width={width}>
      <Path d="M1 9 C 20 6, 38 11, 62 8 S 70 8.5, 72 8" fill="none" stroke={palette.line} strokeLinecap="round" strokeWidth={1.4} />
      <SvgText fill={palette.gold} fontSize={14} textAnchor="middle" x={84} y={12.5}>❦</SvgText>
      <Path d="M96 8.5 C 118 10, 132 6, 150 9 S 160 8, 167 8" fill="none" stroke={palette.line} strokeLinecap="round" strokeWidth={1.4} />
    </Svg>
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
    ...wobble,
    borderCurve: 'continuous',
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

/** Faint paper fibre on web; native keeps the flat paper colour. */
const paperGrain = Platform.OS === 'web'
  ? ({ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .35 0 0 0 0 .28 0 0 0 0 .18 0 0 0 .08 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` } as object)
  : null;

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
    ...display,
    color: palette.ink,
    fontSize: 36,
    lineHeight: 42,
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
    ...display,
    color: palette.ink,
    fontSize: 20,
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
    ...display,
    color: palette.ink,
    fontSize: 22,
    letterSpacing: 0.4,
  },
}));