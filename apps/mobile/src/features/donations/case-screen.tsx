import { type Href, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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
import { useLocale } from '@/platform/locale/locale-provider';
import { donationCopy } from '@/platform/locale/donations';
import { AudioPlayer, Reels } from './case-media';
import { CASE_BUCKET, type CaseDetail, type OpenOrder, type Wish, type WallEntry, createPledge, deleteWish, findStoredOpenOrder, getCase, getSavedDonorEmail, listWall, listWishes, postWish, recoverOpenOrders, shareCase } from './donations-api';
import { formatMad, isValidEmail, parseAmount, suggestedAmounts, validateAmount } from './donations-logic';
import { Progress, UrgentBadge } from './donations-ui';
import { OpenOrderCard } from './open-order-card';

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
  const { locale } = useLocale();
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
  const [openOrder, setOpenOrder] = useState<OpenOrder | null>(null);

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

  const caseId = item?.id;
  useFocusEffect(useCallback(() => {
    if (caseId) void findStoredOpenOrder(caseId).then(setOpenOrder).catch(() => undefined);
  }, [caseId]));

  if (item === undefined) return <Page direction={locale === 'ar' ? 'rtl' : 'ltr'}><Loading label={donationCopy(locale, 'case.loading')} /></Page>;
  if (!item) return <Page direction={locale === 'ar' ? 'rtl' : 'ltr'}><BackLink direction={locale === 'ar' ? 'rtl' : 'ltr'} href="/give" label={donationCopy(locale, 'case.giving')} /><Message kind="error">{error || donationCopy(locale, 'case.unavailable')}</Message></Page>;

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
    <Page direction={locale === 'ar' ? 'rtl' : 'ltr'}>
      <BackLink direction={locale === 'ar' ? 'rtl' : 'ltr'} href="/give" label={donationCopy(locale, 'case.giving')} />
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
            {[item.beneficiary_name, item.age !== null ? donationCopy(locale, 'case.age', { age: item.age }) : null, item.city].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
      <View style={[uiStyles.card, styles.fundCard]}>
        <Progress raised={item.raised_mad} goal={item.goal_mad} donors={item.donor_count} />
        {item.status === 'funded' ? <Message kind="ok">{donationCopy(locale, 'case.funded')}</Message> : null}
        {item.status === 'closed' ? <Message kind="info">{donationCopy(locale, 'case.closed')}</Message> : null}
        {open && !donating && !openOrder ? <Button label={donationCopy(locale, 'case.donate')} onPress={() => setDonating(true)} /> : null}
        <Button tone="secondary" label={donationCopy(locale, 'case.share')} onPress={() => void share()} />
        {note ? <Message kind="ok">{note}</Message> : null}
        {item.can_manage ? <Button tone="secondary" label={donationCopy(locale, 'case.manage')} onPress={() => router.push(`/collect/${item.id}` as Href)} /> : null}
      </View>

      {open && openOrder ? <OpenOrderCard order={openOrder} minDonation={item.min_donation_mad} onChange={setOpenOrder} /> : null}
      {open && donating ? <DonateForm item={item} locale={locale} remaining={remaining} onDone={(pledgeId) => router.push(`/pledge/${pledgeId}` as Href)} onCancel={() => setDonating(false)} /> : null}

      <SectionHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} title={donationCopy(locale, 'case.story')} />
      <Story locale={locale} text={item.bio || item.summary} />

      {item.audio.length ? <><SectionHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} title={donationCopy(locale, 'case.listen')} /><AudioPlayer clips={item.audio} /></> : null}
      {item.videos.length ? <><SectionHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} title={donationCopy(locale, 'case.watch')} /><Reels videos={item.videos} /></> : null}

      {item.media.length ? (
        <>
          <SectionHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} title={donationCopy(locale, 'case.gallery')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
            {item.media.map((photo) => <GalleryImage key={photo.id} path={photo.path} caption={photo.caption} />)}
          </ScrollView>
        </>
      ) : null}

      {(item.social_links.length > 0 || item.contact && (item.contact.phone || item.contact.email)) ? (
        <>
          <SectionHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} title={donationCopy(locale, 'case.contact')} />
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

      <SectionHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} title={donationCopy(locale, 'case.recentDonations')} detail={wall.length ? undefined : donationCopy(locale, 'case.confirmedAppear')} />
      {wall.slice(0, wallLimit).map((entry, index) => (
        <View key={`${entry.confirmed_at}-${index}`} style={[uiStyles.card, styles.wallRow]}>
          <View style={styles.wallHead}>
            <Text style={styles.wallName}>{entry.display_name}</Text>
            <Text style={styles.wallAmount}>{formatMad(entry.amount_mad)}</Text>
          </View>
          {entry.comment ? <Text style={styles.wallComment}>{entry.comment}</Text> : null}
        </View>
      ))}
      {wall.length > wallLimit ? <Pressable accessibilityRole="button" onPress={() => setWallLimit(wall.length)}><Text style={styles.more}>{donationCopy(locale, 'case.showDonations', { count: wall.length })}</Text></Pressable> : null}
      <SectionHeading direction={locale === 'ar' ? 'rtl' : 'ltr'} title={donationCopy(locale, 'case.kindWords')} detail={wishes.length ? undefined : donationCopy(locale, 'case.firstWish')} />
      {wishes.slice(0, wishLimit).map((wish) => (
        <View key={wish.id} style={[uiStyles.card, styles.wallRow]}>
          <View style={styles.wallHead}>
            <Text style={styles.wallName}>{wish.display_name}</Text>
            {item.can_manage ? (
                <Pressable accessibilityLabel={donationCopy(locale, 'wish.delete')} accessibilityRole="button" hitSlop={8} onPress={() => void removeWish(wish.id)}>
                <Trash2 color={palette.muted} size={15} />
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.wallComment}>{wish.body}</Text>
        </View>
      ))}
      {wishes.length > wishLimit ? <Pressable accessibilityRole="button" onPress={() => setWishLimit(wishes.length)}><Text style={styles.more}>{donationCopy(locale, 'case.showWishes', { count: wishes.length })}</Text></Pressable> : null}
      <WishForm caseId={item.id} locale={locale} onSent={() => void listWishes(item.id).then(setWishes).catch(() => undefined)} />
      <Text style={[styles.fine, locale === 'ar' && styles.rtlText]}>{donationCopy(locale, 'case.publicNote')}</Text>
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

function Story({ text, locale }: { text: string; locale: 'en' | 'fr' | 'ar' }) {
  useScheme();
  const [open, setOpen] = useState(false);
  const long = text.length > 420;
  return (
    <View style={[uiStyles.card, styles.story]}>
      <Text numberOfLines={long && !open ? 7 : undefined} style={styles.body}>{text}</Text>
      {long ? <Pressable accessibilityRole="button" onPress={() => setOpen((v) => !v)}><Text style={styles.more}>{donationCopy(locale, open ? 'case.readLess' : 'case.readMore')}</Text></Pressable> : null}
    </View>
  );
}

function WishForm({ caseId, onSent, locale }: { caseId: string; onSent: () => void; locale: 'en' | 'fr' | 'ar' }) {
  useScheme();
  const [body, setBody] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    if (body.trim().length < 2) { setError(donationCopy(locale, 'wish.tooShort')); return; }
    setBusy(true); setError('');
    try {
      await postWish(caseId, body, name, name.trim().length < 2);
      setBody(''); onSent();
    } catch (e) { setError(e instanceof Error ? e.message : donationCopy(locale, 'wish.sendError')); } finally { setBusy(false); }
  };
  return (
    <View style={styles.wishForm}>
      <TextInput accessibilityLabel={donationCopy(locale, 'wish.body')} maxLength={500} onChangeText={setBody} placeholder={donationCopy(locale, 'wish.bodyPlaceholder')} placeholderTextColor={palette.muted} style={[styles.wishInput, locale === 'ar' && styles.rtlText]} value={body} />
      <View style={styles.wishRow}>
        <TextInput accessibilityLabel={donationCopy(locale, 'wish.name')} maxLength={60} onChangeText={setName} placeholder={donationCopy(locale, 'wish.namePlaceholder')} placeholderTextColor={palette.muted} style={[styles.wishInput, styles.flex, locale === 'ar' && styles.rtlText]} value={name} />
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void send()} style={({ pressed }) => [styles.wishSend, pressed && { opacity: 0.85 }]}>
          <Text style={styles.wishSendLabel}>{busy ? '…' : donationCopy(locale, 'wish.send')}</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.wishError}>{error}</Text> : null}
    </View>
  );
}

