import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { Mail, MapPin, Phone, Share2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { SocialLinks } from '@/features/doctor/doctor-engagement';
import { RemoteImage } from '@/features/doctor/doctor-image';
import { BackLink, Button, Chip, Field, Message } from '@/features/doctor/ui';
import { imageUrl } from '@/features/doctor/doctor-api';
import { Loading } from '@/ui/loading';
import { Ornament, Page, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { display, palette, themedStyles, useScheme } from '@/ui/palette';
import { AudioPlayer, Reels } from './case-media';
import { CASE_BUCKET, type CaseDetail, type Wish, type WallEntry, createPledge, getCase, listWall, listWishes, postWish, shareCase } from './donations-api';
import { ACCOUNT_RECEIPT_NOTICE, formatMad, parseAmount, suggestedAmounts, validateAmount } from './donations-logic';
import { Progress, UrgentBadge } from './donations-ui';

function GalleryImage({ path, caption }: { path: string; caption: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { void imageUrl(CASE_BUCKET, path).then(setUrl).catch(() => undefined); }, [path]);
  return (
    <View style={styles.galleryItem}>
      {url ? <Image accessibilityIgnoresInvertColors accessibilityLabel={caption ?? 'Case photo'} source={{ uri: url }} style={styles.galleryImage} resizeMode="cover" /> : <View style={styles.galleryImage} />}
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

export default function CaseScreen() {
  useScheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<CaseDetail | null | undefined>(undefined);
  const [wall, setWall] = useState<WallEntry[]>([]);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [donating, setDonating] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setError('');
    getCase(id).then((found) => {
      setItem(found);
      if (found) {
        listWall(found.id).then(setWall).catch(() => undefined);
        listWishes(found.id).then(setWishes).catch(() => undefined);
      }
    }).catch((e) => { setError(e instanceof Error ? e.message : 'Could not load this case.'); setItem(null); });
  }, [id]);
  useEffect(load, [load]);

  if (item === undefined) return <Page><Loading label="Loading this case" /></Page>;
  if (!item) return <Page><BackLink href="/give" label="Giving" /><Message kind="error">{error || 'This case is not available.'}</Message></Page>;

  const open = item.status === 'published';
  const remaining = Math.max(item.goal_mad - item.raised_mad, 0);
  const share = async () => {
    try { setNote((await shareCase(item.slug || item.id, item.title)) === 'copied' ? 'Link copied. Share it with family and friends.' : ''); } catch { setNote(''); }
  };

  return (
    <Page>
      <BackLink href="/give" label="Giving" />
      <RemoteImage bucket={CASE_BUCKET} path={item.photo_path} placeholderSize={40} style={styles.hero} />
      <View style={styles.tags}>
        {item.category_label ? <Text style={styles.tag}>{item.category_label}</Text> : null}
        {item.is_urgent ? <UrgentBadge /> : null}
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.meta}>
        {[item.beneficiary_name, item.age !== null ? `${item.age} years old` : null].filter(Boolean).join(' · ')}
      </Text>
      {item.city ? <View style={styles.cityRow}><MapPin color={palette.muted} size={14} /><Text style={styles.meta}>{item.city}</Text></View> : null}
      <Ornament />

      <View style={[uiStyles.card, styles.fundCard]}>
        <Progress raised={item.raised_mad} goal={item.goal_mad} donors={item.donor_count} />
        {item.status === 'funded' ? <Message kind="ok">This case is fully funded, alhamdulillah. Thank you to everyone who gave.</Message> : null}
        {item.status === 'closed' ? <Message kind="info">This case is closed and no longer accepts donations.</Message> : null}
        {open && !donating ? <Button label="Donate to this case" onPress={() => setDonating(true)} /> : null}
        <Button tone="secondary" label="Share this case" onPress={() => void share()} />
        {note ? <Message kind="ok">{note}</Message> : null}
        {item.can_manage ? <Button tone="secondary" label="Manage this case" onPress={() => router.push(`/collect/${item.id}` as Href)} /> : null}
      </View>

      {open && donating ? <DonateForm item={item} remaining={remaining} onDone={(pledgeId) => router.push(`/pledge/${pledgeId}` as Href)} onCancel={() => setDonating(false)} /> : null}

      <SectionHeading title="Their story" />
      <Text style={styles.body}>{item.bio || item.summary}</Text>

      {item.audio.length ? <><SectionHeading title="Listen" /><AudioPlayer clips={item.audio} /></> : null}
      {item.videos.length ? <><SectionHeading title="Watch" /><Reels videos={item.videos} /></> : null}

      {item.media.length ? (
        <>
          <SectionHeading title="Gallery" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
            {item.media.map((photo) => <GalleryImage key={photo.id} path={photo.path} caption={photo.caption} />)}
          </ScrollView>
        </>
      ) : null}

      {item.social_links.length ? <><SectionHeading title="Follow their journey" /><SocialLinks links={item.social_links} /></> : null}

      {item.contact && (item.contact.phone || item.contact.email) ? (
        <>
          <SectionHeading title="Contact" />
          <View style={styles.contact}>
            {item.contact.phone ? (
              <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`tel:${item.contact?.phone?.replace(/[^+\d]/g, '')}`)} style={styles.contactRow}>
                <Phone color={palette.forest} size={16} /><Text style={styles.contactText}>{item.contact.phone}</Text>
              </Pressable>
            ) : null}
            {item.contact.email ? (
              <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`mailto:${encodeURIComponent(item.contact?.email ?? '')}`)} style={styles.contactRow}>
                <Mail color={palette.forest} size={16} /><Text style={styles.contactText}>{item.contact.email}</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}

      <SectionHeading title="Recent donations" detail={wall.length ? undefined : 'Confirmed donations appear here'} />
      {wall.map((entry, index) => (
        <View key={`${entry.confirmed_at}-${index}`} style={[uiStyles.card, styles.wallRow]}>
          <View style={styles.wallHead}>
            <Text style={styles.wallName}>{entry.display_name}</Text>
            <Text style={styles.wallAmount}>{formatMad(entry.amount_mad)}</Text>
          </View>
          {entry.comment ? <Text style={styles.wallComment}>{entry.comment}</Text> : null}
        </View>
      ))}
      <SectionHeading title="Kind words" detail={wishes.length ? undefined : 'Be the first to leave a warm message'} />
      {wishes.map((wish) => (
        <View key={wish.id} style={[uiStyles.card, styles.wallRow]}>
          <Text style={styles.wallName}>{wish.display_name}</Text>
          <Text style={styles.wallComment}>{wish.body}</Text>
        </View>
      ))}
      <WishForm caseId={item.id} />
      <Text style={styles.fine}>Donations go directly to the family&apos;s bank account. Ihssan never holds the money; a fund collector confirms each transfer before it counts.</Text>
    </Page>
  );
}

