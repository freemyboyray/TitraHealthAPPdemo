import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { contentCategoryColor } from '@/constants/theme';
import { ARTICLES, type ArticleSection } from '@/constants/articles';
import { ChevronLeft } from 'lucide-react-native';

const FF = 'System';

const ARTICLE_DISCLAIMER =
  'This content is for informational and educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult your healthcare provider before making changes to your health routine.';

// ─── Inline markdown renderer ────────────────────────────────────────────────
// Supports: **bold**, - bullets, \n paragraphs

function renderTextWithBold(text: string, baseStyle: any, boldStyle: any, key: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <Text key={key} style={baseStyle}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={i} style={boldStyle}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

function SectionContent({ section, styles }: { section: ArticleSection; styles: ReturnType<typeof createStyles> }) {
  const lines = section.body.split('\n').filter((l) => l.trim() !== '');

  return (
    <View style={styles.sectionWrap}>
      {section.heading && <Text style={styles.sectionHeading}>{section.heading}</Text>}
      {lines.map((line, i) => {
        const isBullet = line.startsWith('- ');
        const cleanLine = isBullet ? line.slice(2) : line;

        if (isBullet) {
          return (
            <View key={i} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <View style={{ flex: 1 }}>
                {renderTextWithBold(cleanLine, styles.bodyText, styles.boldText, `b-${i}`)}
              </View>
            </View>
          );
        }

        return renderTextWithBold(cleanLine, styles.bodyText, styles.boldText, `p-${i}`);
      })}
    </View>
  );
}

// ─── Article Detail Screen ───────────────────────────────────────────────────

export default function ArticleDetailScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();

  const article = ARTICLES.find((a) => a.id === id);

  if (!article) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <SafeAreaView>
          <Text style={{ color: colors.textMuted, fontSize: 17, fontFamily: FF }}>
            Article not found.
          </Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.orange, fontSize: 15, fontWeight: '600', fontFamily: FF, textAlign: 'center' }}>
              Go Back
            </Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  const chipColor = contentCategoryColor(colors.isDark, article.category);
  const categoryLabel =
    article.category.charAt(0).toUpperCase() + article.category.slice(1);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Nav bar */}
        <View style={s.navBar}>
          <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
            <ChevronLeft size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={s.navTitle} numberOfLines={1}>Article</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {/* Cover image */}
          <Image
            source={article.coverImage}
            style={s.coverImage}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />

          {/* Meta */}
          <View style={s.metaRow}>
            <View style={[s.chip, { backgroundColor: chipColor + '18' }]}>
              <Text style={[s.chipText, { color: chipColor }]}>{categoryLabel}</Text>
            </View>
            <Text style={s.readTime}>{article.readingTime} min read</Text>
          </View>

          {/* Title + subtitle */}
          <Text style={s.title}>{article.title}</Text>
          <Text style={s.subtitle}>{article.subtitle}</Text>

          <View style={s.divider} />

          {/* Article sections */}
          {article.sections.map((section, i) => (
            <SectionContent key={i} section={section} styles={s} />
          ))}

          {/* Sources */}
          <View style={s.sourcesWrap}>
            <Text style={s.sourcesTitle}>Sources</Text>
            {article.sources.map((source, i) => (
              <Text key={i} style={s.sourceItem}>{source}</Text>
            ))}
          </View>

          {/* Disclaimer */}
          <View style={s.disclaimerWrap}>
            <Text style={s.disclaimerText}>{ARTICLE_DISCLAIMER}</Text>
          </View>

          <View style={{ height: 40 }} />
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

    content: { paddingBottom: 40 },

    coverImage: {
      width: '100%',
      height: 220,
      backgroundColor: c.isDark ? w(0.06) : w(0.04),
      marginBottom: 20,
    },

    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14,
      paddingHorizontal: 20,
    },
    chip: {
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    chipText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      fontFamily: FF,
    },
    readTime: {
      fontSize: 13,
      color: w(0.4),
      fontFamily: FF,
    },

    title: {
      fontSize: 28,
      fontWeight: '800',
      color: c.textPrimary,
      letterSpacing: -0.5,
      lineHeight: 34,
      marginBottom: 8,
      paddingHorizontal: 20,
      fontFamily: FF,
    },
    subtitle: {
      fontSize: 17,
      color: w(0.55),
      lineHeight: 23,
      fontWeight: '400',
      paddingHorizontal: 20,
      fontFamily: FF,
    },
    divider: {
      height: 1,
      backgroundColor: c.borderSubtle,
      marginVertical: 24,
      marginHorizontal: 20,
    },

    sectionWrap: {
      marginBottom: 28,
      paddingHorizontal: 20,
    },
    sectionHeading: {
      fontSize: 20,
      fontWeight: '700',
      color: c.textPrimary,
      letterSpacing: -0.3,
      marginBottom: 12,
      fontFamily: FF,
    },
    bodyText: {
      fontSize: 17,
      color: w(0.75),
      lineHeight: 25,
      marginBottom: 12,
      fontFamily: FF,
    },
    boldText: {
      fontWeight: '700',
      color: c.textPrimary,
    },

    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 10,
    },
    bulletDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.orange,
      marginTop: 10,
      flexShrink: 0,
    },

    sourcesWrap: {
      marginTop: 12,
      paddingHorizontal: 20,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: c.borderSubtle,
    },
    sourcesTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: c.orange,
      letterSpacing: 1,
      marginBottom: 10,
      textTransform: 'uppercase',
      fontFamily: FF,
    },
    sourceItem: {
      fontSize: 14,
      color: w(0.4),
      lineHeight: 20,
      marginBottom: 6,
      fontFamily: FF,
    },

    disclaimerWrap: {
      marginTop: 24,
      marginHorizontal: 20,
      padding: 16,
      borderRadius: 12,
      backgroundColor: c.isDark ? w(0.04) : w(0.03),
    },
    disclaimerText: {
      fontSize: 13,
      color: w(0.35),
      lineHeight: 18,
      textAlign: 'center',
      fontFamily: FF,
    },
  });
};
