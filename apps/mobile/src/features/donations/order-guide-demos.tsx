import { Camera, Check, Copy, FileCheck2, Heart, Image as ImageIcon, Landmark } from 'lucide-react-native';
import { type ReactNode, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, Extrapolation, cancelAnimation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

import { display, palette, themedStyles, useScheme } from '@/ui/palette';
import type { GuideStepKey } from './order-guide-steps';

export const DEMO_HEIGHT = 212;
const PAD = 12;
const REST = 0.9;
const CLAMP = Extrapolation.CLAMP;
const OUT = Easing.out(Easing.cubic);

function ramp(t: number, from: number, to: number) {
  'worklet';
  return interpolate(t, [from, to], [0, 1], CLAMP);
}

function pulse(t: number, from: number, to: number, fade = 0.03) {
  'worklet';
  return interpolate(t, [from, from + fade, to, to + fade], [0, 1, 1, 0], CLAMP);
}

/** One looping clock per demo; it rests on its finished state when idle or when motion is reduced. */
function useLoop(active: boolean, duration = 7200) {
  const reduced = useReducedMotion();
  const t = useSharedValue(REST);
  useEffect(() => {
    cancelAnimation(t);
    if (reduced || !active) { t.set(REST); return undefined; }
    t.set(0);
    t.set(withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(t);
  }, [active, reduced, duration, t]);
  return t;
}

type Clock = { t: SharedValue<number>; width: number };
type Stop = { at: number; x: number; y: number };

function Cursor({ t, width, stops, taps }: Clock & { stops: Stop[]; taps: number[] }) {
  const times = stops.map((stop) => stop.at);
  const xs = stops.map((stop) => stop.x * width);
  const ys = stops.map((stop) => stop.y);
  const finger = useAnimatedStyle(() => {
    const v = t.get();
    let press = 0;
    for (let i = 0; i < taps.length; i++) press = Math.max(press, interpolate(v, [taps[i] - 0.025, taps[i], taps[i] + 0.04], [0, 1, 0], CLAMP));
    return { transform: [{ translateX: interpolate(v, times, xs, CLAMP) - 11 }, { translateY: interpolate(v, times, ys, CLAMP) - 11 }, { scale: 1 - 0.22 * press }] };
  });
  const ring = useAnimatedStyle(() => {
    const v = t.get();
    let p = -1;
    for (let i = 0; i < taps.length; i++) { const q = (v - taps[i]) / 0.1; if (q >= 0 && q <= 1) p = q; }
    return {
      opacity: p < 0 ? 0 : 0.42 * (1 - p),
      transform: [{ translateX: interpolate(v, times, xs, CLAMP) - 22 }, { translateY: interpolate(v, times, ys, CLAMP) - 22 }, { scale: p < 0 ? 0.3 : 0.4 + p * 1.1 }],
    };
  });
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.ring, ring]} />
      <Animated.View pointerEvents="none" style={[styles.finger, finger]} />
    </>
  );
}

function TypedChunk({ chunk, t, at, textStyle }: { chunk: string; t: SharedValue<number>; at: number; textStyle: object }) {
  const style = useAnimatedStyle(() => ({ opacity: ramp(t.get(), at, at + 0.012) }));
  return <Animated.Text style={[textStyle, style]}>{chunk}</Animated.Text>;
}

/** Reveals text a couple of characters at a time, like typing or pasting. */
function Typed({ text, t, from, to, textStyle }: { text: string; t: SharedValue<number>; from: number; to: number; textStyle: object }) {
  const chunks = useMemo(() => (text.match(/.{1,2}/g) ?? []).map((chunk) => chunk.replace(/ /g, '\u00A0')), [text]);
  return (
    <View style={styles.typedRow}>
      {chunks.map((chunk, index) => <TypedChunk key={index} at={from + ((to - from) * index) / chunks.length} chunk={chunk} t={t} textStyle={textStyle} />)}
    </View>
  );
}

