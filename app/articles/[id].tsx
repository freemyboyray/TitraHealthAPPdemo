import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const FF = 'Inter_400Regular';
const ORANGE = '#FF742A';

type ArticleDetail = {
  id: string;
  title: string;
  subtitle: string | null;
  category: string;
  body_markdown: string;
  reading_time_minutes: number;
  published_at: string;
  phase_focus: string;
};

const categoryColors: Record<string, string> = {
  nutrition: '#27AE60',
  medication: '#FF742A',
  lifestyle: '#5B8BF5',
  mindset: '#9B59B6',
  exercise: '#E8960C',
};

export default function ArticleDetailScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const { id } = useLocalSearchParams<{ id: string }>();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('articles')
      .select('id, title, subtitle, category, body_markdown, reading_time_minutes, published_at, phase_focus')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setArticle(data as ArticleDetail);
        setLoading(false);
      });
  }, [id]);

  const chipColor = article ? (categoryColors[article.category] ?? ORANGE) : ORANGE;
  const categoryLabel = article
    ? article.category.charAt(0).toUpperCase() + article.category.slice(1)
    : '';
  const publishedLabel = article
    ? new Date(article.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Nav bar */}
        <View style={s.navBar}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={s.navTitle} numberOfLines={1}>Article</Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={ORANGE} />
          </View>
        ) : !article ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.textMuted, fontSize: 15, fontFamily: FF }}>
              Article not found.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Category + reading time */}
            <View style={s.metaRow}>
              <View style={[s.chip, { backgroundColor: chipColor + '20', borderColor: chipColor + '55' }]}>
                <Text style={[s.chipText, { color: chipColor }]}>{categoryLabel}</Text>
              </View>
              <Text style={s.readTime}>{article.reading_time_minutes} min read</Text>
              <Text style={s.readTime}>{publishedLabel}</Text>
            </View>

            {/* Title */}
            <Text style={s.title}>{article.title}</Text>

            {/* Subtitle */}
            {article.subtitle && (
              <Text style={s.subtitle}>{article.subtitle}</Text>
            )}

            <View style={s.divider} />

            {/* Body - render markdown as plain text paragraphs */}
            {article.body_markdown
              .split('\n')
              .filter(line => line.trim() !== '')
              .map((line, i) => {
                const isH1 = line.startsWith('# ');
                const isH2 = line.startsWith('## ');
                const isH3 = line.startsWith('### ');
                const isBullet = line.startsWith('- ') || line.startsWith('* ');
                const cleanLine = line
                  .replace(/^#{1,3}\s/, '')
                  .replace(/\*\*(.*?)\*\*/g, '$1')
                  .replace(/\*(.*?)\*/g, '$1')
                  .replace(/^[-*]\s/, '');

                if (isH1) return <Text key={i} style={s.bodyH1}>{cleanLine}</Text>;
                if (isH2) return <Text key={i} style={s.bodyH2}>{cleanLine}</Text>;
                if (isH3) return <Text key={i} style={s.bodyH3}>{cleanLine}</Text>;
                if (isBullet) return (
                  <View key={i} style={s.bulletRow}>
                    <View style={s.bulletDot} />
                    <Text style={s.bodyText}>{cleanLine}</Text>
                  </View>
                );
                return <Text key={i} style={s.bodyText}>{cleanLine}</Text>;
              })
            }

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
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
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: c.borderSubtle,
      alignItems: 'center', justifyContent: 'center',
    },
    navTitle: {
      fontSize: 17, fontWeight: '700', color: c.textPrimary,
      letterSpacing: -0.3, fontFamily: 'Inter_700Bold', flex: 1, textAlign: 'center',
    },

    content: { paddingHorizontal: 20, paddingBottom: 40 },

    metaRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginBottom: 16, flexWrap: 'wrap',
    },
    chip: {
      borderRadius: 20, borderWidth: 1,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    chipText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, fontFamily: FF },
    readTime: { fontSize: 12, color: w(0.40), fontFamily: FF },

    title: {
      fontSize: 28, fontWeight: '800', color: c.textPrimary,
      letterSpacing: -0.5, lineHeight: 36, marginBottom: 10, fontFamily: 'Inter_800ExtraBold',
    },
    subtitle: {
      fontSize: 16, color: w(0.55), lineHeight: 24,
      fontWeight: '400', marginBottom: 8, fontFamily: FF,
    },
    divider: {
      height: 1, backgroundColor: c.borderSubtle,
      marginVertical: 20,
    },

    bodyH1: {
      fontSize: 22, fontWeight: '800', color: c.textPrimary,
      letterSpacing: -0.3, marginBottom: 10, marginTop: 20, fontFamily: 'Inter_800ExtraBold',
    },
    bodyH2: {
      fontSize: 18, fontWeight: '700', color: c.textPrimary,
      letterSpacing: -0.2, marginBottom: 8, marginTop: 18, fontFamily: 'Inter_700Bold',
    },
    bodyH3: {
      fontSize: 15, fontWeight: '700', color: ORANGE,
      marginBottom: 6, marginTop: 14, fontFamily: 'Inter_700Bold',
    },
    bodyText: {
      fontSize: 15, color: w(0.75),
      lineHeight: 24, marginBottom: 12, fontFamily: FF, flex: 1,
    },
    bulletRow: {
      flexDirection: 'row', alignItems: 'flex-start',
      gap: 10, marginBottom: 10,
    },
    bulletDot: {
      width: 6, height: 6, borderRadius: 3,
      backgroundColor: ORANGE, marginTop: 9, flexShrink: 0,
    },
  });
};
