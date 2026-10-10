import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { display, palette, themedStyles, useScheme } from '@/ui/palette';
import { useLocale } from '@/platform/locale/locale-provider';
import { donationCopy } from '@/platform/locale/donations';
import { GuideDemo } from './order-guide-demos';
import { getGuideSteps, type GuideStep, splitEmphasis } from './order-guide-steps';

const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);
const CLAMP = Extrapolation.CLAMP;
const PAGE_PAD = 20;
const DOT = 7;
const GAP = 9;
const PILL = 22;

function GuidePage({ step, index, count, scrollX, pageW, active, reduced, locale }: { step: GuideStep; index: number; count: number; scrollX: SharedValue<number>; pageW: number; active: boolean; reduced: boolean; locale: 'en' | 'fr' | 'ar' }) {
  useScheme();
  const demo = useAnimatedStyle(() => {
    if (reduced) return {};
    const rel = index * pageW - scrollX.get();
    return {
      opacity: interpolate(rel, [-pageW, 0, pageW], [0.25, 1, 0.25], CLAMP),
      transform: [{ translateX: -rel * 0.3 }, { scale: interpolate(rel, [-pageW, 0, pageW], [0.88, 1, 0.88], CLAMP) }],
    };
  });
  const copy = useAnimatedStyle(() => {
    if (reduced) return {};
    const rel = index * pageW - scrollX.get();
    return { opacity: interpolate(rel, [-pageW * 0.7, 0, pageW * 0.7], [0, 1, 0], CLAMP), transform: [{ translateX: rel * 0.12 }] };
  });
  return (
    <View style={[styles.page, { width: pageW }]}>
      <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={demo}>
        <GuideDemo active={active} locale={locale} step={step.key} width={pageW - PAGE_PAD * 2} />
      </Animated.View>
      <Animated.View style={[styles.copy, copy]}>
        <View style={styles.stepRow}>
          <View style={styles.badge}><Text style={styles.badgeText}>{index + 1}</Text></View>
          <Text style={[styles.stepOf, locale === 'ar' && styles.rtl]}>{donationCopy(locale, 'guide.stepOf', { step: index + 1, count })}</Text>
        </View>
        <Text style={[styles.title, locale === 'ar' && styles.rtl]}>{step.title}</Text>
        <Text style={[styles.body, locale === 'ar' && styles.rtl]}>
          {splitEmphasis(step.body).map((part, i) => <Text key={i} style={part.strong ? styles.strong : undefined}>{part.text}</Text>)}
        </Text>
      </Animated.View>
    </View>
  );
}

function Stepper({ scrollX, pageW, onSelect, locale }: { scrollX: SharedValue<number>; pageW: number; onSelect: (index: number) => void; locale: 'en' | 'fr' | 'ar' }) {
  useScheme();
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: (scrollX.get() / pageW) * (DOT + GAP) - (PILL - DOT) / 2 }] }));
  return (
    <View style={styles.dots}>
      {getGuideSteps(locale).map((step, index) => (
        <Pressable key={step.key} accessibilityLabel={donationCopy(locale, 'guide.stepAccessibility', { step: index + 1 })} accessibilityRole="button" hitSlop={10} onPress={() => onSelect(index)} style={styles.dot} />
      ))}
      <Animated.View pointerEvents="none" style={[styles.pill, pill]} />
    </View>
  );
}