function Fade({ t, style, show, children }: { t: SharedValue<number>; style?: object; show: (t: number) => number; children: ReactNode }) {
  const animated = useAnimatedStyle(() => {
    const o = show(t.get());
    return { opacity: o, transform: [{ translateY: (1 - o) * 8 }] };
  });
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

function Demo({ t, width, children }: Clock & { children: ReactNode }) {
  const frame = useAnimatedStyle(() => ({ opacity: interpolate(t.get(), [0, 0.04, 0.95, 1], [0, 1, 1, 0], CLAMP) }));
  return (
    <View style={[styles.frame, { width }]}>
      <Animated.View style={[StyleSheet.absoluteFill, frame]}>{children}</Animated.View>
    </View>
  );
}

// 1. Copy ---------------------------------------------------------------------------------------------------------------
const NEVER = 2;

function CopyRow({ t, top, label, value, tapAt = NEVER }: { t: SharedValue<number>; top: number; label: string; value: string; tapAt?: number }) {
  const copied = (v: number) => { 'worklet'; return ramp(v, tapAt, tapAt + 0.03) * (1 - ramp(v, 0.94, 0.97)); };
  const flash = useAnimatedStyle(() => ({ opacity: pulse(t.get(), tapAt, tapAt + 0.16, 0.04) * 0.9 }));
  const check = useAnimatedStyle(() => ({ opacity: copied(t.get()), transform: [{ scale: 0.6 + 0.4 * copied(t.get()) }] }));
  const copy = useAnimatedStyle(() => ({ opacity: 1 - copied(t.get()) }));
  return (
    <View style={[styles.row, { top }]}>
      <Animated.View pointerEvents="none" style={[styles.rowFlash, flash]} />
      <View>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
      <View style={styles.iconBox}>
        <Animated.View style={[styles.iconLayer, copy]}><Copy color={palette.muted} size={17} /></Animated.View>
        <Animated.View style={[styles.iconLayer, check]}><Check color={palette.forest} size={19} strokeWidth={2.6} /></Animated.View>
      </View>
    </View>
  );
}

function CopyDemo({ t, width }: Clock) {
  const toast = useAnimatedStyle(() => {
    const o = Math.max(pulse(t.get(), 0.22, 0.34), pulse(t.get(), 0.56, 0.68));
    return { opacity: o, transform: [{ translateY: (1 - o) * 8 }] };
  });
  return (
    <>
      <CopyRow t={t} top={10} label="Account number" value="2307 8000 0000 0001" tapAt={0.22} />
      <CopyRow t={t} top={62} label="Amount" value="200 MAD" />
      <CopyRow t={t} top={114} label="Transfer reference" value="IH-K7P2Q9X" tapAt={0.56} />
      <Animated.View pointerEvents="none" style={[styles.toast, { left: width / 2 - 48 }, toast]}>
        <Check color={palette.white} size={13} strokeWidth={3} /><Text style={styles.toastText}>Copied</Text>
      </Animated.View>
      <Cursor t={t} width={width} taps={[0.22, 0.56]} stops={[{ at: 0, x: 1.05, y: 205 }, { at: 0.18, x: 0.68, y: 33 }, { at: 0.26, x: 0.68, y: 33 }, { at: 0.5, x: 0.68, y: 137 }, { at: 0.6, x: 0.68, y: 137 }, { at: 0.84, x: 1.05, y: 205 }]} />
    </>
  );
}

// 2. Send ---------------------------------------------------------------------------------------------------------------
function BankField({ t, top, label, text, from, to }: { t: SharedValue<number>; top: number; label: string; text: string; from: number; to: number }) {
  const active = useAnimatedStyle(() => ({ opacity: pulse(t.get(), from - 0.04, to + 0.02, 0.03) }));
  return (
    <View style={[styles.bankField, { top }]}>
      <Animated.View pointerEvents="none" style={[styles.activeOutline, active]} />
      <Text style={styles.bankLabel}>{label}</Text>
      <Typed from={from} t={t} text={text} textStyle={styles.bankValue} to={to} />
    </View>
  );
}

function SendDemo({ t, width }: Clock) {
  const sent = useAnimatedStyle(() => ({ opacity: ramp(t.get(), 0.72, 0.76) }));
  const send = useAnimatedStyle(() => ({ opacity: 1 - ramp(t.get(), 0.72, 0.76) }));
  return (
    <>
      <View style={styles.bankBar}><Landmark color={palette.muted} size={14} /><Text style={styles.bankBarText}>Your bank app · New transfer</Text></View>
      <BankField t={t} top={40} label="To account" text="2307 8000 0000 0001" from={0.12} to={0.28} />
      <BankField t={t} top={84} label="Amount" text="200 MAD" from={0.33} to={0.4} />
      <BankField t={t} top={128} label="Message" text="IH-K7P2Q9X" from={0.46} to={0.58} />
      <View style={styles.sendButton}>
        <Animated.Text style={[styles.sendLabel, send]}>Send</Animated.Text>
        <Animated.View style={[styles.sentRow, sent]}><Check color={palette.white} size={15} strokeWidth={3} /><Text style={styles.sendLabel}>Sent</Text></Animated.View>
      </View>
      <Cursor t={t} width={width} taps={[0.1, 0.3, 0.43, 0.72]} stops={[{ at: 0, x: 1.05, y: 205 }, { at: 0.07, x: 0.55, y: 58 }, { at: 0.12, x: 0.55, y: 58 }, { at: 0.27, x: 0.55, y: 102 }, { at: 0.33, x: 0.55, y: 102 }, { at: 0.4, x: 0.55, y: 146 }, { at: 0.46, x: 0.55, y: 146 }, { at: 0.68, x: 0.5, y: 189 }, { at: 0.76, x: 0.5, y: 189 }, { at: 0.9, x: 1.05, y: 208 }]} />
    </>
  );
}

// 3. Save ---------------------------------------------------------------------------------------------------------------
function SaveDemo({ t, width }: Clock) {
  const dx = width / 2 - 38;
  const screen = useAnimatedStyle(() => ({ opacity: 1 - 0.72 * ramp(t.get(), 0.4, 0.55) }));
  const flash = useAnimatedStyle(() => ({ opacity: pulse(t.get(), 0.34, 0.37, 0.05) * 0.92 }));
  const thumb = useAnimatedStyle(() => {
    const k = OUT(ramp(t.get(), 0.4, 0.6));
    return { opacity: ramp(t.get(), 0.35, 0.37), transform: [{ translateX: dx * k }, { translateY: 62 * k }, { scale: 1 - 0.5 * k }] };
  });
  const saved = useAnimatedStyle(() => ({ opacity: ramp(t.get(), 0.6, 0.67), transform: [{ translateY: (1 - ramp(t.get(), 0.6, 0.67)) * 8 }] }));
  return (
    <>
      <Animated.View style={[styles.saveScreen, screen]}>
        <View style={styles.bigCheck}><Check color={palette.white} size={28} strokeWidth={3} /></View>
        <Text style={styles.saveTitle}>Transfer sent</Text>
        <Text style={styles.saveMeta}>200 MAD · IH-K7P2Q9X</Text>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.thumb, { left: width / 2 - 38 }, thumb]}>
        <FileCheck2 color={palette.forest} size={26} />
        <View style={styles.thumbLine} /><View style={[styles.thumbLine, styles.thumbShort]} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flash]} />
      <Animated.View pointerEvents="none" style={[styles.savedChip, saved]}><Camera color={palette.forest} size={14} /><Text style={styles.savedText}>Screenshot saved</Text></Animated.View>
    </>
  );
}

