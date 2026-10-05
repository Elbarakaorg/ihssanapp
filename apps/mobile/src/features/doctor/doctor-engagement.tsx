import { type Href, useRouter } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/auth-provider';
import {
  type DoctorComment, type SocialLink,
  deleteMyDoctorComment, listDoctorComments, saveDoctorComment, setCommentHidden, socialKinds, toggleDoctorLove,
} from '@/features/doctor/doctor-api';
import { Button, Field, Message, doctorStyles as s } from '@/features/doctor/ui';
import { Loading } from '@/ui/loading';
import { display, palette, themedStyles, useScheme } from '@/ui/palette';

export function LoveButton({ doctorId, initialCount, initialLoved, isOwner }: { doctorId: string; initialCount: number; initialLoved: boolean; isOwner: boolean }) {
  useScheme();
  const router = useRouter();
  const { session } = useAuth();
  const [count, setCount] = useState(initialCount);
  const [loved, setLoved] = useState(initialLoved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setCount(initialCount); setLoved(initialLoved); }, [initialCount, initialLoved]);

  const press = async () => {
    if (isOwner || busy) return;
    if (!session) { router.push('/auth' as Href); return; }
    setBusy(true); setError('');
    const before = { count, loved };
    setLoved(!loved); setCount(count + (loved ? -1 : 1));
    try {
      const result = await toggleDoctorLove(doctorId);
      setLoved(result.loved); setCount(Number(result.love_count));
    } catch (e) {
      setLoved(before.loved); setCount(before.count);
      setError(e instanceof Error ? e.message : 'Could not update your love.');
    } finally { setBusy(false); }
  };

  const label = count === 1 ? '1 love' : `${count} loves`;
  return (
    <View>
      <Pressable accessibilityLabel={isOwner ? label : loved ? `Remove your love. ${label}` : `Show love. ${label}`} accessibilityRole="button" accessibilityState={{ selected: loved, disabled: isOwner }}
        onPress={() => void press()} style={({ pressed }) => [styles.love, loved && styles.loveOn, pressed && styles.pressed]}>
        <Heart color={loved ? palette.white : palette.coral} fill={loved ? palette.white : 'transparent'} size={18} />
        <Text style={[styles.loveLabel, loved && styles.loveLabelOn]}>{label}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function SocialLinks({ links }: { links: SocialLink[] }) {
  useScheme();
  const safe = links.filter((l) => /^https:\/\//i.test(l.url));
  if (!safe.length) return null;
  return (
    <View style={s.row}>
      {safe.map((l) => (
        <Pressable key={l.kind} accessibilityRole="link" onPress={() => void Linking.openURL(l.url)} style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
          <Text style={styles.linkLabel}>{socialKinds.find((k) => k.kind === l.kind)?.label ?? l.kind}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function CommentsSection({ doctorId, enabled, isOwner, onCountChange }: { doctorId: string; enabled: boolean; isOwner: boolean; onCountChange?: () => void }) {
  useScheme();
  const router = useRouter();
  const { session } = useAuth();
  const [items, setItems] = useState<DoctorComment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const rows = await listDoctorComments(doctorId);
      setItems(rows);
      const mine = rows.find((r) => r.is_mine);
      setDraft((current) => (current === '' && mine ? mine.body : current));
    } catch (e) { setItems([]); setError(e instanceof Error ? e.message : 'Could not load comments.'); }
  }, [doctorId]);
  useEffect(() => { if (enabled || isOwner) void load(); }, [enabled, isOwner, load, session?.identity.id]);

  const act = async (task: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await task(); await load(); onCountChange?.(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); } finally { setBusy(false); }
  };

  if (!enabled && !isOwner) return null;
  const mine = items?.find((r) => r.is_mine);
  const visibleCount = items?.filter((r) => !r.is_hidden).length ?? 0;

  return (
    <View>
      <Text style={s.section}>Comments{items ? ` (${visibleCount})` : ''}</Text>
      {!enabled ? <Message kind="info">Comments are turned off. Only you can see this section.</Message> : null}
      {items === null ? <Loading inline label="Loading comments" /> : null}
      {items?.length === 0 ? <Text style={s.meta}>No comments yet.</Text> : null}
      {items?.map((c) => (
        <View key={c.id} style={[s.card, c.is_hidden && styles.hidden]}>
          <View style={styles.head}>
            <Text style={s.cardTitle}>{c.author_name}{c.is_mine ? ' (you)' : ''}</Text>
            {c.had_visit ? <Text style={styles.badge}>Had an appointment</Text> : null}
          </View>
          <Text style={s.body}>{c.body}</Text>
          <Text style={s.meta}>{new Date(c.created_at).toLocaleDateString()}{c.is_hidden ? ' · Hidden from the public' : ''}</Text>
          {isOwner ? (
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void act(() => setCommentHidden(c.id, !c.is_hidden))}>
              <Text style={styles.action}>{c.is_hidden ? 'Show this comment' : 'Hide this comment'}</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {error ? <Message kind="error">{error}</Message> : null}
      {isOwner || !enabled ? null : !session ? (
        <Button label="Sign in to comment" tone="secondary" onPress={() => router.push('/auth' as Href)} />
      ) : (
        <>
          <Field label={mine ? 'Edit your comment' : 'Share your experience'} value={draft} onChangeText={setDraft} maxLength={600} multiline />
          <Text style={s.meta}>Be kind and factual. Don’t share health details about others. The doctor can hide comments.</Text>
          <Button label={mine ? 'Update comment' : 'Post comment'} busy={busy} disabled={draft.trim().length < 3} onPress={() => void act(() => saveDoctorComment(doctorId, draft))} />
          {mine ? <Button label="Delete my comment" tone="danger" disabled={busy} onPress={() => void act(async () => { await deleteMyDoctorComment(doctorId); setDraft(''); })} /> : null}
        </>
      )}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  love: { alignItems: 'center', alignSelf: 'flex-start', borderColor: palette.coral, borderRadius: 22, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: 44, paddingHorizontal: 16 },
  loveOn: { backgroundColor: palette.coral },
  loveLabel: { color: palette.coral, fontSize: 14, fontWeight: '600' },
  loveLabelOn: { color: palette.white },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  error: { color: palette.coral, fontSize: 12, marginTop: 6 },
  link: { borderColor: palette.line, borderRadius: 18, borderWidth: 1, justifyContent: 'center', minHeight: 38, paddingHorizontal: 14 },
  linkLabel: { color: palette.forest, fontSize: 13, fontWeight: '600' },
  head: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  badge: { ...display, color: palette.gold, fontSize: 13 },
  hidden: { opacity: 0.6, borderStyle: 'dashed' },
  action: { color: palette.forest, fontSize: 13, fontWeight: '600', paddingVertical: 8 },
}));
