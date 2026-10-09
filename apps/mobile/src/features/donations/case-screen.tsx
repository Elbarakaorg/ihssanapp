import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { AtSign, Mail, Phone, Share2, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { RemoteImage } from '@/features/doctor/doctor-image';
import { BackLink, Button, Chip, Field, Message } from '@/features/doctor/ui';
import { imageUrl, socialKinds, type SocialLink } from '@/features/doctor/doctor-api';
import { Loading } from '@/ui/loading';
import { Page, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { display, palette, themedStyles, useScheme } from '@/ui/palette';
import { AudioPlayer, Reels } from './case-media';
import { CASE_BUCKET, type CaseDetail, type Wish, type WallEntry, createPledge, deleteWish, getCase, listWall, listWishes, postWish, shareCase } from './donations-api';
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
  const [wallLimit, setWallLimit] = useState(4);
  const [wishLimit, setWishLimit] = useState(4);

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
  const phone = item.contact?.phone;
  const email = item.contact?.email;
  const removeWish = async (wishId: string) => {
    try { await deleteWish(wishId); setWishes((current) => current.filter((w) => w.id !== wishId)); } catch (e) { setNote(e instanceof Error ? e.message : 'Could not delete this message.'); }
  };
  const share = async () => {
    try { setNote((await shareCase(item.slug || item.id, item.title)) === 'copied' ? 'Link copied. Share it with family and friends.' : ''); } catch { setNote(''); }
  };

  return (
    <Page>
      <BackLink href="/give" label="Giving" />
      <View style={styles.heroWrap}>
        <RemoteImage bucket={CASE_BUCKET} path={item.photo_path} placeholderSize={40} style={styles.hero} />
        <LinearGradient colors={['rgba(16,32,22,0)', 'rgba(16,32,22,0.78)']} locations={[0.35, 1]} pointerEvents="none" style={StyleSheet.absoluteFill} />
        <View style={styles.heroText} pointerEvents="none">
          <View style={styles.tags}>
            {item.category_label ? <Text style={styles.tag}>{item.category_label}</Text> : null}
            {item.is_urgent ? <UrgentBadge /> : null}
          </View>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.heroMeta}>
            {[item.beneficiary_name, item.age !== null ? `${item.age} years old` : null, item.city].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
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
      <Story text={item.bio || item.summary} />

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

      {(item.social_links.length > 0 || item.contact && (item.contact.phone || item.contact.email)) ? (
        <>
          <SectionHeading title="Connect" />
          <View style={styles.contactLinks}>
            {item.social_links.filter((link) => /^https:\/\//i.test(link.url)).map((link) => {
              const label = socialLinkLabel(link);
              return (
                <Pressable key={link.kind} accessibilityRole="link" accessibilityLabel={`${socialKinds.find((kind) => kind.kind === link.kind)?.label ?? link.kind}: ${label}`} onPress={() => void Linking.openURL(link.url)} style={styles.contactLink}>
                  {link.kind === 'instagram' ? <AtSign color={palette.forest} size={17} /> : <Share2 color={palette.forest} size={17} />}
                  <Text numberOfLines={1} style={styles.contactText}>{label}</Text>
                </Pressable>
              );
            })}
            {phone ? (
              <Pressable accessibilityRole="link" accessibilityLabel={`Call ${phone}`} onPress={() => void Linking.openURL(`tel:${phone.replace(/[^+\d]/g, '')}`)} style={styles.contactLink}>
                <Phone color={palette.forest} size={17} /><Text numberOfLines={1} style={styles.contactText}>{phone}</Text>
              </Pressable>
            ) : null}
            {email ? (
              <Pressable accessibilityRole="link" accessibilityLabel={`Email ${email}`} onPress={() => void Linking.openURL(`mailto:${encodeURIComponent(email)}`)} style={styles.contactLink}>
                <Mail color={palette.forest} size={17} /><Text numberOfLines={1} style={styles.contactText}>{email}</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}

      <SectionHeading title="Recent donations" detail={wall.length ? undefined : 'Confirmed donations appear here'} />
      {wall.slice(0, wallLimit).map((entry, index) => (
        <View key={`${entry.confirmed_at}-${index}`} style={[uiStyles.card, styles.wallRow]}>
          <View style={styles.wallHead}>
            <Text style={styles.wallName}>{entry.display_name}</Text>
            <Text style={styles.wallAmount}>{formatMad(entry.amount_mad)}</Text>
          </View>
          {entry.comment ? <Text style={styles.wallComment}>{entry.comment}</Text> : null}
        </View>
      ))}
      {wall.length > wallLimit ? <Pressable accessibilityRole="button" onPress={() => setWallLimit(wall.length)}><Text style={styles.more}>Show all {wall.length} donations</Text></Pressable> : null}
      <SectionHeading title="Kind words" detail={wishes.length ? undefined : 'Be the first to leave a warm message'} />
      {wishes.slice(0, wishLimit).map((wish) => (
        <View key={wish.id} style={[uiStyles.card, styles.wallRow]}>
          <View style={styles.wallHead}>
            <Text style={styles.wallName}>{wish.display_name}</Text>
            {item.can_manage ? (
              <Pressable accessibilityLabel="Delete this message" accessibilityRole="button" hitSlop={8} onPress={() => void removeWish(wish.id)}>
                <Trash2 color={palette.muted} size={15} />
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.wallComment}>{wish.body}</Text>
        </View>
      ))}
      {wishes.length > wishLimit ? <Pressable accessibilityRole="button" onPress={() => setWishLimit(wishes.length)}><Text style={styles.more}>Show all {wishes.length} messages</Text></Pressable> : null}
      <WishForm caseId={item.id} onSent={() => void listWishes(item.id).then(setWishes).catch(() => undefined)} />
      <Text style={styles.fine}>Donations go directly to the family&apos;s bank account. Ihssan never holds the money; a fund collector confirms each transfer before it counts.</Text>
    </Page>
  );
}

function socialLinkLabel(link: SocialLink) {
  if (link.kind !== 'instagram') return socialKinds.find((kind) => kind.kind === link.kind)?.label ?? link.kind;
  try {
    const segment = new URL(link.url).pathname.split('/').filter(Boolean)[0]?.replace(/^@/, '');
    return segment && !['p', 'reel', 'reels', 'tv', 'stories', 'explore', 'accounts'].includes(segment.toLowerCase())
      ? `@${segment}`
      : 'Instagram';
  } catch {
    return 'Instagram';
  }
}

function Story({ text }: { text: string }) {
  useScheme();
  const [open, setOpen] = useState(false);
  const long = text.length > 420;
  return (
    <View style={[uiStyles.card, styles.story]}>
      <Text numberOfLines={long && !open ? 7 : undefined} style={styles.body}>{text}</Text>
      {long ? <Pressable accessibilityRole="button" onPress={() => setOpen((v) => !v)}><Text style={styles.more}>{open ? 'Show less' : 'Read the full story'}</Text></Pressable> : null}
    </View>
  );
}

function WishForm({ caseId, onSent }: { caseId: string; onSent: () => void }) {
  useScheme();
  const [body, setBody] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    if (body.trim().length < 2) { setError('Write a short message first.'); return; }
    setBusy(true); setError('');
    try {
      await postWish(caseId, body, name, name.trim().length < 2);
      setBody(''); onSent();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send your message.'); } finally { setBusy(false); }
  };
  return (
    <View style={styles.wishForm}>
      <TextInput accessibilityLabel="Your kind word" maxLength={500} onChangeText={setBody} placeholder="Leave a kind word…" placeholderTextColor={palette.muted} style={styles.wishInput} value={body} />
      <View style={styles.wishRow}>
        <TextInput accessibilityLabel="Your name (optional)" maxLength={60} onChangeText={setName} placeholder="Your name (blank = anonymous)" placeholderTextColor={palette.muted} style={[styles.wishInput, styles.flex]} value={name} />
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void send()} style={({ pressed }) => [styles.wishSend, pressed && { opacity: 0.85 }]}>
          <Text style={styles.wishSendLabel}>{busy ? '…' : 'Send'}</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.wishError}>{error}</Text> : null}
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
      <Text style={styles.formTitle}>Your donation</Text>
      <Text style={styles.fieldTitle}>Amount</Text>
      <View style={styles.amountBox}>
        <TextInput accessibilityLabel="Amount in MAD" keyboardType="number-pad" maxLength={9} onChangeText={setAmountText} placeholder={`${item.min_donation_mad}`} placeholderTextColor={palette.muted} style={styles.amountInput} value={amountText} />
        <Text style={styles.currency}>MAD</Text>
      </View>
      <View style={styles.chips}>
        {suggestedAmounts(item.min_donation_mad, remaining).map((value) => <Chip key={value} label={`${value}`} selected={amount === value} onPress={() => setAmountText(String(value))} />)}
      </View>
      <View style={styles.switchRow}>
        <View style={styles.flex}><Text style={styles.switchTitle}>Give anonymously</Text><Text style={styles.meta}>Your name is never shown publicly.</Text></View>
        <Switch accessibilityLabel="Give anonymously" onValueChange={setAnonymous} trackColor={{ true: palette.forest }} value={anonymous} />
      </View>
      {!anonymous ? <Field label="Name to display" value={name} onChangeText={setName} maxLength={60} placeholder="How your name appears" /> : null}
      <Field label="A kind word (optional)" value={comment} onChangeText={setComment} maxLength={300} multiline placeholder="Write a short prayer or message" />
      <Field label="Phone or email (optional)" value={contact} onChangeText={setContact} maxLength={120} autoCapitalize="none" placeholder="Only seen by the foundation" />
      {error ? <Message kind="error">{error}</Message> : null}
      <Button label="Continue to bank details" busy={busy} onPress={() => void submit()} />
      <Button tone="secondary" label="Cancel" onPress={onCancel} />
      <View style={styles.notes}>
        <Text style={styles.noteText}>Next you get the bank details and 48 hours to send your transfer and upload the receipt.</Text>
        <Text style={styles.noteText}>{ACCOUNT_RECEIPT_NOTICE}</Text>
      </View>
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  flex: { flex: 1 },
  heroWrap: { borderRadius: 22, overflow: 'hidden' },
  hero: { height: 420, width: '100%' },
  heroText: { bottom: 0, left: 0, padding: 18, position: 'absolute', right: 0 },
  story: { padding: 16 },
  more: { color: palette.forest, fontSize: 13, fontWeight: '700', marginTop: 10, minHeight: 28 },
  tags: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: palette.leaf, borderRadius: 10, color: palette.forest, fontSize: 11, fontWeight: '700', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 3 },
  title: { ...display, color: '#FFFFFF', fontSize: 28, lineHeight: 34, marginTop: 8 },
  heroMeta: { color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 19, marginTop: 4 },
  meta: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  cityRow: { alignItems: 'center', flexDirection: 'row', gap: 4, marginTop: 4 },
  fundCard: { gap: 6, marginTop: 14, padding: 16 },
  body: { color: palette.ink, fontSize: 15, lineHeight: 24 },
  gap: { marginTop: 12 },
  gallery: { gap: 12, paddingRight: 16 },
  galleryItem: { width: 220 },
  galleryImage: { backgroundColor: palette.leaf, borderRadius: 14, height: 160, width: 220 },
  caption: { color: palette.muted, fontSize: 12, lineHeight: 17, marginTop: 6 },
  contactLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  contactLink: { alignItems: 'center', backgroundColor: palette.glass, borderColor: palette.line, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 7, maxWidth: '100%', minHeight: 44, paddingHorizontal: 12 },
  contactText: { color: palette.forest, flexShrink: 1, fontSize: 14, fontWeight: '600' },
  wallRow: { gap: 4, marginTop: 8, padding: 12 },
  wallHead: { flexDirection: 'row', justifyContent: 'space-between' },
  wallName: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  wallAmount: { color: palette.forest, fontSize: 14, fontWeight: '700' },
  wallComment: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  fine: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 20 },
  wishForm: { gap: 8, marginTop: 10 },
  wishRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  wishInput: { backgroundColor: palette.glass, borderColor: palette.line, borderRadius: 12, borderWidth: 1, color: palette.ink, fontSize: 14, minHeight: 42, paddingHorizontal: 12 },
  wishSend: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 12, justifyContent: 'center', minHeight: 42, paddingHorizontal: 18 },
  wishSendLabel: { color: palette.white, fontSize: 14, fontWeight: '700' },
  wishError: { color: palette.dangerText, fontSize: 12 },
  fieldTitle: { color: palette.ink, fontSize: 13, fontWeight: '600', marginTop: 14 },
  amountBox: { alignItems: 'center', backgroundColor: palette.white, borderColor: palette.line, borderRadius: 16, borderWidth: 1, flexDirection: 'row', marginTop: 6, paddingHorizontal: 16 },
  amountInput: { ...display, color: palette.ink, flex: 1, fontSize: 32, minHeight: 64, outlineStyle: 'none' } as object,
  currency: { color: palette.muted, fontSize: 15, fontWeight: '700' },
  notes: { backgroundColor: palette.leaf, borderRadius: 14, gap: 8, marginTop: 14, padding: 12 },
  noteText: { color: palette.ink, fontSize: 13, lineHeight: 19 },
  form: { gap: 4, marginTop: 14, padding: 16 },
  formTitle: { ...display, color: palette.ink, fontSize: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  switchRow: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 16 },
  switchTitle: { color: palette.ink, fontSize: 14, fontWeight: '600' },
}));