function WishForm({ caseId }: { caseId: string }) {
  useScheme();
  const [body, setBody] = useState('');
  const [name, setName] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const send = async () => {
    if (body.trim().length < 2) { setMsg({ kind: 'error', text: 'Write a short message first.' }); return; }
    if (!anonymous && name.trim().length < 2) { setMsg({ kind: 'error', text: 'Enter a name, or send it anonymously.' }); return; }
    setBusy(true); setMsg(null);
    try {
      await postWish(caseId, body, name, anonymous);
      setBody('');
      setMsg({ kind: 'ok', text: 'Thank you. Your message will appear once it has been approved.' });
    } catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Could not send your message.' }); } finally { setBusy(false); }
  };
  return (
    <View style={[uiStyles.card, styles.form]}>
      <Text style={styles.formTitle}>Leave a kind word</Text>
      <Field label="Your message" value={body} onChangeText={setBody} maxLength={500} multiline />
      <View style={styles.switchRow}>
        <View style={styles.flex}><Text style={styles.switchTitle}>Send anonymously</Text></View>
        <Switch accessibilityLabel="Send anonymously" onValueChange={setAnonymous} trackColor={{ true: palette.forest }} value={anonymous} />
      </View>
      {!anonymous ? <Field label="Name to display" value={name} onChangeText={setName} maxLength={60} /> : null}
      {msg ? <Message kind={msg.kind}>{msg.text}</Message> : null}
      <Button label="Send message" busy={busy} onPress={() => void send()} />
    </View>
  );
}

