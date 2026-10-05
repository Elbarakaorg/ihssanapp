import AsyncStorage from '@react-native-async-storage/async-storage';
import { BarChart } from 'react-native-gifted-charts';
import { ArrowRight, Flame, Footprints, Map, Minus, Pause, Play, Plus, ShieldCheck, Timer } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Pedometer } from 'expo-sensors';

import { estimateActivity } from '@/features/home/activity-estimates';
import { display, palette, themedStyles, useScheme } from '@/ui/palette';
import { Loading } from '@/ui/loading';

type DayCount = { label: string; steps: number };
type TrackerStatus = 'checking' | 'permission' | 'ready' | 'unavailable' | 'error';
type Props = { detailed?: boolean; onOpen?: () => void };
const goalStorageKey = 'ihssan.activity.step-goal';
const defaultStepGoal = 8000;

export default function ActivityTracker({ detailed = false, onOpen }: Props) {
  useScheme();
  const [status, setStatus] = useState<TrackerStatus>('checking');
  const [steps, setSteps] = useState(0);
  const [week, setWeek] = useState<DayCount[]>([]);
  const [error, setError] = useState('');
  const [stepGoal, setStepGoal] = useState(defaultStepGoal);
  const [goalLoaded, setGoalLoaded] = useState(false);
  const [walking, setWalking] = useState(false);
  const [walkSteps, setWalkSteps] = useState(0);
  const [walkSeconds, setWalkSeconds] = useState(0);
  const walkSubscription = useRef<{ remove(): void } | null>(null);

  useEffect(() => {
    void AsyncStorage.getItem(goalStorageKey).then((stored) => {
      const parsed = Number(stored);
      if (Number.isFinite(parsed) && parsed >= 1000 && parsed <= 50000) setStepGoal(parsed);
      setGoalLoaded(true);
    }).catch(() => setGoalLoaded(true));
  }, []);

  useEffect(() => {
    if (goalLoaded) void AsyncStorage.setItem(goalStorageKey, String(stepGoal));
  }, [goalLoaded, stepGoal]);

  useEffect(() => {
    if (!walking) return undefined;
    const startedAt = Date.now();
    const timer = setInterval(() => setWalkSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [walking]);

  useEffect(() => () => walkSubscription.current?.remove(), []);

  useEffect(() => {
    let active = true;
    if (Platform.OS === 'web') {
      setStatus('unavailable');
      return () => { active = false; };
    }

    void Pedometer.isAvailableAsync().then(async (available) => {
      if (!active) return;
      if (!available) {
        setStatus('unavailable');
        return;
      }
      const permission = await Pedometer.getPermissionsAsync();
      if (active) setStatus(permission.granted ? 'ready' : 'permission');
    }).catch(() => {
      if (active) setStatus('unavailable');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    let active = true;
    let subscription: { remove(): void } | null = null;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const loadHistory = async () => {
      if (Platform.OS !== 'ios') return;
      const days = await Promise.all(Array.from({ length: 7 }, async (_, index) => {
        const day = new Date(todayStart);
        day.setDate(todayStart.getDate() - (6 - index));
        const end = new Date(day);
        end.setDate(day.getDate() + 1);
        const result = await Pedometer.getStepCountAsync(day, end).catch(() => null);
        return { label: day.toLocaleDateString(undefined, { weekday: 'short' }), steps: result?.steps ?? 0 };
      }));
      if (active) {
        setWeek(days);
        setSteps(days[days.length - 1]?.steps ?? 0);
      }
    };

    if (Platform.OS === 'ios') void loadHistory();
    subscription = Pedometer.watchStepCount((result) => {
      if (!active) return;
      if (Platform.OS === 'ios') void Pedometer.getStepCountAsync(todayStart, new Date()).then((today) => {
        if (!active) return;
        setSteps(today.steps);
        setWeek((current) => current.map((day, index) => index === 6 ? { ...day, steps: today.steps } : day));
      }).catch(() => undefined);
      else setSteps(result.steps);
    });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [status]);

  const enableTracking = async () => {
    setError('');
    try {
      const permission = await Pedometer.requestPermissionsAsync();
      setStatus(permission.granted ? 'ready' : 'permission');
      if (!permission.granted) setError('Motion access was not granted. You can enable it in your device settings.');
    } catch (permissionError) {
      setError(permissionError instanceof Error ? permissionError.message : 'Could not request motion access.');
    }
  };

  const startWalk = async () => {
    setError('');
    try {
      if (status !== 'ready') {
        const permission = await Pedometer.requestPermissionsAsync();
        if (!permission.granted) {
          setStatus('permission');
          setError('Motion access is needed to track a walk.');
          return;
        }
        setStatus('ready');
      }
      setWalkSteps(0);
      setWalkSeconds(0);
      walkSubscription.current?.remove();
      walkSubscription.current = Pedometer.watchStepCount((result) => setWalkSteps(result.steps));
      setWalking(true);
    } catch (walkError) {
      setError(walkError instanceof Error ? walkError.message : 'Could not start a walking session.');
    }
  };

  const stopWalk = () => {
    walkSubscription.current?.remove();
    walkSubscription.current = null;
    setWalking(false);
  };

  const estimates = estimateActivity(steps);
  const progress = Math.min(steps / stepGoal, 1);
  const maxDay = Math.max(stepGoal, ...week.map((day) => day.steps));

  const walkMinutes = Math.floor(walkSeconds / 60);
  const walkClock = `${String(walkMinutes).padStart(2, '0')}:${String(walkSeconds % 60).padStart(2, '0')}`;

  return (
    <View style={[styles.panel, detailed && styles.detailedPanel]}>
      <Pressable accessibilityHint={onOpen ? 'Opens your full activity dashboard' : undefined} accessibilityRole={onOpen ? 'button' : undefined} disabled={!onOpen} onPress={onOpen} style={styles.panelHeader}>
        <View><Text style={styles.eyebrow}>Daily movement</Text><Text style={[styles.title, detailed && styles.detailedTitle]}>Steps</Text></View>
        <View style={styles.headerActions}>
          {onOpen ? <ArrowRight color={palette.forest} size={19} /> : null}
          <View style={styles.headerIcon}><Footprints color={palette.forest} size={19} /></View>
        </View>
      </Pressable>
      {status === 'checking' ? <Loading label="Checking device pedometer" inline state="searching" /> : null}
      {status === 'permission' ? <View style={styles.permissionRow}><Text style={styles.stateText}>Allow motion access to count steps from your device.</Text><Pressable accessibilityRole="button" onPress={() => void enableTracking()} style={styles.enableButton}><Text style={styles.enableLabel}>Enable</Text></Pressable></View> : null}
      {status === 'unavailable' ? <Text style={styles.stateText}>Step counting is available on supported iOS and Android devices, not in this web preview.</Text> : null}
      {status === 'ready' ? <>
        <Pressable accessibilityRole={onOpen ? 'button' : undefined} disabled={!onOpen} onPress={onOpen} style={[styles.progressRow, detailed && styles.detailedProgressRow]}>
          <View style={styles.ringWrap}><Svg height="112" viewBox="0 0 112 112" width="112"><Circle cx="56" cy="56" fill="none" r="46" stroke="#E3EAE2" strokeWidth="11" /><Circle cx="56" cy="56" fill="none" r="46" rotation="-90" stroke={palette.forest} strokeDasharray={`${2 * Math.PI * 46}`} strokeDashoffset={`${2 * Math.PI * 46 * (1 - progress)}`} strokeLinecap="round" strokeWidth="11" /></Svg><View style={styles.ringCenter}><Footprints color={palette.forest} size={18} /><Text style={styles.ringGoal}>{Math.round(progress * 100)}%</Text></View></View>
          <View style={styles.stepCountBlock}><Text style={styles.stepCount}>{steps.toLocaleString()}</Text><Text style={styles.stepGoal}>{Platform.OS === 'android' ? 'live steps this session' : `of ${stepGoal.toLocaleString()} steps`}</Text><Text style={styles.goalCaption}>{Platform.OS === 'android' ? 'Foreground count' : steps >= stepGoal ? 'Daily goal reached' : `${(stepGoal - steps).toLocaleString()} to goal`}</Text></View>
          {onOpen ? <ArrowRight color={palette.muted} size={18} /> : null}
        </Pressable>
        {detailed ? (
          <View style={styles.goalEditor}>
            <Text style={styles.goalEditorLabel}>Daily step goal</Text>
            <View style={styles.goalControls}>
              <Pressable accessibilityLabel="Decrease step goal by 500" accessibilityRole="button" disabled={stepGoal <= 1000} onPress={() => setStepGoal((goal) => Math.max(1000, goal - 500))} style={styles.goalButton}><Minus color={palette.forest} size={17} /></Pressable>
              <Text style={styles.goalValue}>{stepGoal.toLocaleString()}</Text>
              <Pressable accessibilityLabel="Increase step goal by 500" accessibilityRole="button" disabled={stepGoal >= 50000} onPress={() => setStepGoal((goal) => Math.min(50000, goal + 500))} style={styles.goalButton}><Plus color={palette.forest} size={17} /></Pressable>
            </View>
          </View>
        ) : null}
        <View style={styles.estimateRow}>
          <View style={styles.estimateItem}><Map color="#417A68" size={17} /><View><Text style={styles.estimateValue}>{estimates.distanceKm.toFixed(1)} km</Text><Text style={styles.estimateLabel}>Est. distance</Text></View></View>
          <View style={styles.estimateDivider} />
          <View style={styles.estimateItem}><Flame color={palette.coral} size={17} /><View><Text style={styles.estimateValue}>{estimates.activeCalories.toLocaleString()} kcal</Text><Text style={styles.estimateLabel}>Est. active calories</Text></View></View>
        </View>
        {Platform.OS === 'ios' && week.length ? detailed ? (
          <View style={styles.weekChart}>
            <Text style={styles.chartTitle}>Your week</Text>
            <BarChart
              barBorderRadius={6}
              barWidth={22}
              data={week.map((day, index) => ({ value: day.steps, label: day.label, frontColor: index === week.length - 1 ? palette.forest : '#9FC6B0' }))}
              disableScroll
              hideRules={false}
              initialSpacing={14}
              isAnimated
              noOfSections={4}
              rulesColor={palette.line}
              rulesThickness={1}
              xAxisColor={palette.line}
              xAxisLabelTextStyle={styles.dayLabel}
              xAxisThickness={1}
              yAxisLabelWidth={32}
              yAxisTextStyle={styles.axisLabel}
              yAxisThickness={0}
            />
            <Text style={styles.chartCaption}>Steps by day · previous six days and today</Text>
          </View>
        ) : <View style={styles.weekChart}><View style={styles.weekBars}>{week.map((day, index) => <View key={`${day.label}-${index}`} style={styles.dayColumn}><View style={styles.barTrack}><View style={[styles.bar, { height: `${Math.max((day.steps / maxDay) * 100, day.steps ? 5 : 0)}%` }, index === 6 && styles.todayBar]} /></View><Text style={styles.dayLabel}>{day.label}</Text></View>)}</View><Text style={styles.chartCaption}>Steps per day · last 7 days</Text></View> : null}
        {detailed && Platform.OS !== 'ios' ? <View style={styles.historyNote}><Text style={styles.historyNoteText}>Daily history is not available from this device yet. Live steps update while the app is open.</Text></View> : null}
        {detailed ? (
          <View style={styles.walkCard}>
            <View style={styles.walkHeading}><View style={styles.walkIcon}><Footprints color={palette.forest} size={18} /></View><View style={styles.walkCopy}><Text style={styles.walkTitle}>{walking ? 'Walk in progress' : 'Walking session'}</Text><Text style={styles.walkSubtitle}>{walking ? 'Keep moving, your session is being tracked' : 'Start a focused walk and track its steps'}</Text></View></View>
            {walking ? <View style={styles.walkStats}><View style={styles.walkStat}><Text style={styles.walkStatValue}>{walkSteps.toLocaleString()}</Text><Text style={styles.walkStatLabel}>steps</Text></View><View style={styles.walkStat}><Text style={styles.walkStatValue}>{walkClock}</Text><Text style={styles.walkStatLabel}>duration</Text></View><View style={styles.walkStat}><Text style={styles.walkStatValue}>{estimateActivity(walkSteps).distanceKm.toFixed(2)}</Text><Text style={styles.walkStatLabel}>est. km</Text></View></View> : null}
            <Pressable accessibilityRole="button" onPress={() => walking ? stopWalk() : void startWalk()} style={[styles.walkButton, walking && styles.walkButtonActive]}>
              {walking ? <Pause color={palette.white} size={17} /> : <Play color={palette.white} size={17} fill={palette.white} />}
              <Text style={styles.walkButtonLabel}>{walking ? 'Finish walk' : 'Start a walk'}</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.privacyLine}><ShieldCheck color={palette.forest} size={14} /><Text style={styles.privacyText}>Step counts stay on this device. Distance and calorie values are estimates.</Text></View>
        {Platform.OS === 'android' ? <Text style={styles.platformNote}>Counts start when tracking begins and update while Ihssan is open; steps while the app is closed are not included. Background history requires Health Connect integration.</Text> : null}
      </> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  panel: { backgroundColor: palette.white, borderColor: palette.line, borderCurve: 'continuous', borderRadius: 18, borderWidth: 1, marginBottom: 25, padding: 18 },
  detailedPanel: { padding: 20 },
  panelHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  eyebrow: { color: palette.coral, fontSize: 12, fontWeight: '600' },
  title: { ...display, color: palette.ink, fontSize: 24, marginTop: 3 },
  detailedTitle: { fontSize: 26 },
  headerIcon: { alignItems: 'center', backgroundColor: palette.leaf, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  stateRow: { alignItems: 'center', flexDirection: 'row', gap: 9, minHeight: 76 },
  stateText: { color: palette.muted, flex: 1, fontSize: 12, lineHeight: 18 },
  permissionRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 14 },
  enableButton: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 10, minHeight: 42, justifyContent: 'center', paddingHorizontal: 14 },
  enableLabel: { color: palette.white, fontSize: 12, fontWeight: '700' },
  progressRow: { alignItems: 'center', flexDirection: 'row', gap: 18, justifyContent: 'center', paddingVertical: 12 },
  detailedProgressRow: { justifyContent: 'space-around', paddingVertical: 20 },
  ringWrap: { height: 112, position: 'relative', width: 112 },
  ringCenter: { alignItems: 'center', gap: 2, justifyContent: 'center', ...StyleSheet.absoluteFill },
  ringGoal: { color: palette.forest, fontSize: 12, fontWeight: '700' },
  stepCountBlock: { minWidth: 140 },
  stepCount: { color: palette.ink, fontSize: 31, fontWeight: '700' },
  stepGoal: { color: palette.muted, fontSize: 11, marginTop: 1 },
  goalCaption: { color: palette.forest, fontSize: 11, fontWeight: '700', marginTop: 8 },
  goalEditor: { alignItems: 'center', borderBottomColor: palette.line, borderBottomWidth: 1, borderTopColor: palette.line, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 58, marginBottom: 16 },
  goalEditorLabel: { color: palette.ink, fontSize: 13, fontWeight: '600' },
  goalControls: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  goalButton: { alignItems: 'center', backgroundColor: palette.leaf, borderRadius: 17, height: 34, justifyContent: 'center', width: 34 },
  goalValue: { color: palette.ink, fontSize: 14, fontWeight: '700', minWidth: 58, textAlign: 'center' },
  estimateRow: { alignItems: 'center', backgroundColor: palette.paper, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-around', minHeight: 64, paddingHorizontal: 8 },
  estimateItem: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center' },
  estimateDivider: { backgroundColor: palette.line, height: 30, width: 1 },
  estimateValue: { color: palette.ink, fontSize: 13, fontWeight: '700' },
  estimateLabel: { color: palette.muted, fontSize: 9, marginTop: 2 },
  weekChart: { marginTop: 20 },
  chartTitle: { color: palette.ink, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  axisLabel: { color: palette.muted, fontSize: 9 },
  weekBars: { alignItems: 'flex-end', flexDirection: 'row', gap: 8, height: 79, justifyContent: 'space-around' },
  dayColumn: { alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' },
  barTrack: { backgroundColor: '#E8EEE7', borderRadius: 4, height: 62, justifyContent: 'flex-end', overflow: 'hidden', width: '68%' },
  bar: { backgroundColor: '#8EB49F', borderRadius: 4, minHeight: 0, width: '100%' },
  todayBar: { backgroundColor: palette.forest },
  dayLabel: { color: palette.muted, fontSize: 9, marginTop: 5 },
  chartCaption: { color: palette.muted, fontSize: 9, marginTop: 5, textAlign: 'center' },
  historyNote: { backgroundColor: palette.sky, borderRadius: 10, marginTop: 16, padding: 12 },
  historyNoteText: { color: palette.ink, fontSize: 12, lineHeight: 18 },
  walkCard: { backgroundColor: '#F1F6F2', borderRadius: 14, marginTop: 20, padding: 15 },
  walkHeading: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  walkIcon: { alignItems: 'center', backgroundColor: palette.leaf, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  walkCopy: { flex: 1 },
  walkTitle: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  walkSubtitle: { color: palette.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  walkStats: { borderBottomColor: palette.line, borderBottomWidth: 1, borderTopColor: palette.line, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-around', marginTop: 14, paddingVertical: 12 },
  walkStat: { alignItems: 'center', flex: 1 },
  walkStatValue: { color: palette.ink, fontSize: 17, fontWeight: '700' },
  walkStatLabel: { color: palette.muted, fontSize: 10, marginTop: 3 },
  walkButton: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 11, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 14, minHeight: 46 },
  walkButtonActive: { backgroundColor: palette.coral },
  walkButtonLabel: { color: palette.white, fontSize: 13, fontWeight: '700' },
  disabledButton: { opacity: 0.5 },
  privacyLine: { alignItems: 'center', flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 12 },
  privacyText: { color: palette.muted, fontSize: 9 },
  platformNote: { color: palette.muted, fontSize: 9, lineHeight: 14, marginTop: 6, textAlign: 'center' },
  error: { color: palette.dangerText, fontSize: 11, lineHeight: 16, marginTop: 8 },
}));