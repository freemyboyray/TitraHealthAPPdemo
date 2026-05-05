import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, useWindowDimensions, Image, ActivityIndicator, ListRenderItemInfo } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/contexts/theme-context';
import { useLogStore } from '@/stores/log-store';
import { searchFatSecretRecipes, type RecipeResult } from '@/lib/fatsecret';
import { useHealthData } from '@/contexts/health-data';
import { localDateStr } from '@/lib/date-utils';

const ORANGE = '#FF742A';
const HORIZONTAL_PADDING = 20;

/**
 * Lifestyle-tab card showing 3 high-protein recipes filtered toward today's
 * remaining calorie budget. Tap a card → recipe detail screen.
 */
export function RecipesCard() {
  const { colors } = useAppTheme();
  const tc = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const foodLogs = useLogStore(s => s.foodLogs);
  const userGoals = useLogStore(s => s.userGoals);
  const health = useHealthData();

  const [recipes, setRecipes] = useState<RecipeResult[]>([]);
  const [loading, setLoading] = useState(true);

  const { proteinNeeded, caloriesRemaining } = useMemo(() => {
    const today = localDateStr();
    const todayLogs = foodLogs.filter(f => f.logged_at && localDateStr(new Date(f.logged_at)) === today);
    const proteinSoFar = todayLogs.reduce((s, f) => s + (f.protein_g ?? 0), 0);
    const calsSoFar = todayLogs.reduce((s, f) => s + (f.calories ?? 0), 0);
    const proteinTarget = userGoals?.daily_protein_g_target ?? health.targets?.proteinG ?? 120;
    const calTarget = userGoals?.daily_calories_target ?? health.targets?.caloriesTarget ?? 2000;
    return {
      proteinNeeded: Math.max(0, proteinTarget - proteinSoFar),
      caloriesRemaining: Math.max(200, calTarget - calsSoFar),
    };
  }, [foodLogs, userGoals, health.targets]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query = proteinNeeded > 30 ? 'high protein' : 'healthy dinner';
    searchFatSecretRecipes(query).then((results) => {
      if (cancelled) return;
      const fitting = results.filter(r => r.calories_per_serving <= caloriesRemaining && r.calories_per_serving > 0);
      const pool = fitting.length >= 3 ? fitting : results;
      const top = [...pool]
        .sort((a, b) => b.protein_per_serving - a.protein_per_serving)
        .slice(0, 3);
      setRecipes(top);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setRecipes([]);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [proteinNeeded, caloriesRemaining]);

  const cardWidth = (screenWidth - HORIZONTAL_PADDING * 2) * 0.78;

  const renderItem = useCallback(({ item, index }: ListRenderItemInfo<RecipeResult>) => (
    <Pressable
      onPress={() => router.push(`/recipe/${item.recipe_id}`)}
      style={({ pressed }) => ({
        width: cardWidth,
        marginRight: index === 2 ? 0 : 12,
        borderRadius: 20,
        backgroundColor: colors.surface,
        borderWidth: 0.5,
        borderColor: colors.border,
        overflow: 'hidden',
        opacity: pressed ? 0.78 : 1,
      })}
    >
      {item.recipe_image ? (
        <Image source={{ uri: item.recipe_image }} style={{ width: '100%', height: 130 }} resizeMode="cover" />
      ) : (
        <View style={{ width: '100%', height: 130, backgroundColor: tc(0.06) }} />
      )}
      <View style={{ padding: 14 }}>
        <Text
          style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, fontFamily: 'System', letterSpacing: -0.1, lineHeight: 19 }}
          numberOfLines={2}
        >
          {item.recipe_name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <View style={{
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
            backgroundColor: 'rgba(255,116,42,0.12)',
          }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: ORANGE, fontFamily: 'System', letterSpacing: 0.3 }}>
              {Math.round(item.protein_per_serving)}g protein
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: tc(0.5), fontFamily: 'System', fontVariant: ['tabular-nums'] }}>
            {Math.round(item.calories_per_serving)} cal
          </Text>
        </View>
      </View>
    </Pressable>
  ), [cardWidth, colors, tc, router]);

  if (!loading && recipes.length === 0) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{
        fontSize: 20, fontWeight: '800', color: colors.textPrimary,
        letterSpacing: -0.5, marginTop: 12, marginBottom: 16, fontFamily: 'System',
      }}>
        Recipes for You
      </Text>
      {loading ? (
        <View style={{
          height: 230, borderRadius: 20,
          backgroundColor: colors.surface,
          borderWidth: 0.5, borderColor: colors.border,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <ActivityIndicator color={ORANGE} />
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(r) => String(r.recipe_id)}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + 12}
          decelerationRate="fast"
        />
      )}
    </View>
  );
}