function DonateForm({ item, remaining, onDone, onCancel, locale }: { item: CaseDetail; remaining: number; onDone: (pledgeId: string) => void; onCancel: () => void; locale: 'en' | 'fr' | 'ar' }) {
  useScheme();
  const textDirection = locale === 'ar' ? 'rtl' : 'ltr';
  const [amountText, setAmountText] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  const [emailUpdates, setEmailUpdates] = useState(false);
  const [recovered, setRecovered] = useState<OpenOrder[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const amount = parseAmount(amountText);
  useEffect(() => { void getSavedDonorEmail().then((saved) => setEmail((current) => current || saved)); }, []);

  const submit = async () => {
    const problem = validateAmount(amount, item.min_donation_mad, locale);
    if (problem || amount === null) { setError(problem); return; }
    if (!isValidEmail(email)) { setError(donationCopy(locale, 'donate.emailInvalid')); return; }
    if (!anonymous && name.trim().length < 2) { setError(donationCopy(locale, 'donate.nameRequired')); return; }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const unfinished = await recoverOpenOrders(email, item.id);
      if (unfinished.length) { setRecovered(unfinished); setBusy(false); return; }
      const pledge = await createPledge({ caseId: item.id, caseTitle: item.title, amount, displayName: name, anonymous, comment, email, emailUpdates, locale });
      onDone(pledge.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : donationCopy(locale, 'donate.startError'));
      setBusy(false);
    }
  };

  if (recovered.length) {
    return (
      <>
        <Message kind="info">{donationCopy(locale, 'order.found')}</Message>
        {recovered.map((order) => (
          <OpenOrderCard
            key={order.id}
            order={order}
            minDonation={item.min_donation_mad}
            onChange={(next) => {
              if (next) { setRecovered((list) => list.map((entry) => (entry.id === next.id ? next : entry))); return; }
              const rest = recovered.filter((entry) => entry.id !== order.id);
              setRecovered(rest);
              if (!rest.length) setNotice(donationCopy(locale, 'order.cancelled'));
            }}
          />
        ))}
        <Pressable accessibilityRole="link" onPress={() => setRecovered([])} style={styles.useOther}>
          <Text style={styles.more}>{donationCopy(locale, 'order.otherEmail')}</Text>
        </Pressable>
      </>
    );
  }

  return (
    <View style={[uiStyles.card, styles.form]}>
      <Text style={[styles.formTitle, locale === 'ar' && styles.rtlText]}>{donationCopy(locale, 'donate.title')}</Text>
      <Text style={[styles.fieldTitle, locale === 'ar' && styles.rtlText]}>{donationCopy(locale, 'donate.amount')}</Text>
      <View style={styles.amountBox}>
        <TextInput accessibilityLabel={donationCopy(locale, 'pledge.amountInput')} keyboardType="number-pad" maxLength={9} onChangeText={setAmountText} placeholder={`${item.min_donation_mad}`} placeholderTextColor={palette.muted} style={styles.amountInput} value={amountText} />
        <Text style={styles.currency}>MAD</Text>
      </View>
      <View style={styles.chips}>
        {suggestedAmounts(item.min_donation_mad, remaining).map((value) => <Chip key={value} label={`${value}`} selected={amount === value} onPress={() => setAmountText(String(value))} />)}
      </View>
      <Field label={donationCopy(locale, 'donate.email')} direction={textDirection} inputDirection="ltr" value={email} onChangeText={setEmail} maxLength={254} autoCapitalize="none" autoComplete="email" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" placeholder={donationCopy(locale, 'donate.emailPlaceholder')} />
      <Text style={[styles.meta, locale === 'ar' && styles.rtlText]}>{donationCopy(locale, 'donate.emailPrivate')}</Text>
      <View style={styles.switchRow}>
        <View style={styles.flex}><Text style={[styles.switchTitle, locale === 'ar' && styles.rtlText]}>{donationCopy(locale, 'donate.emailUpdates')}</Text><Text style={[styles.meta, locale === 'ar' && styles.rtlText]}>{donationCopy(locale, 'donate.emailUpdatesNote')}</Text></View>
        <Switch accessibilityLabel={donationCopy(locale, 'donate.emailUpdates')} onValueChange={setEmailUpdates} trackColor={{ true: palette.forest }} value={emailUpdates} />
      </View>
      <View style={styles.switchRow}>
        <View style={styles.flex}><Text style={[styles.switchTitle, locale === 'ar' && styles.rtlText]}>{donationCopy(locale, 'donate.anonymous')}</Text><Text style={[styles.meta, locale === 'ar' && styles.rtlText]}>{donationCopy(locale, 'donate.namePrivate')}</Text></View>
        <Switch accessibilityLabel={donationCopy(locale, 'donate.anonymous')} onValueChange={setAnonymous} trackColor={{ true: palette.forest }} value={anonymous} />
      </View>
      {!anonymous ? <Field label={donationCopy(locale, 'donate.displayName')} direction={textDirection} value={name} onChangeText={setName} maxLength={60} placeholder={donationCopy(locale, 'donate.displayNamePlaceholder')} /> : null}
      <Field label={donationCopy(locale, 'donate.kindWord')} direction={textDirection} value={comment} onChangeText={setComment} maxLength={300} multiline placeholder={donationCopy(locale, 'donate.kindWordPlaceholder')} />
      {notice ? <Message kind="ok">{notice}</Message> : null}
      {error ? <Message kind="error">{error}</Message> : null}
      <Button label={donationCopy(locale, 'donate.continue')} busy={busy} onPress={() => void submit()} />
      <Button tone="secondary" label={donationCopy(locale, 'donate.cancel')} onPress={onCancel} />
      <View style={styles.notes}>
        <Text style={[styles.noteText, locale === 'ar' && styles.rtlText]}>{donationCopy(locale, 'donate.next')}</Text>
        <Text style={[styles.noteText, locale === 'ar' && styles.rtlText]}>{donationCopy(locale, 'pledge.receiptNotice')}</Text>
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
  useOther: { alignSelf: 'center' },
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
  rtlText: { writingDirection: 'rtl', textAlign: 'right' },
}));