/** A bottom sheet that explains how to complete a donation; drag the header down to dismiss. */
export function OrderGuide({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  useScheme();
  const { locale } = useLocale();
  const guideSteps = getGuideSteps(locale);
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const sheetW = Math.min(width, 560);
  const sheetH = Math.min(Math.round(height * 0.88), 700);
  const [mounted, setMounted] = useState(visible);
  const [page, setPage] = useState(0);
  const ty = useSharedValue(sheetH);
  const scrollX = useSharedValue(0);
  const scroller = useRef<Animated.ScrollView>(null);
  const wasVisible = useRef(false);
  const last = guideSteps.length - 1;

  useEffect(() => {
    if (visible) {
      wasVisible.current = true;
      setMounted(true);
      setPage(0);
      scrollX.set(0);
      ty.set(reduced ? withTiming(0, { duration: 150 }) : withSpring(0, { duration: 300, dampingRatio: 0.8 }));
    } else if (wasVisible.current) {
      wasVisible.current = false;
      ty.set(withTiming(sheetH, { duration: 220, easing: EASE_SHEET }, (finished) => {
        'worklet';
        if (finished) scheduleOnRN(setMounted, false);
      }));
    }
  }, [visible, sheetH, reduced, ty, scrollX]);

  const pan = useMemo(() => Gesture.Pan()
    .onUpdate((event) => { ty.set(Math.max(0, event.translationY)); })
    .onEnd((event) => {
      if (event.translationY > 110 || event.velocityY > 900) scheduleOnRN(onClose);
      else ty.set(withSpring(0, { duration: 400, dampingRatio: 0.8, velocity: event.velocityY }));
    }), [onClose, ty]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => { scrollX.set(event.contentOffset.x); },
    onMomentumEnd: (event) => { scheduleOnRN(setPage, Math.round(event.contentOffset.x / sheetW)); },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: interpolate(ty.get(), [0, sheetH], [1, 0], CLAMP) }));

  const go = (next: number) => {
    const target = Math.max(0, Math.min(last, next));
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    setPage(target);
    scroller.current?.scrollTo({ x: target * sheetW, animated: true });
  };

  if (!mounted) return null;
  return (
    <Modal animationType="none" onRequestClose={onClose} statusBarTranslucent transparent visible>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable accessibilityLabel={donationCopy(locale, 'guide.close')} onPress={onClose} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View accessibilityViewIsModal style={[styles.sheet, locale === 'ar' && styles.rtl, { height: sheetH, width: sheetW }, sheetStyle]}>
          <GestureDetector gesture={pan}>
            <View style={styles.header}>
              <View style={styles.handle} />
              <View style={styles.titleRow}>
                  <Text style={[styles.sheetTitle, locale === 'ar' && styles.rtl]}>{donationCopy(locale, 'guide.title')}</Text>
                  <Pressable accessibilityLabel={donationCopy(locale, 'guide.close')} accessibilityRole="button" hitSlop={8} onPress={onClose} style={styles.close}><X color={palette.ink} size={18} /></Pressable>
              </View>
            </View>
          </GestureDetector>
          <Animated.ScrollView bounces={false} horizontal onScroll={onScroll} pagingEnabled ref={scroller} scrollEventThrottle={16} showsHorizontalScrollIndicator={false} style={styles.pager}>
            {guideSteps.map((step, index) => (
              <GuidePage key={step.key} active={page === index} count={guideSteps.length} index={index} locale={locale} pageW={sheetW} reduced={reduced} scrollX={scrollX} step={step} />
            ))}
          </Animated.ScrollView>
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <Pressable accessibilityRole="button" disabled={page === 0} onPress={() => go(page - 1)} style={[styles.back, page === 0 && styles.hidden]}><Text style={[styles.backText, locale === 'ar' && styles.rtl]}>{donationCopy(locale, 'guide.back')}</Text></Pressable>
            <Stepper locale={locale} onSelect={go} pageW={sheetW} scrollX={scrollX} />
            <Pressable accessibilityRole="button" onPress={() => (page === last ? onClose() : go(page + 1))} style={({ pressed }) => [styles.next, pressed && styles.pressed]}>
              <Text style={[styles.nextText, locale === 'ar' && styles.rtl]}>{donationCopy(locale, page === last ? 'guide.done' : 'guide.next')}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  root: { alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(20,40,28,0.55)' },
  sheet: { backgroundColor: palette.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  header: { paddingBottom: 6, paddingHorizontal: PAGE_PAD, paddingTop: 10 },
  handle: { alignSelf: 'center', backgroundColor: palette.line, borderRadius: 3, height: 5, width: 40 },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  sheetTitle: { ...display, color: palette.ink, fontSize: 20 },
  close: { alignItems: 'center', backgroundColor: palette.leaf, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  pager: { flex: 1 },
  page: { paddingHorizontal: PAGE_PAD, paddingTop: 10 },
  copy: { gap: 6, marginTop: 18 },
  stepRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  badge: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 11, height: 22, justifyContent: 'center', width: 22 },
  badgeText: { color: palette.white, fontSize: 12, fontWeight: '800' },
  stepOf: { color: palette.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  title: { ...display, color: palette.ink, fontSize: 23, lineHeight: 29 },
  body: { color: palette.muted, fontSize: 15, lineHeight: 23 },
  strong: { color: palette.forest, fontWeight: '800' },
  footer: { alignItems: 'center', borderTopColor: palette.line, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: PAGE_PAD, paddingTop: 12 },
  back: { justifyContent: 'center', minHeight: 44, minWidth: 64 },
  hidden: { opacity: 0 },
  backText: { color: palette.muted, fontSize: 15, fontWeight: '700' },
  dots: { flexDirection: 'row', gap: GAP, height: DOT, justifyContent: 'center' },
  dot: { backgroundColor: palette.leafDeep, borderRadius: DOT / 2, height: DOT, width: DOT },
  pill: { backgroundColor: palette.forest, borderRadius: DOT / 2, height: DOT, left: 0, position: 'absolute', top: 0, width: PILL },
  next: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 22, justifyContent: 'center', minHeight: 44, minWidth: 96, paddingHorizontal: 22 },
  nextText: { color: palette.white, fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
  rtl: { direction: 'rtl', writingDirection: 'rtl', textAlign: 'right' },
}));