// 4. Upload -------------------------------------------------------------------------------------------------------------
function UploadDemo({ t, width }: Clock) {
  const label = useAnimatedStyle(() => ({ opacity: 1 - ramp(t.get(), 0.7, 0.73) }));
  const uploading = useAnimatedStyle(() => ({ opacity: pulse(t.get(), 0.7, 0.79, 0.03) }));
  const button = useAnimatedStyle(() => ({ opacity: 1 - ramp(t.get(), 0.82, 0.86) }));
  const banner = useAnimatedStyle(() => ({ opacity: ramp(t.get(), 0.82, 0.86), transform: [{ scale: 0.96 + 0.04 * ramp(t.get(), 0.82, 0.86) }] }));
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: 132 * (1 - OUT(ramp(t.get(), 0.2, 0.3)) * (1 - ramp(t.get(), 0.6, 0.7))) }] }));
  const picked = useAnimatedStyle(() => ({ opacity: ramp(t.get(), 0.5, 0.54) }));
  return (
    <>
      <Animated.View style={[styles.uploadButton, button]}>
        <Animated.Text numberOfLines={1} style={[styles.uploadLabel, label]}>Upload receipt &amp; confirm donation</Animated.Text>
        <Animated.Text style={[styles.uploadLabel, styles.layer, uploading]}>Uploading…</Animated.Text>
      </Animated.View>
      <Animated.View style={[styles.uploadBanner, banner]}><Check color={palette.forest} size={17} strokeWidth={3} /><Text style={styles.bannerText}>Receipt received</Text></Animated.View>
      <Text style={styles.linkHint}>I paid but have no receipt</Text>
      <Animated.View style={[styles.pickerSheet, sheet]}>
        <Text style={styles.sheetTitle}>Choose your receipt</Text>
        <View style={styles.tiles}>
          {[0, 1, 2].map((index) => (
            <View key={index} style={styles.tile}>
              <ImageIcon color={palette.muted} size={20} />
              {index === 1 ? <Animated.View style={[styles.tilePicked, picked]}><View style={styles.tileCheck}><Check color={palette.white} size={12} strokeWidth={3.4} /></View></Animated.View> : null}
            </View>
          ))}
        </View>
      </Animated.View>
      <Cursor t={t} width={width} taps={[0.16, 0.5]} stops={[{ at: 0, x: 1.05, y: 205 }, { at: 0.12, x: 0.5, y: 42 }, { at: 0.2, x: 0.5, y: 42 }, { at: 0.44, x: 0.5, y: 150 }, { at: 0.56, x: 0.5, y: 150 }, { at: 0.74, x: 1.05, y: 208 }]} />
    </>
  );
}

