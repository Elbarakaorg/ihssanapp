import { StyleSheet, Text, View } from 'react-native';

import { BackLink } from '@/features/doctor/ui';
import { VerseCard } from '@/features/spirit/verse-card';
import { groupTitles, practices, reflections, type Reflection } from '@/features/spirit/verses';
import { display, palette, themedStyles, useScheme, wobble } from '@/ui/palette';
import { Page, PageHeading } from '@/ui/patient-ui';

export default function VersesScreen() {
  useScheme();
  return (
    <Page>
      <BackLink href="/" label="Home" />
      <PageHeading eyebrow="Shifa & Ihsan · شفاء وإحسان" title="Healing and excellence">
        Words of comfort for the sick, and a reminder to do all things beautifully.
      </PageHeading>
      {(Object.keys(groupTitles) as Reflection['group'][]).map((group) => (
        <View key={group}>
          <View style={styles.groupHead}>
            <Text style={styles.groupTitle}>{groupTitles[group].title}</Text>
            <Text style={styles.groupArabic}>{groupTitles[group].arabic}</Text>
          </View>
          <Text style={styles.intro}>{groupTitles[group].intro}</Text>
          {reflections.filter((item) => item.group === group).map((item) => <VerseCard item={item} key={item.id} />)}
          {group === 'dua' ? practices.map((practice) => (
            <View key={practice.title} style={styles.practice}>
              <Text style={styles.practiceTitle}>{practice.title} <Text style={styles.practiceArabic}>{practice.arabic}</Text></Text>
              <Text style={styles.practiceBody}>{practice.body}</Text>
            </View>
          )) : null}
        </View>
      ))}
      <Text style={styles.footer}>Translations are renderings of the meanings. Spiritual reading complements, and never replaces, medical care.</Text>
    </Page>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  groupHead: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 },
  groupTitle: { ...display, color: palette.ink, fontSize: 22 },
  groupArabic: { color: palette.gold, fontFamily: 'Amiri_400Regular', fontSize: 22 },
  intro: { color: palette.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  practice: { ...wobble, borderColor: palette.line, borderStyle: 'dashed', borderWidth: 1, gap: 4, marginTop: 12, padding: 14 },
  practiceTitle: { ...display, color: palette.ink, fontSize: 17 },
  practiceArabic: { color: palette.gold, fontFamily: 'Amiri_400Regular', fontSize: 16 },
  practiceBody: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  footer: { color: palette.muted, fontSize: 11, fontStyle: 'italic', lineHeight: 17, marginTop: 28, textAlign: 'center' },
}));
