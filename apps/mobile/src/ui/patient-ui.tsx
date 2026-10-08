import type { PropsWithChildren, ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import Svg, { Path, Text as SvgText } from 'react-native-svg';

import { display, palette, radii, spacing, themedStyles, useScheme, wobble } from './palette';

export function Page({ children }: PropsWithChildren) {
  useScheme();
  return (
    <SafeAreaView style={[styles.safeArea, paperBackground()]} edges={['top', 'left', 'right']}>
      {Platform.OS === 'web' ? null : <LinearGradient colors={[palette.washSage, 'transparent', palette.washClay]} locations={[0, 0.45, 1]} pointerEvents="none" style={StyleSheet.absoluteFill} />}
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

/** Bento grid: tiles of different sizes that wrap. `wide` takes a full row, `tall` is a taller half. */
export function Bento({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.bento, style]}>{children}</View>;
}

export function BentoTile({ children, span = 'half', onPress, label, hint, style }: PropsWithChildren<{ span?: 'half' | 'wide'; onPress?: () => void; label?: string; hint?: string; style?: StyleProp<ViewStyle> }>) {
  useScheme();
  const tileStyle = [uiStyles.card, styles.tile, span === 'wide' ? styles.tileWide : styles.tileHalf, style];
  if (!onPress) return <View style={tileStyle}>{children}</View>;
  return (
    <Pressable accessibilityHint={hint} accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [tileStyle, pressed && styles.tilePressed]}>
      {children}
    </Pressable>
  );
}

// Frosted glass on web; native uses a translucent fill over the page wash.
const glass = Platform.OS === 'web'
  ? ({ backdropFilter: 'blur(14px) saturate(1.15)', WebkitBackdropFilter: 'blur(14px) saturate(1.15)', boxShadow: '0 1px 0 rgba(255,255,255,.5) inset, 0 8px 24px -12px rgba(60,45,25,.28)' } as object)
  : ({ shadowColor: '#3C2D19', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 2 } as object);

export const uiStyles = themedStyles(() => StyleSheet.create({
  card: {
    backgroundColor: palette.glass,
    borderColor: palette.glassEdge,
    ...wobble,
    ...glass,
    borderCurve: 'continuous',
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
}));

/** Faint paper fibre plus two soft colour washes on web; native keeps the flat paper colour with a gradient wash. */
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .35 0 0 0 0 .28 0 0 0 0 .18 0 0 0 .08 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const paperBackground = () => Platform.OS === 'web'
  ? ({ backgroundImage: `${GRAIN}, radial-gradient(80% 340px at 50% 0%, ${palette.washSage}, transparent), radial-gradient(50% 35% at 100% 22%, ${palette.washClay}, transparent)` } as object)
  : null;

const styles = themedStyles(() => StyleSheet.create({
  safeArea: {
    backgroundColor: palette.paper,
    flex: 1,
  },
  bento: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { gap: 4, minHeight: 132 },
  tileHalf: { flexBasis: 150, flexGrow: 1, flexShrink: 1 },
  tileWide: { flexBasis: '100%', flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 96 },
  tilePressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
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