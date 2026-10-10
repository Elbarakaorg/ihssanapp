import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Pause, Play } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { imageUrl } from '@/features/doctor/doctor-api';
import { Button, Message } from '@/features/doctor/ui';
import { display, palette, themedStyles, useScheme } from '@/ui/palette';
import { addCaseAudioFromUri, type CaseDetail } from './donations-api';
import { instagramEmbedUrl } from './donations-logic';

type Reel = CaseDetail['videos'][number];

function useMediaUrl(bucket: string, path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (path) void imageUrl(bucket, path).then(setUrl).catch(() => undefined);
  }, [bucket, path]);
  return url;
}

function InstagramReel({ url }: { url: string }) {
  const embed = instagramEmbedUrl(url);
  if (!embed) return null;
  if (Platform.OS === 'web') {
    return (
      <iframe allowFullScreen loading="lazy" referrerPolicy="no-referrer" src={embed} style={{ border: 0, borderRadius: 14, height: '100%', width: '100%' }} title="Instagram reel" />
    );
  }
  return (
    <View style={styles.reel}>
      <WebView originWhitelist={['https://www.instagram.com']} source={{ uri: embed }} javaScriptEnabled setSupportMultipleWindows={false} onShouldStartLoadWithRequest={(request) => request.url.startsWith('https://www.instagram.com/')} />
    </View>
  );
}

function UploadedVideo({ path }: { path: string }) {
  const url = useMediaUrl('case-videos', path);
  // Phone browsers load no frame until play; the #t fragment makes them paint the first one.
  const player = useVideoPlayer(url ? (Platform.OS === 'web' ? `${url}#t=0.001` : url) : null);
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const subscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay' && player.currentTime === 0) player.currentTime = 0.05;
    });
    return () => subscription.remove();
  }, [player]);
  if (!url) return <View style={styles.video} />;
  return <VideoView contentFit="contain" nativeControls player={player} surfaceType={Platform.OS === 'android' ? 'textureView' : undefined} style={styles.video} />;
}

export function Reels({ videos }: { videos: Reel[] }) {
  useScheme();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(Math.round(width * 0.72), 280);
  return (
    <ScrollView horizontal decelerationRate="fast" snapToInterval={cardWidth + 12} snapToAlignment="start" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel}>
      {videos.map((video) => (
        <View key={video.id} style={{ width: cardWidth }}>
          <View style={styles.reelCard}>
            {video.kind === 'instagram' && video.url ? <InstagramReel url={video.url} /> : video.path ? <UploadedVideo path={video.path} /> : null}
          </View>
          {video.caption ? <Text numberOfLines={2} style={styles.caption}>{video.caption}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

function formatTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function AudioClip({ path, title }: { path: string; title: string | null }) {
  const url = useMediaUrl('case-audio', path);
  const player = useAudioPlayer(url ?? null);
  const status = useAudioPlayerStatus(player);
  const toggle = () => { if (status.playing) player.pause(); else { if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration)) void player.seekTo(0); player.play(); } };
  return (
    <View style={styles.audio}>
      <Pressable accessibilityLabel={status.playing ? 'Pause' : 'Play'} accessibilityRole="button" disabled={!url} onPress={toggle} style={styles.playButton}>
        {status.playing ? <Pause color={palette.white} size={18} /> : <Play color={palette.white} size={18} />}
      </Pressable>
      <View style={styles.flex}>
        <Text style={styles.audioTitle} numberOfLines={1}>{title || 'Voice message'}</Text>
        <Text style={styles.caption}>{formatTime(status.currentTime)} / {formatTime(status.duration)}</Text>
      </View>
    </View>
  );
}

/** Renders nothing when there are no recordings. */
export function AudioPlayer({ clips }: { clips: CaseDetail['audio'] }) {
  useScheme();
  if (!clips.length) return null;
  return <View style={styles.stack}>{clips.map((clip) => <AudioClip key={clip.id} path={clip.path} title={clip.title} />)}</View>;
}

/** Records a voice message and uploads it to the case. */
export function AudioRecorder({ caseId, onAdded }: { caseId: string; onAdded: () => void }) {
  useScheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  const start = async () => {
    setMessage(null);
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) { setMessage({ kind: 'error', text: 'Microphone permission is needed to record.' }); return; }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch {
      setMessage({ kind: 'error', text: 'Could not start recording on this device.' });
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      await recorder.stop();
      setRecording(false);
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      if (!uri) throw new Error('Nothing was recorded.');
      const seconds = recorder.getStatus().durationMillis / 1000;
      await addCaseAudioFromUri(caseId, uri, Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4', title, seconds);
      setTitle('');
      setMessage({ kind: 'ok', text: 'Recording added to the profile.' });
      onAdded();
    } catch (e) {
      setRecording(false);
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Could not save this recording.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.stack}>
      {message ? <Message kind={message.kind}>{message.text}</Message> : null}
      <Text style={styles.hint}>Record a short message (up to 10 MB). It appears on the case page once saved.</Text>
      <Button
        busy={busy}
        label={recording ? 'Stop and save' : 'Record a voice message'}
        onPress={() => void (recording ? stop() : start())}
      />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: 12 },
  carousel: { gap: 12, paddingRight: 16 },
  reelCard: { aspectRatio: 9 / 16, backgroundColor: palette.ink, borderColor: palette.line, borderRadius: 16, borderWidth: 1, overflow: 'hidden', width: '100%' },
  item: { gap: 6 },
  reel: { height: '100%', width: '100%' },
  video: { backgroundColor: palette.ink, height: '100%', width: '100%' },
  caption: { color: palette.muted, fontSize: 12, lineHeight: 17 },
  hint: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  audio: { alignItems: 'center', backgroundColor: palette.leaf, borderRadius: 14, flexDirection: 'row', gap: 12, padding: 12 },
  audioTitle: { ...display, color: palette.ink, fontSize: 16 },
  playButton: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
}));
