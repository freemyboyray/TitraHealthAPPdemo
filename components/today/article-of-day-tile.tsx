import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import { ARTICLES, getArticleColor } from '@/constants/articles';
import { localDateStr } from '@/lib/date-utils';

const FF = 'System';

function pickDailyArticle(dateStr: string) {
  // dateStr is YYYY-MM-DD; produce a stable integer for the day so the same
  // article shows all day and rotates at local midnight.
  const seed = dateStr.split('-').reduce((acc, part) => acc * 31 + parseInt(part, 10), 0);
  const idx = Math.abs(seed) % ARTICLES.length;
  return ARTICLES[idx];
}

export function ArticleOfDayTile() {
  const { colors } = useAppTheme();
  const todayStr = localDateStr();
  const article = useMemo(() => pickDailyArticle(todayStr), [todayStr]);

  const tc = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  const onPress = () => {
    Haptics.selectionAsync();
    router.push(`/articles/${article.id}` as never);
  };

  return (
    <Pressable
      style={{ flex: 1, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 }}
      onPress={onPress}
      accessibilityLabel={`Article of the day: ${article.title}`}
      accessibilityRole="button"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
        {/* Cover thumb */}
        {article.transparentArt ? (
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 14,
              backgroundColor: getArticleColor(article),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image
              source={article.coverImage}
              style={{ width: 86, height: 86 }}
              resizeMode="contain"
            />
          </View>
        ) : (
          <Image
            source={article.coverImage}
            style={{ width: 88, height: 88, borderRadius: 14 }}
            resizeMode="cover"
          />
        )}

        {/* Right column */}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{
            fontSize: 11, fontWeight: '800', color: colors.orange,
            letterSpacing: 1.4, fontFamily: FF,
          }}>
            ARTICLE OF THE DAY
          </Text>
          <Text
            style={{
              fontSize: 17, fontWeight: '800', color: colors.textPrimary,
              letterSpacing: -0.3, fontFamily: FF, lineHeight: 22,
            }}
            numberOfLines={2}
          >
            {article.title}
          </Text>
          <Text
            style={{
              fontSize: 13, color: tc(0.6), fontFamily: FF, lineHeight: 18,
            }}
            numberOfLines={1}
          >
            {article.subtitle}
          </Text>
          <Text style={{
            fontSize: 12, fontWeight: '600', color: tc(0.45), fontFamily: FF,
            marginTop: 2,
          }}>
            {article.category}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
