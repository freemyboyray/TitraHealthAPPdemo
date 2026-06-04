import { FileText } from 'lucide-react-native';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useRef } from 'react';
import {
  Animated,
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
import { ARTICLES, type Article } from '@/constants/articles';
import { Image } from 'expo-image';

const FF = 'System';

const DISCLAIMER_TEXT =
  'Content is for informational and educational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult your healthcare provider.';

// ─── Article Card ────────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: Article }) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createCardStyles(colors), [colors]);
  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] }]}
      onPress={() => router.push(`/articles/${article.id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={`${article.title}. ${article.subtitle}. ${article.readingTime} minute read.`}
    >
      {/* Cover image */}
      <Image
        source={article.coverImage}
        style={s.coverImage}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />

      {/* Text content below image */}
      <View style={s.textArea}>
        <Text style={s.readTime}>{article.readingTime} MIN READ</Text>
        <Text style={s.title}>{article.title}</Text>
        <Text style={s.subtitle} numberOfLines={2}>{article.subtitle}</Text>
      </View>
    </Pressable>
  );
}

const createCardStyles = (c: AppColors) => {
  const w = (a: number) =>
    c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    card: {
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: c.surface,
      marginBottom: 20,
      borderWidth: c.isDark ? 0.5 : 0,
      borderColor: c.isDark ? c.border : 'transparent',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: c.isDark ? 0.2 : 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    coverImage: {
      width: '100%',
      height: 195,
      backgroundColor: c.isDark ? w(0.06) : w(0.04),
    },
    textArea: {
      padding: 16,
      paddingTop: 14,
    },
    readTime: {
      fontSize: 11,
      fontWeight: '600',
      color: w(0.35),
      letterSpacing: 0.5,
      marginBottom: 8,
      fontFamily: FF,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: c.textPrimary,
      letterSpacing: -0.4,
      lineHeight: 28,
      marginBottom: 4,
      fontFamily: FF,
    },
    subtitle: {
      fontSize: 15,
      fontWeight: '400',
      color: c.textSecondary,
      lineHeight: 20,
      fontFamily: FF,
    },
  });
};

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

            {/* Article cards */}
            {ARTICLES.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}

            {/* Disclaimer */}
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
    content: { paddingHorizontal: 20, paddingTop: 0, paddingBottom: 120 },
    heroHeader: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 },
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