// 5. Account name -------------------------------------------------------------------------------------------------------
function NameDemo({ t, width }: Clock) {
  const pill = useAnimatedStyle(() => ({ opacity: ramp(t.get(), 0.7, 0.76), transform: [{ translateY: (1 - ramp(t.get(), 0.7, 0.76)) * 8 }] }));
  const revealed = (v: number) => { 'worklet'; return ramp(v, 0.2, 0.3); };
  return (
    <>
      <Text style={styles.noReceiptLink}>I paid but have no receipt</Text>
      <Fade t={t} show={revealed} style={styles.nameBlock}>
        <Text style={styles.label}>Name on the account you paid from</Text>
        <View style={styles.input}><Typed from={0.32} t={t} text="Amina El Fassi" textStyle={styles.inputText} to={0.5} /></View>
      </Fade>
      <Fade t={t} show={revealed} style={styles.confirmButton}><Text style={styles.uploadLabel}>Confirm donation</Text></Fade>
      <Animated.View style={[styles.pillRow, pill]}><View style={styles.reviewPill}><Text style={styles.reviewText}>Awaiting review</Text></View></Animated.View>
      <Cursor t={t} width={width} taps={[0.14, 0.64]} stops={[{ at: 0, x: 1.05, y: 205 }, { at: 0.08, x: 0.5, y: 24 }, { at: 0.18, x: 0.5, y: 24 }, { at: 0.26, x: 0.5, y: 84 }, { at: 0.5, x: 0.5, y: 84 }, { at: 0.6, x: 0.5, y: 134 }, { at: 0.68, x: 0.5, y: 134 }, { at: 0.84, x: 1.05, y: 205 }]} />
    </>
  );
}

// 6. Counted ------------------------------------------------------------------------------------------------------------
function CountedDemo({ t, width }: Clock) {
  const trackWidth = width - PAD * 2;
  const review = useAnimatedStyle(() => ({ opacity: 1 - ramp(t.get(), 0.34, 0.38) }));
  const confirmed = useAnimatedStyle(() => ({ opacity: ramp(t.get(), 0.34, 0.38) }));
  const fill = useAnimatedStyle(() => ({ width: trackWidth * (0.62 + 0.1 * OUT(ramp(t.get(), 0.4, 0.64))) }));
  const before = useAnimatedStyle(() => ({ opacity: 1 - ramp(t.get(), 0.42, 0.48) }));
  const after = useAnimatedStyle(() => ({ opacity: ramp(t.get(), 0.42, 0.48) }));
  const plus = useAnimatedStyle(() => ({ opacity: pulse(t.get(), 0.4, 0.62, 0.04), transform: [{ translateY: -26 * ramp(t.get(), 0.4, 0.68) }] }));
  const heart = useAnimatedStyle(() => ({ opacity: ramp(t.get(), 0.5, 0.54), transform: [{ scale: interpolate(t.get(), [0.5, 0.58, 0.66], [0, 1.2, 1], CLAMP) }] }));
  const thanks = useAnimatedStyle(() => ({ opacity: ramp(t.get(), 0.6, 0.68) }));
  return (
    <>
      <View style={styles.caseRow}>
        <Text numberOfLines={1} style={styles.caseTitle}>Amina&apos;s treatment</Text>
        <View style={styles.pillStack}>
          <Animated.View style={[styles.statusPill, styles.pillWait, review]}><Text style={styles.reviewText}>Awaiting review</Text></Animated.View>
          <Animated.View style={[styles.statusPill, styles.pillOk, confirmed]}><Check color={palette.forest} size={12} strokeWidth={3} /><Text style={styles.reviewText}>Confirmed</Text></Animated.View>
        </View>
      </View>
      <View style={[styles.track, { width: trackWidth }]}><Animated.View style={[styles.fill, fill]} /></View>
      <View style={styles.amountRow}>
        <View>
          <Animated.Text style={[styles.raised, before]}>1,240 MAD</Animated.Text>
          <Animated.Text style={[styles.raised, styles.layer, after]}>1,440 MAD</Animated.Text>
        </View>
        <Text style={styles.goal}>of 2,000 MAD</Text>
      </View>
      <Animated.View pointerEvents="none" style={[styles.plusChip, { left: PAD + trackWidth * 0.72 - 46 }, plus]}><Text style={styles.plusText}>+200 MAD</Text></Animated.View>
      <Animated.View style={[styles.heart, { left: width / 2 - 20 }, heart]}><Heart color={palette.white} fill={palette.white} size={20} /></Animated.View>
      <Animated.Text style={[styles.thanks, thanks]}>Jazakum Allah khayran</Animated.Text>
    </>
  );
}

