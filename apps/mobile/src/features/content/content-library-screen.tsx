import { useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { ArrowLeft, BookOpenText, RefreshCw, X } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { supabaseClient } from '@/platform/supabase/client';
import { Page, PageHeading, PreviewNotice, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { palette, themedStyles, useScheme } from '@/ui/palette';

type Props = { kind: 'articles' | 'blogs' };
type PublishedArticle = {
  id: string;
  slug: string;
  locale: 'ar' | 'fr' | 'en';
  category: string;
  title: string;
  summary: string;
  body_markdown: string;
  effective_from: string;
};

const categories = [
  { id: 'all', label: 'All topics' },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'vitamins', label: 'Vitamins' },
  { id: 'general_health', label: 'General health' },
];

export default function ContentLibraryScreen({ kind }: Props) {
  useScheme();
  const router = useRouter();
  const [articles, setArticles] = useState<PublishedArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<PublishedArticle | null>(null);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadArticles = async () => {
    if (!supabaseClient) {
      setError('Content is not configured yet.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data: profile } = await supabaseClient.from('profiles').select('preferred_locale').maybeSingle();
      const locale = profile?.preferred_locale === 'ar' || profile?.preferred_locale === 'fr' ? profile.preferred_locale : 'en';
      let query = supabaseClient.from('blog_articles')
        .select('id,slug,locale,category,title,summary,body_markdown,effective_from')
        .eq('status', 'published')
        .eq('locale', locale)
        .is('effective_to', null)
        .order('effective_from', { ascending: false });
      if (kind === 'blogs' && category !== 'all') query = query.eq('category', category);
      const { data, error: queryError } = await query;
      if (queryError) throw queryError;
      setArticles((data ?? []) as PublishedArticle[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load published content.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadArticles(); }, [kind, category]);

  const title = kind === 'blogs' ? 'Health blogs' : 'Articles';

  return (
    <Page>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}><ArrowLeft color={palette.ink} size={18} /><Text style={styles.backText}>Home</Text></Pressable>
      <PreviewNotice />
      <PageHeading eyebrow={kind === 'blogs' ? 'Wellness journal' : 'Health library'} title={title}>
        {kind === 'blogs' ? 'Browse clinician-reviewed stories by topic.' : 'Clear, reviewed health information for everyday decisions.'}
      </PageHeading>

      {kind === 'blogs' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryRow}>{categories.map((item) => <Pressable accessibilityRole="button" accessibilityState={{ selected: category === item.id }} key={item.id} onPress={() => setCategory(item.id)} style={[styles.categoryButton, category === item.id && styles.categoryButtonActive]}><Text style={[styles.categoryText, category === item.id && styles.categoryTextActive]}>{item.label}</Text></Pressable>)}</ScrollView> : null}

      <SectionHeading title={kind === 'blogs' ? 'Stories' : 'Latest articles'} detail={`${articles.length} published`} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {loading ? <View style={styles.empty}><Text style={styles.body}>Loading published content…</Text></View> : articles.length ? <View style={styles.articleList}>{articles.map((article) => <Pressable accessibilityRole="button" key={article.id} onPress={() => setSelectedArticle(article)} style={[uiStyles.card, styles.articleCard]}><View style={styles.articleMeta}><Text style={styles.categoryTag}>{article.category.replaceAll('_', ' ')}</Text><Text style={styles.date}>{new Date(article.effective_from).toLocaleDateString()}</Text></View><Text style={styles.articleTitle}>{article.title}</Text><Text style={styles.body}>{article.summary}</Text><View style={styles.readMore}><BookOpenText color={palette.forest} size={15} /><Text style={styles.readMoreText}>Read article</Text></View></Pressable>)}</View> : <View style={styles.empty}><BookOpenText color={palette.forest} size={22} /><Text style={styles.emptyTitle}>No published {kind} yet</Text><Text style={styles.body}>New content will appear here after editorial and clinical review.</Text><Pressable accessibilityRole="button" disabled={loading} onPress={() => void loadArticles()} style={styles.refreshButton}><RefreshCw color={palette.forest} size={15} /><Text style={styles.refreshText}>Refresh</Text></Pressable></View>}

      <Modal animationType="slide" onRequestClose={() => setSelectedArticle(null)} transparent visible={selectedArticle !== null}>
        <View style={styles.modalBackdrop}><View style={styles.articleModal}><View style={styles.modalHeader}><View style={styles.modalCopy}><Text style={styles.categoryTag}>{selectedArticle?.category.replaceAll('_', ' ')}</Text><Text style={styles.modalTitle}>{selectedArticle?.title}</Text></View><Pressable accessibilityLabel="Close article" onPress={() => setSelectedArticle(null)} style={styles.closeButton}><X color={palette.ink} size={19} /></Pressable></View><ScrollView><Text style={styles.articleBody}>{selectedArticle?.body_markdown}</Text></ScrollView></View></View>
      </Modal>
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  backButton: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 8, marginBottom: 16, minHeight: 35 },
  backText: { color: palette.ink, fontSize: 13, fontWeight: '600' },
  categoryScroll: { flexGrow: 0, marginBottom: 18, marginHorizontal: -3 },
  categoryRow: { gap: 7, paddingHorizontal: 3 },
  categoryButton: { backgroundColor: palette.white, borderColor: palette.line, borderRadius: 16, borderWidth: 1, justifyContent: 'center', minHeight: 34, paddingHorizontal: 11 },
  categoryButtonActive: { backgroundColor: palette.forest, borderColor: palette.forest },
  categoryText: { color: palette.muted, fontSize: 10, fontWeight: '600' },
  categoryTextActive: { color: palette.white },
  articleList: { gap: 9 },
  articleCard: { gap: 8, padding: 14 },
  articleMeta: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  categoryTag: { color: palette.coral, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  date: { color: palette.muted, fontSize: 9 },
  articleTitle: { color: palette.ink, fontSize: 19, fontWeight: '600', lineHeight: 25 },
  body: { color: palette.muted, fontSize: 12, lineHeight: 18 },
  readMore: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 2 },
  readMoreText: { color: palette.forest, fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', backgroundColor: palette.white, borderColor: palette.line, borderRadius: 7, borderWidth: 1, gap: 9, justifyContent: 'center', minHeight: 190, padding: 20 },
  emptyTitle: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  refreshButton: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 3, minHeight: 34 },
  refreshText: { color: palette.forest, fontSize: 11, fontWeight: '700' },
  error: { backgroundColor: '#FCE9E5', borderRadius: 5, color: '#9A3E2A', fontSize: 12, padding: 10 },
  modalBackdrop: { backgroundColor: 'rgba(12, 32, 23, .5)', flex: 1, justifyContent: 'flex-end' },
  articleModal: { backgroundColor: palette.paper, borderTopLeftRadius: 12, borderTopRightRadius: 12, maxHeight: '88%', padding: 20 },
  modalHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, justifyContent: 'space-between', marginBottom: 12 },
  modalCopy: { flex: 1, gap: 7 },
  modalTitle: { color: palette.ink, fontSize: 23, fontWeight: '600', lineHeight: 29 },
  closeButton: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  articleBody: { color: palette.ink, fontSize: 14, lineHeight: 23, paddingBottom: 25 },
}));