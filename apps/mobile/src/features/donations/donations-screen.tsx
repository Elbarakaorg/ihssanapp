import { useEffect, useState } from 'react';
import { BadgeCheck, HeartHandshake, Landmark } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { supabaseClient } from '@/platform/supabase/client';
import { Page, PageHeading, PreviewNotice, SectionHeading, uiStyles } from '@/ui/patient-ui';
import { palette, themedStyles, useScheme } from '@/ui/palette';

type DonationCase = {
  id: string;
  title: string;
  summary: string;
  city: string | null;
  goal_mad: number;
  raised_mad: number;
  status: 'published' | 'funded';
};

export default function DonationsScreen() {
  useScheme();
  const [cases, setCases] = useState<DonationCase[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabaseClient) return;
    void supabaseClient
      .from('donation_cases')
      .select('id,title,summary,city,goal_mad,raised_mad,status')
      .in('status', ['published', 'funded'])
      .order('published_at', { ascending: false })
      .limit(30)
      .then(({ data, error: queryError }) => {
        if (queryError) setError('Could not load cases. Please try again later.');
        else setCases((data ?? []) as DonationCase[]);
      });
  }, []);

  return (
    <Page>
      <PreviewNotice />
      <PageHeading eyebrow="Ihssan Foundation" title="Give with purpose">
        Support verified cases across Morocco. Donations and fund distribution will be handled by Ihssan's foundation.
      </PageHeading>

      {error ? <Text accessibilityRole="alert" style={styles.emptyBody}>{error}</Text> : null}
      {cases.length ? (
        <View style={styles.steps}>
          {cases.map((item) => {
            const percent = Math.min(100, Math.round((item.raised_mad / item.goal_mad) * 100));
            return (
              <View key={item.id} style={[uiStyles.card, styles.caseCard]}>
                <Text style={styles.stepTitle}>{item.title}{item.city ? ` · ${item.city}` : ''}</Text>
                <Text style={styles.stepBody}>{item.summary}</Text>
                <View accessibilityLabel={`${percent}% funded`} accessibilityRole="progressbar" style={styles.track}>
                  <View style={[styles.fill, { width: `${percent}%` }]} />
                </View>
                <Text style={styles.stepBody}>
                  {item.raised_mad.toLocaleString()} of {item.goal_mad.toLocaleString()} MAD{item.status === 'funded' ? ' · Fully funded' : ''}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyCase}>
          <View style={styles.heartTile}>
            <HeartHandshake color={palette.forest} size={25} strokeWidth={1.7} />
          </View>
          <Text style={styles.emptyTitle}>Verified cases will appear here</Text>
          <Text style={styles.emptyBody}>There are no published cases yet. Each case shows its verification status and how funds are allocated.</Text>
        </View>
      )}

      <SectionHeading title="How giving works" />
      <View style={styles.steps}>
        <View style={[uiStyles.card, styles.stepCard]}>
          <View style={styles.stepIcon}><BadgeCheck color={palette.forest} size={18} /></View>
          <View style={styles.stepCopy}>
            <Text style={styles.stepTitle}>Cases are reviewed</Text>
            <Text style={styles.stepBody}>The foundation verifies cases before publication.</Text>
          </View>
        </View>
        <View style={[uiStyles.card, styles.stepCard]}>
          <View style={[styles.stepIcon, { backgroundColor: palette.sky }]}><Landmark color={palette.forest} size={18} /></View>
          <View style={styles.stepCopy}>
            <Text style={styles.stepTitle}>Funds go through the foundation</Text>
            <Text style={styles.stepBody}>Payment and distribution records are kept separate and traceable.</Text>
          </View>
        </View>
      </View>
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  emptyCase: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 24,
    paddingVertical: 31,
  },
  heartTile: {
    alignItems: 'center',
    backgroundColor: palette.leaf,
    borderCurve: 'continuous',
    borderRadius: 10,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyBody: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 400,
    textAlign: 'center',
  },
  steps: {
    gap: 9,
  },
  caseCard: {
    gap: 8,
    padding: 14,
  },
  track: {
    backgroundColor: palette.line,
    borderRadius: 4,
    height: 8,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: palette.forest,
    height: 8,
  },
  stepCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  stepIcon: {
    alignItems: 'center',
    backgroundColor: palette.leaf,
    borderCurve: 'continuous',
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  stepCopy: {
    flex: 1,
  },
  stepTitle: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  stepBody: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
}));