export function GuideDemo({ step, active, width }: { step: GuideStepKey; active: boolean; width: number }) {
  useScheme();
  const t = useLoop(active);
  const Body = { copy: CopyDemo, send: SendDemo, save: SaveDemo, upload: UploadDemo, name: NameDemo, counted: CountedDemo }[step];
  return <Demo t={t} width={width}><Body t={t} width={width} /></Demo>;
}

const styles = themedStyles(() => StyleSheet.create({
  frame: { backgroundColor: palette.paper, borderColor: palette.line, borderRadius: 20, borderWidth: 1, height: DEMO_HEIGHT, overflow: 'hidden' },
  layer: { left: 0, position: 'absolute', right: 0, textAlign: 'center', top: 0 },
  finger: { backgroundColor: palette.forest, borderColor: palette.white, borderRadius: 11, borderWidth: 2, boxShadow: '0 2px 6px rgba(20,40,28,0.35)', height: 22, left: 0, position: 'absolute', top: 0, width: 22 },
  ring: { backgroundColor: palette.forest, borderRadius: 22, height: 44, left: 0, position: 'absolute', top: 0, width: 44 },
  typedRow: { flexDirection: 'row' },
  row: { alignItems: 'center', backgroundColor: palette.white, borderColor: palette.line, borderRadius: 12, borderWidth: 1, flexDirection: 'row', height: 46, justifyContent: 'space-between', left: PAD, overflow: 'hidden', paddingHorizontal: 12, position: 'absolute', right: PAD },
  rowFlash: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, backgroundColor: palette.leaf },
  label: { color: palette.muted, fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  value: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  iconBox: { height: 22, width: 22 },
  iconLayer: { alignItems: 'center', height: 22, justifyContent: 'center', left: 0, position: 'absolute', top: 0, width: 22 },
  toast: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 15, flexDirection: 'row', gap: 5, height: 28, justifyContent: 'center', position: 'absolute', top: 174, width: 96 },
  toastText: { color: palette.white, fontSize: 12, fontWeight: '700' },
  bankBar: { alignItems: 'center', backgroundColor: palette.sky, flexDirection: 'row', gap: 6, height: 30, left: 0, paddingHorizontal: PAD, position: 'absolute', right: 0, top: 0 },
  bankBarText: { color: palette.muted, fontSize: 11, fontWeight: '600' },
  bankField: { alignItems: 'center', backgroundColor: palette.white, borderColor: palette.line, borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 10, height: 36, left: PAD, paddingHorizontal: 10, position: 'absolute', right: PAD },
  activeOutline: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, borderColor: palette.forest, borderRadius: 10, borderWidth: 1.5 },
  bankLabel: { color: palette.muted, fontSize: 11, fontWeight: '600', width: 70 },
  bankValue: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  sendButton: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 12, height: 32, justifyContent: 'center', left: PAD, position: 'absolute', right: PAD, top: 173 },
  sendLabel: { color: palette.white, fontSize: 13, fontWeight: '700' },
  sentRow: { alignItems: 'center', flexDirection: 'row', gap: 6, height: 32, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  saveScreen: { alignItems: 'center', gap: 6, left: 0, position: 'absolute', right: 0, top: 30 },
  bigCheck: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 30, height: 60, justifyContent: 'center', width: 60 },
  saveTitle: { ...display, color: palette.ink, fontSize: 19, marginTop: 6 },
  saveMeta: { color: palette.muted, fontSize: 13 },
  flash: { backgroundColor: '#FFFFFF' },
  thumb: { alignItems: 'center', backgroundColor: palette.white, borderColor: palette.forest, borderRadius: 10, borderWidth: 1.5, gap: 6, height: 104, justifyContent: 'center', position: 'absolute', top: 54, width: 76 },
  thumbLine: { backgroundColor: palette.leafDeep, borderRadius: 2, height: 4, width: 44 },
  thumbShort: { width: 28 },
  savedChip: { alignItems: 'center', backgroundColor: palette.leaf, borderRadius: 16, flexDirection: 'row', gap: 6, height: 30, left: PAD, paddingHorizontal: 12, position: 'absolute', top: 168 },
  savedText: { color: palette.forest, fontSize: 12, fontWeight: '700' },
  uploadButton: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 14, height: 44, justifyContent: 'center', left: PAD, paddingHorizontal: 10, position: 'absolute', right: PAD, top: 20 },
  uploadLabel: { color: palette.white, fontSize: 13, fontWeight: '700' },
  uploadBanner: { alignItems: 'center', backgroundColor: palette.leaf, borderColor: palette.leafDeep, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 8, height: 44, justifyContent: 'center', left: PAD, position: 'absolute', right: PAD, top: 20 },
  bannerText: { color: palette.forest, fontSize: 13, fontWeight: '700' },
  linkHint: { color: palette.forest, fontSize: 13, fontWeight: '600', left: 0, position: 'absolute', right: 0, textAlign: 'center', top: 76 },
  pickerSheet: { backgroundColor: palette.white, borderColor: palette.line, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, bottom: 0, height: 132, left: 0, paddingHorizontal: PAD, paddingTop: 10, position: 'absolute', right: 0 },
  sheetTitle: { color: palette.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  tiles: { flexDirection: 'row', gap: 8, marginTop: 8 },
  tile: { alignItems: 'center', backgroundColor: palette.leaf, borderRadius: 10, flex: 1, height: 70, justifyContent: 'center' },
  tilePicked: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, alignItems: 'flex-end', borderColor: palette.forest, borderRadius: 10, borderWidth: 2, padding: 4 },
  tileCheck: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 9, height: 18, justifyContent: 'center', width: 18 },
  noReceiptLink: { color: palette.forest, fontSize: 13, fontWeight: '700', left: 0, position: 'absolute', right: 0, textAlign: 'center', top: 14 },
  nameBlock: { left: PAD, position: 'absolute', right: PAD, top: 44 },
  input: { backgroundColor: palette.white, borderColor: palette.forest, borderRadius: 10, borderWidth: 1.5, height: 38, justifyContent: 'center', marginTop: 6, paddingHorizontal: 12 },
  inputText: { color: palette.ink, fontSize: 14, fontWeight: '600' },
  confirmButton: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 14, height: 42, justifyContent: 'center', left: PAD, position: 'absolute', right: PAD, top: 113 },
  reviewPill: { backgroundColor: palette.leaf, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6 },
  pillRow: { alignItems: 'center', left: 0, position: 'absolute', right: 0, top: 168 },
  reviewText: { color: palette.ink, fontSize: 12, fontWeight: '700' },
  caseRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', left: PAD, position: 'absolute', right: PAD, top: 16 },
  caseTitle: { ...display, color: palette.ink, flex: 1, fontSize: 17 },
  pillStack: { height: 26, width: 118 },
  statusPill: { alignItems: 'center', borderRadius: 13, flexDirection: 'row', gap: 4, height: 26, justifyContent: 'center', position: 'absolute', right: 0, top: 0, width: 118 },
  pillWait: { backgroundColor: palette.leaf },
  pillOk: { backgroundColor: palette.successBg },
  track: { backgroundColor: palette.leaf, borderRadius: 6, height: 12, left: PAD, overflow: 'hidden', position: 'absolute', top: 76 },
  fill: { backgroundColor: palette.forest, borderRadius: 6, bottom: 0, left: 0, position: 'absolute', top: 0 },
  amountRow: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', left: PAD, position: 'absolute', right: PAD, top: 98 },
  raised: { ...display, color: palette.ink, fontSize: 17 },
  goal: { color: palette.muted, fontSize: 12 },
  plusChip: { backgroundColor: palette.forest, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, position: 'absolute', top: 50 },
  plusText: { color: palette.white, fontSize: 12, fontWeight: '800' },
  heart: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 20, height: 40, justifyContent: 'center', position: 'absolute', top: 138, width: 40 },
  thanks: { ...display, color: palette.muted, fontSize: 13, left: 0, position: 'absolute', right: 0, textAlign: 'center', top: 184 },
}));
