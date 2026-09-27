import type { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette } from './palette';

export function Page({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function PreviewNotice() {
  return (
    <View style={styles.notice}>
      <View style={styles.noticeDot} />
      <Text style={styles.noticeText}>PREVIEW BUILD · NO HEALTH DATA IS SAVED</Text>
    </View>
  );
}

export function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      {children ? <Text style={styles.description}>{children}</Text> : null}
    </View>
  );
}

export function SectionHeading({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
    </View>
  );
}

export function BrandMark() {
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandIcon}>
        <View style={styles.brandStem} />
        <View style={styles.brandCross} />
      </View>
      <Text style={styles.brandName}>ihssan</Text>
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  card: {
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 8,
    borderWidth: 1,
    padding: 18,
  },
  iconTile: {
    alignItems: 'center',
    backgroundColor: palette.leaf,
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
});

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: palette.paper,
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    maxWidth: 760,
    paddingBottom: 34,
    paddingHorizontal: 20,
    paddingTop: 18,
    width: '100%',
  },
  notice: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#E9EDE8',
    borderRadius: 4,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 22,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  noticeDot: {
    backgroundColor: palette.coral,
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  noticeText: {
    color: palette.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  heading: {
    marginBottom: 22,
  },
  eyebrow: {
    color: palette.forest,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 9,
    textTransform: 'uppercase',
  },
  title: {
    color: palette.ink,
    fontFamily: 'Georgia',
    fontSize: 34,
    fontWeight: '400',
    lineHeight: 41,
  },
  description: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 10,
    maxWidth: 560,
  },
  sectionHeading: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 24,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  sectionDetail: {
    color: palette.muted,
    fontSize: 12,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 9,
    marginBottom: 18,
  },
  brandIcon: {
    alignItems: 'center',
    backgroundColor: palette.forest,
    borderRadius: 7,
    height: 27,
    justifyContent: 'center',
    position: 'relative',
    width: 27,
  },
  brandStem: {
    backgroundColor: palette.white,
    borderRadius: 2,
    height: 15,
    width: 4,
  },
  brandCross: {
    backgroundColor: palette.white,
    borderRadius: 2,
    height: 4,
    position: 'absolute',
    width: 15,
  },
  brandName: {
    color: palette.ink,
    fontFamily: 'Georgia',
    fontSize: 21,
    fontWeight: '700',
  },
});