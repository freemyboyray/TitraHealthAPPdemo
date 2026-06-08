import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import {
  getArticleById,
  getArticleColor,
  getSectionById,
  type Article,
} from '@/constants/articles';

const FF = 'System';

// ─── Article list row (thumbnail + title + description + chevron) ──────────────

function ArticleRowItem({
  article,
  styles,
}: {
  article: Article;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
      onPress={() => router.push(`/articles/${article.id}` as any)}
      accessibilityRole="button"
      accessibilityLabel={`${article.title}. ${article.subtitle}.`}
    >
      <View style={[styles.thumbWrap, { backgroundColor: getArticleColor(article) }]}>
        <Image
          source={article.coverImage}
          style={article.transparentArt ? styles.thumbContain : styles.thumb}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>

      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {article.title}
        </Text>
        <Text style={styles.rowSubtitle} numberOfLines={2}>
          {article.subtitle}
        </Text>
      </View>

      <ChevronRight size={20} color={styles.chevronColor.color} />
    </Pressable>
  );
}

// ─── Section "See All" screen ─────────────────────────────────────────────────

export default function ArticleSectionScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();

  const section = getSectionById(id);
  const articles = (section?.articleIds ?? [])
    .map(getArticleById)
    .filter((a): a is Article => Boolean(a));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Nav bar */}
        <View style={s.navBar}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
            <ChevronLeft size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={s.navTitle} numberOfLines={1}>
            {section?.title ?? 'Education'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {section && <Text style={s.intro}>{section.description}</Text>}

          {articles.length === 0 ? (
            <Text style={s.empty}>No articles found.</Text>
          ) : (
            articles.map((article) => (
              <ArticleRowItem key={article.id} article={article} styles={s} />
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.borderSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navTitle: {
      fontSize: 19,
      fontWeight: '700',
      color: c.textPrimary,
      letterSpacing: -0.3,
      fontFamily: FF,
      flex: 1,
      textAlign: 'center',
    },

    content: { paddingHorizontal: 20, paddingBottom: 48 },

    intro: {
      fontSize: 15,
      color: w(0.5),
      lineHeight: 21,
      marginTop: 4,
      marginBottom: 20,
      fontFamily: FF,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 12,
    },
    thumbWrap: {
      width: 64,
      height: 64,
      borderRadius: 16,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumb: {
      width: 64,
      height: 64,
    },
    thumbContain: {
      width: 62,
      height: 62,
    },
    rowText: {
      flex: 1,
    },
    rowTitle: {
      fontSize: 19,
      fontWeight: '800',
      color: c.textPrimary,
      letterSpacing: -0.3,
      lineHeight: 24,
      marginBottom: 3,
      fontFamily: FF,
    },
    rowSubtitle: {
      fontSize: 14,
      color: w(0.5),
      lineHeight: 19,
      marginBottom: 4,
      fontFamily: FF,
    },
    rowMeta: {
      fontSize: 12,
      fontWeight: '600',
      color: w(0.35),
      fontFamily: FF,
    },
    chevronColor: { color: w(0.25) },

    empty: {
      fontSize: 15,
      color: w(0.4),
      textAlign: 'center',
      marginTop: 40,
      fontFamily: FF,
    },
  });
};
