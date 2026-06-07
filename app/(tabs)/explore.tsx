import { FileText } from 'lucide-react-native';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useRef } from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/ui/gradient-background';
import { ScrollTitle } from '@/components/ui/scroll-title';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useTabBarVisibility } from '@/contexts/tab-bar-visibility';
import { usePreferencesStore } from '@/stores/preferences-store';
import { TabScreenWrapper } from '@/components/ui/tab-screen-wrapper';
import { ARTICLE_SECTIONS, getArticleById, type Article } from '@/constants/articles';

const FF = 'System';

const DISCLAIMER_TEXT =
  'Content is for informational and educational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult your healthcare provider.';

// ─── Article Card (pastel illustration tile in horizontal rows) ───────────────

const CARD_W = 172;

function ArticleCard({ article }: { article: Article }) {
  return (
    <Pressable
      style={({ pressed }) => [
        cardStyles.card,
        { backgroundColor: article.bgColor },
        pressed && { opacity: 0.92, transform: [{ scale: 0.97 }] },
      ]}
      onPress={() => router.push(`/articles/${article.id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={`${article.title}. ${article.subtitle}. ${article.readingTime} minute read.`}
    >
      {/* Square illustration — its baked-in background matches article.bgColor */}
      <View style={cardStyles.imageWrap}>
        <Image
          source={article.coverImage}
          style={cardStyles.image}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
        <View style={cardStyles.readPill}>
          <Text style={cardStyles.readPillText}>{article.readingTime} MIN</Text>
        </View>
      </View>

      {/* Title sits inside the colored card */}
      <View style={cardStyles.textArea}>
        <Text style={cardStyles.title} numberOfLines={3}>{article.title}</Text>
      </View>
    </Pressable>
  );
}

// Pastel cards stay light in both themes, so colors here are fixed (dark text on pastel).
const cardStyles = StyleSheet.create({
  card: {
    width: CARD_W,
    borderRadius: 22,
    overflow: 'hidden',
    marginRight: 14,
  },
  imageWrap: {
    width: CARD_W,
    height: CARD_W,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  readPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 11,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  readPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    fontFamily: FF,
  },
  textArea: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.3,
    lineHeight: 20,
    fontFamily: FF,
  },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function EducationScreen() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const { onScroll: tabBarOnScroll, onScrollEnd } = useTabBarVisibility();
  const onScroll = useCallback(
    (e: any) => {
      scrollY.setValue(e.nativeEvent.contentOffset.y);
      tabBarOnScroll(e);
    },
    [tabBarOnScroll],
  );
  const { colors } = useAppTheme();
  const headerStyle = usePreferencesStore((st) => st.headerStyle ?? 'gradient');
  const minimalHeader = headerStyle === 'minimal';
  const s = useMemo(() => createScreenStyles(colors, minimalHeader), [colors, minimalHeader]);

  return (
    <TabScreenWrapper>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
          <ScrollView
            contentContainerStyle={s.content}
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            onScrollEndDrag={onScrollEnd}
            onMomentumScrollEnd={onScrollEnd}
            scrollEventThrottle={16}
          >
            <GradientBackground />
            <View style={[s.heroHeader, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <Text style={s.heroTitle}>Education</Text>
            </View>

            {/* Horizontal section rows */}
            {ARTICLE_SECTIONS.map((section) => {
              const items = section.articleIds
                .map(getArticleById)
                .filter((a): a is Article => Boolean(a));
              if (items.length === 0) return null;
              return (
                <View key={section.title} style={s.section}>
                  <Text style={s.sectionTitle}>{section.title}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.row}
                  >
                    {items.map((article) => (
                      <ArticleCard key={article.id} article={article} />
                    ))}
                  </ScrollView>
                </View>
              );
            })}

            {/* Disclaimer */}
            <View style={s.footer}>
              <Text style={s.disclaimer}>{DISCLAIMER_TEXT}</Text>
              <Pressable
                style={s.sourcesLink}
                onPress={() => router.push('/settings/medical-sources' as any)}
                accessibilityRole="button"
                accessibilityLabel="View Medical Sources and Citations"
              >
                <FileText size={14} color={colors.orange} />
                <Text style={s.sourcesLinkText}>View Medical Sources & Citations</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
        <ScrollTitle title="Education" scrollY={scrollY} />
      </View>
    </TabScreenWrapper>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const createScreenStyles = (c: AppColors, minimalHeader = false) => {
  const w = (a: number) =>
    c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    content: { paddingTop: 0, paddingBottom: 120 },
    heroHeader: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 },
    section: { marginBottom: 28 },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: c.textPrimary,
      letterSpacing: -0.4,
      paddingHorizontal: 20,
      marginBottom: 14,
      fontFamily: FF,
    },
    row: { paddingLeft: 20, paddingRight: 6 },
    footer: { paddingHorizontal: 20 },
    heroTitle: {
      fontSize: 36,
      fontWeight: '800',
      color: minimalHeader && !c.isDark ? '#000000' : '#FFFFFF',
      letterSpacing: -1,
      marginBottom: 4,
      fontFamily: FF,
    },
    disclaimer: {
      fontSize: 13,
      color: w(0.3),
      textAlign: 'center',
      lineHeight: 16,
      marginTop: 16,
      paddingHorizontal: 8,
      fontFamily: FF,
    },
    sourcesLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 10,
      marginBottom: 8,
    },
    sourcesLinkText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.orange,
      fontFamily: FF,
    },
  });
};