function DonateForm({ item, remaining, onDone, onCancel }: { item: CaseDetail; remaining: number; onDone: (pledgeId: string) => void; onCancel: () => void }) {
  useScheme();
  const [amountText, setAmountText] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const amount = parseAmount(amountText);

  const submit = async () => {
    const problem = validateAmount(amount, item.min_donation_mad);
    if (problem || amount === null) { setError(problem); return; }
    if (!anonymous && name.trim().length < 2) { setError('Enter the name to show, or choose to stay anonymous.'); return; }
    setBusy(true);
    setError('');
    try {
      const pledge = await createPledge({ caseId: item.id, caseTitle: item.title, amount, displayName: name, anonymous, comment, contact });
      onDone(pledge.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start your donation order.');
      setBusy(false);
    }
  };

  return (
    <View style={[uiStyles.card, styles.form]}>
      <Text style={styles.formTitle}>Start your donation order</Text>
      <Text style={styles.meta}>You will get the bank details next, and 48 hours to send your transfer and upload the receipt.</Text>
      <Message kind="info">{ACCOUNT_RECEIPT_NOTICE}</Message>
      <Field label="Amount (MAD)" value={amountText} onChangeText={setAmountText} keyboardType="number-pad" maxLength={9} placeholder={`${item.min_donation_mad} or more`} />
      <View style={styles.chips}>
        {suggestedAmounts(item.min_donation_mad, remaining).map((value) => <Chip key={value} label={`${value}`} selected={amount === value} onPress={() => setAmountText(String(value))} />)}
      </View>
      <View style={styles.switchRow}>
        <View style={styles.flex}><Text style={styles.switchTitle}>Give anonymously</Text><Text style={styles.meta}>Your name is never shown publicly.</Text></View>
        <Switch accessibilityLabel="Give anonymously" onValueChange={setAnonymous} trackColor={{ true: palette.forest }} value={anonymous} />
      </View>
      {!anonymous ? <Field label="Name to display" value={name} onChangeText={setName} maxLength={60} /> : null}
      <Field label="A kind word (optional)" value={comment} onChangeText={setComment} maxLength={300} multiline />
      <Field label="Phone or email, only for the foundation (optional)" value={contact} onChangeText={setContact} maxLength={120} autoCapitalize="none" />
      {error ? <Message kind="error">{error}</Message> : null}
      <Button label="Continue to bank details" busy={busy} onPress={() => void submit()} />
      <Button tone="secondary" label="Cancel" onPress={onCancel} />
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  flex: { flex: 1 },
  hero: { ...{ borderRadius: 18 }, height: 380, overflow: 'hidden', width: '100%' },
  tags: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tag: { backgroundColor: palette.leaf, borderRadius: 10, color: palette.forest, fontSize: 11, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3 },
  title: { ...display, color: palette.ink, fontSize: 28, lineHeight: 34, marginTop: 8 },
  meta: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  cityRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 4 },
  fundCard: { gap: 6, marginTop: 14, padding: 16 },
  body: { color: palette.ink, fontSize: 15, lineHeight: 24 },
  gap: { marginTop: 12 },
  gallery: { gap: 12, paddingRight: 16 },
  galleryItem: { width: 220 },
  galleryImage: { backgroundColor: palette.leaf, borderRadius: 14, height: 160, width: 220 },
  caption: { color: palette.muted, fontSize: 12, lineHeight: 17, marginTop: 6 },
  contact: { gap: 8 },
  contactRow: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 44 },
  contactText: { color: palette.forest, fontSize: 15, fontWeight: '600' },
  wallRow: { gap: 4, marginTop: 8, padding: 12 },
  wallHead: { flexDirection: 'row', justifyContent: 'space-between' },
  wallName: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  wallAmount: { color: palette.forest, fontSize: 14, fontWeight: '700' },
  wallComment: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  fine: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 20 },
  form: { gap: 4, marginTop: 14, padding: 16 },
  formTitle: { ...display, color: palette.ink, fontSize: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  switchRow: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 16 },
  switchTitle: { color: palette.ink, fontSize: 14, fontWeight: '600' },
}));
