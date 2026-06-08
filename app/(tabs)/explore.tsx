import { ChevronRight, FileText } from 'lucide-react-native';
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
import { TabScreenWrapper } from '@/components/ui/tab-screen-wrapper';
import { ARTICLE_SECTIONS, getArticleById, getArticleColor, type Article } from '@/constants/articles';

const FF = 'System';

const DISCLAIMER_TEXT =
  'Content is for informational and educational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult your healthcare provider.';

// ─── Article Card (pastel illustration tile in horizontal rows) ───────────────

const CARD_W = 172;

// Turn an article's pastel hex into a translucent TINT laid over the page
// background: a dark muted tint in dark mode, a soft tint in light mode
// (Apple Fitness+ education-card style) instead of a solid pastel fill.
function tintBg(hex: string, dark: boolean): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${dark ? 0.18 : 0.55})`;
}

function ArticleCard({ article, dark }: { article: Article; dark: boolean }) {
  const cardColor = getArticleColor(article);
  return (
    <Pressable
      style={({ pressed }) => [
        cardStyles.card,
        { backgroundColor: tintBg(cardColor, dark) },
        pressed && { opacity: 0.92, transform: [{ scale: 0.97 }] },
      ]}
      onPress={() => router.push(`/articles/${article.id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={`${article.title}. ${article.subtitle}. ${article.readingTime} minute read.`}
    >
      {/* Square illustration. Transparent art is contained with padding over the section
          color; legacy baked-background art fills the tile edge-to-edge. */}
      <View style={cardStyles.imageWrap}>
        <Image
          source={article.coverImage}
          style={article.transparentArt ? cardStyles.imageContain : cardStyles.image}
          resizeMode={article.transparentArt ? 'contain' : 'cover'}
          accessibilityIgnoresInvertColors
        />
        <View style={cardStyles.readPill}>
          <Text style={cardStyles.readPillText}>{article.readingTime} MIN</Text>
        </View>
      </View>

      {/* Title sits inside the tinted card */}
      <View style={cardStyles.textArea}>
        <Text style={[cardStyles.title, { color: dark ? '#FFFFFF' : '#1A1A1A' }]} numberOfLines={3}>{article.title}</Text>
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
  imageContain: {
    width: '118%',
    height: '118%',
    marginLeft: '-9%',
    marginTop: '-9%',
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
    paddingTop: 10,
    paddingBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 25,
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
  // Gradient header removed — header always renders in its solid (minimal) form.
  const minimalHeader = true;
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
                <View key={section.id} style={s.section}>
                  <View style={s.sectionHeader}>
                    <Text style={s.sectionTitle}>{section.title}</Text>
                    <Pressable
                      style={({ pressed }) => [s.seeAllBtn, pressed && { opacity: 0.6 }]}
                      onPress={() => router.push(`/articles/section/${section.id}` as any)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`See all ${section.title} articles`}
                    >
                      <Text style={s.seeAllText}>See All</Text>
                      <ChevronRight size={16} color={colors.orange} />
                    </Pressable>
                  </View>
                  <Text style={s.sectionDescription}>{section.description}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.row}
                  >
                    {items.map((article) => (
                      <ArticleCard key={article.id} article={article} dark={colors.isDark} />
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
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      marginBottom: 4,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: c.textPrimary,
      letterSpacing: -0.4,
      flexShrink: 1,
      fontFamily: FF,
    },
    seeAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 1,
      paddingLeft: 12,
    },
    seeAllText: {
      fontSize: 15,
      fontWeight: '600',
      color: c.orange,
      fontFamily: FF,
    },
    sectionDescription: {
      fontSize: 14,
      color: w(0.45),
      lineHeight: 19,
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
