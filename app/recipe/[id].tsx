import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/contexts/theme-context';
import { GradientBackground } from '@/components/ui/gradient-background';
import { getFatSecretRecipe, type RecipeResult } from '@/lib/fatsecret';
import { useMealTrayStore } from '@/stores/meal-tray-store';
import type { AppColors } from '@/constants/theme';

const FF = 'System';
const ORANGE = '#FF742A';

export default function RecipeDetailScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const addToTray = useMealTrayStore(state => state.addToTray);

  const [recipe, setRecipe] = useState<RecipeResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const recipeId = parseInt(id ?? '', 10);
    if (!Number.isFinite(recipeId)) { setLoading(false); return; }
    getFatSecretRecipe(recipeId).then((r) => {
      if (cancelled) return;
      setRecipe(r);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id]);

  const handleAddToTray = () => {
    if (!recipe) return;
    addToTray({
      food_name: recipe.recipe_name,
      calories: Math.round(recipe.calories_per_serving),
      protein_g: parseFloat(recipe.protein_per_serving.toFixed(1)),
      carbs_g: parseFloat(recipe.carbs_per_serving.toFixed(1)),
      fat_g: parseFloat(recipe.fat_per_serving.toFixed(1)),
      fiber_g: parseFloat(recipe.fiber_per_serving.toFixed(1)),
      serving_g: 0,
      source: 'manual',
      serving_description: '1 serving',
    });
    Alert.alert('Added to meal tray', `${recipe.recipe_name} is ready to log.`, [
      { text: 'Keep browsing', style: 'cancel' },
      { text: 'View tray', onPress: () => router.push('/entry/log-food') },
    ]);
  };

  return (
    <View style={s.root}>
      <GradientBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </Pressable>
          <Text style={s.headerTitle} numberOfLines={1}>Recipe</Text>
          <View style={{ width: 26 }} />
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={ORANGE} />
          </View>
        ) : !recipe ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
            <Text style={s.emptyText}>We couldn't load this recipe. Try again later.</Text>
          </View>
        ) : (
          <>
            <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
              {recipe.recipe_image && (
                <Image source={{ uri: recipe.recipe_image }} style={s.heroImage} resizeMode="cover" />
              )}

              <View style={s.body}>
                <Text style={s.title}>{recipe.recipe_name}</Text>
                {!!recipe.recipe_description && (
                  <Text style={s.description}>{recipe.recipe_description}</Text>
                )}

                {/* Macro tiles */}
                <View style={s.macroRow}>
                  <MacroTile label="Calories" value={Math.round(recipe.calories_per_serving)} unit="cal" colors={colors} />
                  <MacroTile label="Protein"  value={Math.round(recipe.protein_per_serving)} unit="g" colors={colors} highlight />
                  <MacroTile label="Carbs"    value={Math.round(recipe.carbs_per_serving)} unit="g" colors={colors} />
                  <MacroTile label="Fat"      value={Math.round(recipe.fat_per_serving)} unit="g" colors={colors} />
                </View>

                {(recipe.prep_time_min != null || recipe.cook_time_min != null || recipe.number_of_servings != null) && (
                  <View style={s.timeRow}>
                    {recipe.prep_time_min != null && <Text style={s.timeText}>Prep {recipe.prep_time_min} min</Text>}
                    {recipe.cook_time_min != null && <Text style={s.timeText}>Cook {recipe.cook_time_min} min</Text>}
                    {recipe.number_of_servings != null && <Text style={s.timeText}>{recipe.number_of_servings} servings</Text>}
                  </View>
                )}

                {/* Ingredients */}
                {recipe.ingredients && recipe.ingredients.length > 0 && (
                  <View style={s.section}>
                    <Text style={s.sectionTitle}>Ingredients</Text>
                    {recipe.ingredients.map((ing, i) => (
                      <View key={i} style={s.ingredientRow}>
                        <Text style={s.bullet}>•</Text>
                        <Text style={s.bodyText}>{ing}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Directions */}
                {recipe.directions && recipe.directions.length > 0 && (
                  <View style={s.section}>
                    <Text style={s.sectionTitle}>Directions</Text>
                    {recipe.directions.map((step, i) => (
                      <View key={i} style={s.directionRow}>
                        <Text style={s.stepNumber}>{i + 1}</Text>
                        <Text style={s.bodyText}>{step}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={s.attribution}>
                  Recipe data powered by fatsecret Platform API.
                </Text>
              </View>
            </ScrollView>

            {/* Sticky CTA */}
            <View style={s.ctaWrap}>
              <Pressable
                onPress={handleAddToTray}
                style={({ pressed }) => [s.cta, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={s.ctaText}>Add to meal tray</Text>
              </Pressable>
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

function MacroTile({ label, value, unit, colors, highlight }: {
  label: string; value: number; unit: string; colors: AppColors; highlight?: boolean;
}) {
  const tc = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return (
    <View style={{
      flex: 1,
      borderRadius: 16,
      borderWidth: 0.5,
      borderColor: colors.border,
      backgroundColor: highlight ? 'rgba(255,116,42,0.10)' : colors.surface,
      paddingVertical: 14,
      alignItems: 'center',
    }}>
      <Text style={{
        fontSize: 11, color: tc(0.5), fontFamily: FF,
        textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '700',
      }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
        <Text style={{
          fontSize: 19, fontWeight: '800',
          color: highlight ? ORANGE : colors.textPrimary,
          fontFamily: FF, letterSpacing: -0.4,
          fontVariant: ['tabular-nums'],
        }}>
          {value}
        </Text>
        <Text style={{ fontSize: 11, color: tc(0.5), marginLeft: 2, fontFamily: FF }}>
          {unit}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (c: AppColors) => {
  const muted = c.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const subtle = c.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 12,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', fontFamily: FF },

    scrollContent: { paddingBottom: 120 },
    heroImage: { width: '100%', height: 240 },
    body: { paddingHorizontal: 20, paddingTop: 20 },

    title: {
      fontSize: 24, fontWeight: '800', color: c.textPrimary,
      letterSpacing: -0.5, fontFamily: FF, lineHeight: 30,
    },
    description: {
      fontSize: 14, color: muted, marginTop: 8, fontFamily: FF, lineHeight: 20,
    },

    macroRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
    timeRow: { flexDirection: 'row', gap: 16, marginTop: 14 },
    timeText: { fontSize: 13, color: muted, fontFamily: FF },

    section: { marginTop: 28 },
    sectionTitle: {
      fontSize: 17, fontWeight: '700', color: c.textPrimary,
      fontFamily: FF, marginBottom: 12, letterSpacing: -0.2,
    },
    ingredientRow: { flexDirection: 'row', paddingVertical: 6 },
    bullet: { width: 18, fontSize: 16, color: ORANGE, fontFamily: FF, fontWeight: '700' },
    directionRow: { flexDirection: 'row', paddingVertical: 8, gap: 10 },
    stepNumber: {
      width: 22, fontSize: 14, fontWeight: '700', color: ORANGE, fontFamily: FF,
    },
    bodyText: {
      flex: 1, fontSize: 14,
      color: c.isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)',
      fontFamily: FF, lineHeight: 22,
    },

    attribution: {
      fontSize: 11, color: subtle, marginTop: 32, textAlign: 'center', fontFamily: FF,
    },
    emptyText: {
      fontSize: 16, color: muted, textAlign: 'center', fontFamily: FF, lineHeight: 22,
    },

    ctaWrap: { position: 'absolute', bottom: 24, left: 20, right: 20 },
    cta: {
      backgroundColor: ORANGE,
      paddingVertical: 16,
      borderRadius: 28,
      alignItems: 'center',
      shadowColor: ORANGE,
      shadowOpacity: 0.3,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', fontFamily: FF, letterSpacing: -0.1 },
  });
};
