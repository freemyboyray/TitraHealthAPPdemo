import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useProgressPhotoStore, type ProgressPhoto } from '@/stores/progress-photo-store';


// ─── Constants ────────────────────────────────────────────────────────────────

const ORANGE = '#FF742A';
const FF = 'System';
const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 48) / 2;
const CARD_H = (CARD_W * 4) / 3;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProgressPhotosScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  const photos = useProgressPhotoStore((st) => st.photos);
  const loading = useProgressPhotoStore((st) => st.loading);
  const fetchPhotos = useProgressPhotoStore((st) => st.fetchPhotos);
  const getSignedUrl = useProgressPhotoStore((st) => st.getSignedUrl);

  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // ── Load photos & generate signed URLs ──────────────────────────────────────

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  useEffect(() => {
    let cancelled = false;
    async function resolveUrls() {
      const entries: [string, string][] = [];
      for (const photo of photos) {
        const url = await getSignedUrl(photo.photoUrl);
        if (cancelled) return;
        if (url) entries.push([photo.photoUrl, url]);
      }
      if (!cancelled) {
        setSignedUrls(Object.fromEntries(entries));
      }
    }
    if (photos.length > 0) resolveUrls();
    return () => { cancelled = true; };
  }, [photos, getSignedUrl]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleBack = useCallback(() => router.back(), []);
  const handleAdd = useCallback(() => router.push('/progress-photos/capture'), []);

  const handlePhotoPress = useCallback(
    (photo: ProgressPhoto) => {
      if (photos.length < 2) return;
      router.push({ pathname: '/progress-photos/compare', params: { photoId: photo.id } });
    },
    [photos.length],
  );

  // ── Date formatting ─────────────────────────────────────────────────────────

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderPhotoCard = useCallback(
    ({ item }: { item: ProgressPhoto }) => {
      const uri = signedUrls[item.photoUrl];

      const card = (
        <Pressable
          style={s.card}
          onPress={() => handlePhotoPress(item)}
          android_ripple={{ color: w(0.08) }}
        >
          <View style={s.imageWrap}>
            {uri ? (
              <Image source={{ uri }} style={s.image} resizeMode="cover" />
            ) : (
              <View style={[s.image, s.imagePlaceholder]}>
                <ActivityIndicator size="small" color={w(0.3)} />
              </View>
            )}

            {/* Starting badge */}
            {item.isStarting && (
              <View style={s.startingBadge}>
                <Text style={s.startingBadgeText}>STARTING</Text>
              </View>
            )}

            {/* Weight badge */}
            <View style={s.weightBadge}>
              <Text style={s.weightBadgeText}>{Math.round(item.weightLbs)} lbs</Text>
            </View>

            {/* Milestone badge */}
            {item.milestoneLbs != null && (
              <View style={s.milestoneBadge}>
                <Ionicons name="trophy" size={10} color="#FFF" />
                <Text style={s.milestoneBadgeText}>{item.milestoneLbs} lbs lost</Text>
              </View>
            )}
          </View>

          {/* Date */}
          <Text style={[s.dateText, { color: w(0.5) }]}>{formatDate(item.takenAt)}</Text>
        </Pressable>
      );

      return card;
    },
    [signedUrls, photos.length, s, w, handlePhotoPress],
  );

  const renderEmptyState = () => (
    <View style={s.emptyContainer}>
      <View style={[s.emptyIconCircle, { backgroundColor: w(0.06) }]}>
        <Ionicons name="camera-outline" size={48} color={w(0.25)} />
      </View>
      <Text style={[s.emptyTitle, { color: colors.textPrimary }]}>No photos yet</Text>
      <Text style={[s.emptySubtitle, { color: w(0.5) }]}>
        Take your first progress photo to start tracking your transformation
      </Text>
      <TouchableOpacity style={s.emptyCta} onPress={handleAdd} activeOpacity={0.75}>
        <Ionicons name="camera" size={18} color="#FFF" />
        <Text style={s.emptyCtaText}>Take Photo</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <View style={[s.root, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={handleBack} activeOpacity={0.7}>
          <BlurView
            intensity={40}
            tint={isDark ? 'dark' : 'light'}
            style={s.backBtn}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </BlurView>
        </TouchableOpacity>

        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Progress Photos</Text>

        <TouchableOpacity onPress={handleAdd} activeOpacity={0.7}>
          <BlurView
            intensity={40}
            tint={isDark ? 'dark' : 'light'}
            style={s.backBtn}
          >
            <Ionicons name="camera-outline" size={20} color={colors.textPrimary} />
          </BlurView>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading && photos.length === 0 ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      ) : photos.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          renderItem={renderPhotoCard}
          numColumns={2}
          contentContainerStyle={[s.grid, { paddingBottom: insets.bottom + 24 }]}
          columnWrapperStyle={s.row}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '700',
      fontFamily: FF,
      letterSpacing: -0.3,
    },

    // Loading
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Grid
    grid: {
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    row: {
      justifyContent: 'space-between',
      marginBottom: 16,
    },

    // Card
    card: {
      width: CARD_W,
    },
    imageWrap: {
      width: CARD_W,
      height: CARD_H,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    imagePlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },

    // Starting badge
    startingBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: ORANGE,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    startingBadgeText: {
      color: '#FFF',
      fontSize: 10,
      fontWeight: '800',
      fontFamily: FF,
      letterSpacing: 0.5,
    },

    // Weight badge
    weightBadge: {
      position: 'absolute',
      bottom: 8,
      left: 8,
      backgroundColor: 'rgba(0,0,0,0.6)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    weightBadgeText: {
      color: '#FFF',
      fontSize: 12,
      fontWeight: '700',
      fontFamily: FF,
    },

    // Milestone badge
    milestoneBadge: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: ORANGE,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 8,
    },
    milestoneBadgeText: {
      color: '#FFF',
      fontSize: 10,
      fontWeight: '700',
      fontFamily: FF,
    },

    // Date
    dateText: {
      fontSize: 12,
      fontFamily: FF,
      fontWeight: '500',
      marginTop: 6,
      marginLeft: 2,
    },

    // Empty state
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    emptyIconCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      fontFamily: FF,
      letterSpacing: -0.3,
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 15,
      fontFamily: FF,
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: 28,
    },
    emptyCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: ORANGE,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 28,
    },
    emptyCtaText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '700',
      fontFamily: FF,
    },
  });
}
