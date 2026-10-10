import { type Href, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackLink, Button, Field, Message } from '@/features/doctor/ui';
import { RemoteImage } from '@/features/doctor/doctor-image';
import { Loading } from '@/ui/loading';
import { Ornament, Page, PageHeading, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { palette, themedStyles, useScheme } from '@/ui/palette';
import { useLocale } from '@/platform/locale/locale-provider';
import { donationCopy } from '@/platform/locale/donations';
import { AudioPlayer, AudioRecorder, Reels } from './case-media';
import {
  CASE_BUCKET, type CaseDetail, addCaseVideoLink, deleteCaseAudio, deleteCasePhoto, deleteCaseVideo, getCase, pickAndAddCasePhoto, pickAndAddCaseVideo, updateCaseProfile,
} from './donations-api';

type Msg = { kind: 'error' | 'ok'; text: string } | null;

/** Lets a collector or the beneficiary edit the public profile of their case. */
export function CaseManage() {
  useScheme();
  const { locale } = useLocale();
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
    }).catch((e) => { setMsg({ kind: 'error', text: e instanceof Error ? e.message : donationCopy(locale, 'collect.loadError') }); setItem(null); });
  }, [caseId, locale]);
  useEffect(load, [load]);

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true); setMsg(null);
    try { await work(); setMsg({ kind: 'ok', text: done }); load(); } catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : donationCopy(locale, 'collect.saveError') }); } finally { setBusy(false); }
  };

  if (item === undefined) return <Page direction={locale === 'ar' ? 'rtl' : 'ltr'}><Loading label={donationCopy(locale, 'manage.loading')} /></Page>;
  if (!item || !caseId) return <Page direction={locale === 'ar' ? 'rtl' : 'ltr'}><BackLink direction={locale === 'ar' ? 'rtl' : 'ltr'} href={'/collect' as Href} label={donationCopy(locale, 'manage.yourCases')} /><Message kind="error">{msg?.text ?? donationCopy(locale, 'manage.unavailable')}</Message></Page>;
  if (!item.can_manage) return <Page direction={locale === 'ar' ? 'rtl' : 'ltr'}><BackLink direction={locale === 'ar' ? 'rtl' : 'ltr'} href={'/collect' as Href} label={donationCopy(locale, 'manage.yourCases')} /><Message kind="error">{donationCopy(locale, 'manage.noPermission')}</Message></Page>;

  return (
    <Page direction={locale === 'ar' ? 'rtl' : 'ltr'}>
      <BackLink direction={locale === 'ar' ? 'rtl' : 'ltr'} href={`/collect/${caseId}` as Href} label={donationCopy(locale, 'manage.back')} />
      <PageHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} eyebrow={donationCopy(locale, 'manage.eyebrow')} title={donationCopy(locale, 'manage.title')}>{donationCopy(locale, 'manage.description')}</PageHeading>
      {msg ? <Message kind={msg.kind}>{msg.text}</Message> : null}
      <Ornament />

      <SectionHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} title={donationCopy(locale, 'manage.storySection')} />
      <Field direction={locale === 'ar' ? 'rtl' : 'ltr'} label={donationCopy(locale, 'manage.titleField')} value={title} onChangeText={setTitle} maxLength={120} />
      <Field direction={locale === 'ar' ? 'rtl' : 'ltr'} label={donationCopy(locale, 'manage.cityField')} value={city} onChangeText={setCity} maxLength={80} />
      <Field direction={locale === 'ar' ? 'rtl' : 'ltr'} label={donationCopy(locale, 'manage.storyField')} value={bio} onChangeText={setBio} maxLength={4000} multiline numberOfLines={8} />
      <Button label={donationCopy(locale, 'manage.saveStory')} busy={busy} onPress={() => void run(() => updateCaseProfile(caseId, { title: title.trim(), city: city.trim(), bio: bio.trim() }), donationCopy(locale, 'manage.saved'))} />

      <SectionHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} title={donationCopy(locale, 'manage.featuredPhoto')} />
      <RemoteImage bucket={CASE_BUCKET} path={item.photo_path} placeholderSize={32} style={styles.featured} />
      <Button tone="secondary" label={donationCopy(locale, item.photo_path ? 'manage.changeFeatured' : 'manage.chooseFeatured')} disabled={busy} onPress={() => void run(() => pickAndAddCasePhoto(caseId, '', true), donationCopy(locale, 'manage.featuredUpdated'))} />

      <SectionHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} title={donationCopy(locale, 'manage.gallery')} />
      <View style={styles.grid}>
        {item.media.map((photo) => (
          <View key={photo.id} style={styles.cell}>
            <GalleryThumb path={photo.path} />
            <Button tone="danger" label={donationCopy(locale, 'manage.remove')} disabled={busy} onPress={() => void run(() => deleteCasePhoto(photo.id), donationCopy(locale, 'manage.photoRemoved'))} />
          </View>
        ))}
      </View>
      <Button tone="secondary" label={donationCopy(locale, 'manage.addPhoto')} disabled={busy} onPress={() => void run(() => pickAndAddCasePhoto(caseId, '', false), donationCopy(locale, 'manage.photoAdded'))} />

      <SectionHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} title={donationCopy(locale, 'manage.videos')} />
      <Text style={styles.hint}>{donationCopy(locale, 'manage.videoInstructions')}</Text>
      <Reels videos={item.videos} />
      {item.videos.map((video) => <Button key={video.id} tone="danger" label={donationCopy(locale, video.kind === 'instagram' ? (video.caption ? 'manage.removeReel' : 'manage.removeReelNoCaption') : (video.caption ? 'manage.removeVideo' : 'manage.removeVideoNoCaption'), video.caption ? { caption: video.caption } : undefined)} disabled={busy} onPress={() => void run(() => deleteCaseVideo(video.id), donationCopy(locale, 'manage.removed'))} />)}
      <View style={[uiStyles.card, styles.card]}>
        <Field direction={locale === 'ar' ? 'rtl' : 'ltr'} inputDirection="ltr" label={donationCopy(locale, 'manage.instagramLink')} value={reelUrl} onChangeText={setReelUrl} autoCapitalize="none" keyboardType="url" placeholder="https://www.instagram.com/reel/…" />
        <Field direction={locale === 'ar' ? 'rtl' : 'ltr'} label={donationCopy(locale, 'manage.captionOptional')} value={caption} onChangeText={setCaption} maxLength={200} />
        <Button label={donationCopy(locale, 'manage.addInstagram')} busy={busy} onPress={() => void run(async () => { await addCaseVideoLink(caseId, reelUrl, caption); setReelUrl(''); setCaption(''); }, donationCopy(locale, 'manage.reelAdded'))} />
        <Button tone="secondary" label={donationCopy(locale, 'manage.uploadVideo')} disabled={busy} onPress={() => void run(() => pickAndAddCaseVideo(caseId, caption), donationCopy(locale, 'manage.videoAdded'))} />
      </View>

      <SectionHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} title={donationCopy(locale, 'manage.audio')} />
      <AudioPlayer clips={item.audio} />
      {item.audio.map((clip) => <Button key={clip.id} tone="danger" label={donationCopy(locale, clip.title ? 'manage.removeAudio' : 'manage.removeAudioUntitled', clip.title ? { title: clip.title } : undefined)} disabled={busy} onPress={() => void run(() => deleteCaseAudio(clip.id), donationCopy(locale, 'manage.removed'))} />)}
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
