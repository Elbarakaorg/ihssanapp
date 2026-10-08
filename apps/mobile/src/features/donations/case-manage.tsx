import { type Href, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackLink, Button, Field, Message } from '@/features/doctor/ui';
import { RemoteImage } from '@/features/doctor/doctor-image';
import { Loading } from '@/ui/loading';
import { Ornament, Page, PageHeading, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { palette, themedStyles, useScheme } from '@/ui/palette';
import { AudioPlayer, AudioRecorder, Reels } from './case-media';
import {
  CASE_BUCKET, type CaseDetail, addCaseVideoLink, deleteCaseAudio, deleteCasePhoto, deleteCaseVideo, getCase, pickAndAddCasePhoto, pickAndAddCaseVideo, updateCaseProfile,
} from './donations-api';

type Msg = { kind: 'error' | 'ok'; text: string } | null;

/** Lets a collector or the beneficiary edit the public profile of their case. */
export function CaseManage() {
  useScheme();
  const { caseId } = useLocalSearchParams<{ caseId: string }>();
  const [item, setItem] = useState<CaseDetail | null | undefined>(undefined);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [reelUrl, setReelUrl] = useState('');
  const [caption, setCaption] = useState('');

  const load = useCallback(() => {
    if (!caseId) return;
    getCase(caseId).then((c) => {
      setItem(c);
      if (c) { setTitle(c.title); setBio(c.bio ?? c.summary ?? ''); setCity(c.city ?? ''); }
    }).catch((e) => { setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Could not load.' }); setItem(null); });
  }, [caseId]);
  useEffect(load, [load]);

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true); setMsg(null);
    try { await work(); setMsg({ kind: 'ok', text: done }); load(); } catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Something went wrong.' }); } finally { setBusy(false); }
  };

  if (item === undefined) return <Page><Loading label="Loading" /></Page>;
  if (!item || !caseId) return <Page><BackLink href={'/collect' as Href} label="Your cases" /><Message kind="error">{msg?.text ?? 'This case is not available.'}</Message></Page>;
  if (!item.can_manage) return <Page><BackLink href={'/collect' as Href} label="Your cases" /><Message kind="error">You cannot edit this case.</Message></Page>;

  return (
    <Page>
      <BackLink href={`/collect/${caseId}` as Href} label="Back" />
      <PageHeading eyebrow="Public profile" title="Edit the case page">Changes show on the public page straight away. Please keep the story truthful and respectful.</PageHeading>
      {msg ? <Message kind={msg.kind}>{msg.text}</Message> : null}
      <Ornament />

      <SectionHeading title="Story" />
      <Field label="Title" value={title} onChangeText={setTitle} maxLength={120} />
      <Field label="City" value={city} onChangeText={setCity} maxLength={80} />
      <Field label="Story (20 to 4000 characters)" value={bio} onChangeText={setBio} maxLength={4000} multiline numberOfLines={8} />
      <Button label="Save story" busy={busy} onPress={() => void run(() => updateCaseProfile(caseId, { title: title.trim(), city: city.trim(), bio: bio.trim() }), 'Saved.')} />

      <SectionHeading title="Featured photo" />
      <RemoteImage bucket={CASE_BUCKET} path={item.photo_path} placeholderSize={32} style={styles.featured} />
      <Button tone="secondary" label={item.photo_path ? 'Change featured photo' : 'Choose featured photo'} disabled={busy} onPress={() => void run(() => pickAndAddCasePhoto(caseId, '', true), 'Featured photo updated.')} />

      <SectionHeading title="Gallery" />
      <View style={styles.grid}>
        {item.media.map((photo) => (
          <View key={photo.id} style={styles.cell}>
            <GalleryThumb path={photo.path} />
            <Button tone="danger" label="Remove" disabled={busy} onPress={() => void run(() => deleteCasePhoto(photo.id), 'Photo removed.')} />
          </View>
        ))}
      </View>
      <Button tone="secondary" label="Add a photo" disabled={busy} onPress={() => void run(() => pickAndAddCasePhoto(caseId, '', false), 'Photo added.')} />

      <SectionHeading title="Instagram reels and videos" />
      <Text style={styles.hint}>Paste a public Instagram reel or post link. Embeds only play for public accounts that allow embedding; otherwise upload the video (MP4, MOV or WebM, up to 50 MB).</Text>
      <Reels videos={item.videos} />
      {item.videos.map((video) => <Button key={video.id} tone="danger" label={`Remove ${video.kind === 'instagram' ? 'reel' : 'video'}${video.caption ? `: ${video.caption}` : ''}`} disabled={busy} onPress={() => void run(() => deleteCaseVideo(video.id), 'Removed.')} />)}
      <View style={[uiStyles.card, styles.card]}>
        <Field label="Instagram link" value={reelUrl} onChangeText={setReelUrl} autoCapitalize="none" keyboardType="url" placeholder="https://www.instagram.com/reel/…" />
        <Field label="Caption (optional)" value={caption} onChangeText={setCaption} maxLength={200} />
        <Button label="Add Instagram link" busy={busy} onPress={() => void run(async () => { await addCaseVideoLink(caseId, reelUrl, caption); setReelUrl(''); setCaption(''); }, 'Reel added.')} />
        <Button tone="secondary" label="Upload a video instead" disabled={busy} onPress={() => void run(() => pickAndAddCaseVideo(caseId, caption), 'Video added.')} />
      </View>

      <SectionHeading title="Audio messages" />
      <AudioPlayer clips={item.audio} />
      {item.audio.map((clip) => <Button key={clip.id} tone="danger" label={`Remove ${clip.title || 'voice message'}`} disabled={busy} onPress={() => void run(() => deleteCaseAudio(clip.id), 'Removed.')} />)}
      <AudioRecorder caseId={caseId} onAdded={load} />
    </Page>
  );
}

function GalleryThumb({ path }: { path: string }) {
  return <RemoteImage bucket={CASE_BUCKET} path={path} placeholderSize={20} style={styles.thumb} />;
}

const styles = themedStyles(() => StyleSheet.create({
  featured: { borderRadius: 14, height: 260, overflow: 'hidden', width: '100%' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { gap: 6, width: 150 },
  thumb: { borderRadius: 10, height: 120, overflow: 'hidden', width: 150 },
  hint: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  card: { gap: 6, marginTop: 10, padding: 14 },
}));
