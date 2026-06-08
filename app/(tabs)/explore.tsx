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
  useWindowDimensions,
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

// ─── Article Card (tinted illustration tile in horizontal rows) ───────────────

// Extract the hue (0–360) from a hex color. Used so even near-white pastel
// article colors yield a clearly-colored tint instead of washing out to gray.
function hexToHue(hex: string): number {
  const s = hex.replace('#', '');
  const r = parseInt(s.slice(0, 2), 16) / 255;
  const g = parseInt(s.slice(2, 4), 16) / 255;
  const b = parseInt(s.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 220; // neutral → soft blue fallback
  let hue: number;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  hue *= 60;
  return Math.round(hue < 0 ? hue + 360 : hue);
}

// A clean single-color card tint from the article's hue: a rich, dark muted
// color in dark mode; a soft pastel in light mode. The whole card uses this one
// color so the illustration and title share a single seamless background.
function tintBg(hex: string, dark: boolean): string {
  const hue = hexToHue(hex);
  return dark ? `hsl(${hue}, 42%, 17%)` : `hsl(${hue}, 58%, 92%)`;
}

function ArticleCard({ article, colors }: { article: Article; colors: AppColors }) {
  const dark = colors.isDark;
  const { width } = useWindowDimensions();
  const cardW = Math.round(width * 0.46);
  const cardColor = getArticleColor(article);
  return (
    <Pressable
      style={({ pressed }) => [
        cardStyles.card,
        { width: cardW, backgroundColor: tintBg(cardColor, dark) },
        pressed && { opacity: 0.92, transform: [{ scale: 0.97 }] },
      ]}
      onPress={() => router.push(`/articles/${article.id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={`${article.title}. ${article.subtitle}.`}
    >
      {/* Illustration sits on the card's single tint. Transparent art is contained
          with padding; legacy baked-background art fills edge-to-edge. */}
      <View style={[cardStyles.imageWrap, { height: cardW }]}>
        <Image
          source={article.coverImage}
          style={article.transparentArt ? cardStyles.imageContain : cardStyles.image}
          resizeMode={article.transparentArt ? 'contain' : 'cover'}
          accessibilityIgnoresInvertColors
        />
      </View>

      {/* Title sits on the same tint below the illustration */}
      <View style={cardStyles.textArea}>
        <Text style={[cardStyles.title, { color: dark ? '#FFFFFF' : colors.textPrimary }]} numberOfLines={2}>{article.title}</Text>
      </View>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  // Single-tint card: illustration on top, title below, both on one tint.
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    marginRight: 14,
  },
  imageWrap: {
    width: '100%',
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
  textArea: {
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 22,
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
                      <ArticleCard key={article.id} article={article} colors={colors} />
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
