import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useProgressPhotoStore } from '@/stores/progress-photo-store';


// ─── Constants ────────────────────────────────────────────────────────────────

const ORANGE = '#FF742A';
const FF = 'System';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_WIDTH = (SCREEN_WIDTH - 48) / 2;
const PHOTO_HEIGHT = (PHOTO_WIDTH * 4) / 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatWeight(lbs: number): string {
  return `${lbs % 1 === 0 ? lbs : lbs.toFixed(1)} lbs`;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ComparePhotosScreen() {
  const { photoId } = useLocalSearchParams<{ photoId: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const photos = useProgressPhotoStore((st) => st.photos);
  const getStartingPhoto = useProgressPhotoStore((st) => st.getStartingPhoto);
  const getSignedUrl = useProgressPhotoStore((st) => st.getSignedUrl);

  const startingPhoto = useMemo(() => getStartingPhoto(), [photos]);
  const afterPhoto = useMemo(
    () => photos.find((p) => p.id === photoId) ?? null,
    [photos, photoId],
  );

  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Load signed URLs on mount ────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [bUrl, aUrl] = await Promise.all([
        startingPhoto ? getSignedUrl(startingPhoto.photoUrl) : null,
        afterPhoto ? getSignedUrl(afterPhoto.photoUrl) : null,
      ]);
      if (!cancelled) {
        setBeforeUrl(bUrl);
        setAfterUrl(aUrl);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [startingPhoto, afterPhoto]);

  // ── Weight delta ─────────────────────────────────────────────────────────

  const weightDelta = useMemo(() => {
    if (!startingPhoto || !afterPhoto) return null;
    return afterPhoto.weightLbs - startingPhoto.weightLbs;
  }, [startingPhoto, afterPhoto]);

  // ── Error: photo not found ───────────────────────────────────────────────

  if (!afterPhoto) {
    return (
      <View style={[s.root, s.centered, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[s.backBtnLight, { position: 'absolute', top: insets.top + 12, left: 20 }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Ionicons name="alert-circle-outline" size={56} color={ORANGE} />
        <Text style={s.errorTitle}>Photo Not Found</Text>
        <Text style={s.errorDesc}>
          This photo could not be loaded. It may have been deleted.
        </Text>
        <TouchableOpacity style={s.errorBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={s.errorBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.circleBtn} activeOpacity={0.75}>
          <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Before &amp; After</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Comparison content */}
        <View style={s.content}>
          {loading ? (
            <View style={s.loadingContainer}>
              <ActivityIndicator size="large" color={ORANGE} />
            </View>
          ) : (
            <>
              {/* Photo pair */}
              <View style={s.photoRow}>
                {/* Before */}
                <View style={s.photoCol}>
                  <Text style={s.photoLabel}>Before</Text>
                  {startingPhoto && beforeUrl ? (
                    <Image
                      source={{ uri: beforeUrl }}
                      style={s.photo}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[s.photo, s.placeholder]}>
                      <Ionicons name="camera-outline" size={32} color={colors.textSecondary} />
                      <Text style={s.placeholderText}>No starting photo</Text>
                    </View>
                  )}
                  {startingPhoto && (
                    <View style={s.metaContainer}>
                      <Text style={s.metaWeight}>{formatWeight(startingPhoto.weightLbs)}</Text>
                      <Text style={s.metaDate}>{formatDate(startingPhoto.takenAt)}</Text>
                    </View>
                  )}
                </View>

                {/* After */}
                <View style={s.photoCol}>
                  <Text style={s.photoLabel}>After</Text>
                  {afterUrl ? (
                    <Image
                      source={{ uri: afterUrl }}
                      style={s.photo}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[s.photo, s.placeholder]}>
                      <ActivityIndicator size="small" color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={s.metaContainer}>
                    <Text style={s.metaWeight}>{formatWeight(afterPhoto.weightLbs)}</Text>
                    <Text style={s.metaDate}>{formatDate(afterPhoto.takenAt)}</Text>
                  </View>
                </View>
              </View>

              {/* Weight change banner */}
              {weightDelta !== null && startingPhoto && (
                <View style={s.banner}>
                  <Text style={s.bannerDelta}>
                    {weightDelta <= 0 ? '\u2212' : '+'}
                    {formatWeight(Math.abs(weightDelta))}
                  </Text>
                  <Text style={s.bannerSub}>
                    Start: {formatWeight(startingPhoto.weightLbs)} {'\u2192'} Now:{' '}
                    {formatWeight(afterPhoto.weightLbs)}
                  </Text>
                </View>
              )}

              {/* Share button */}
              <TouchableOpacity
                style={s.shareBtn}
                activeOpacity={0.85}
                onPress={() => {
                  // eslint-disable-next-line no-alert
                  alert('Coming soon');
                }}
              >
                <MaterialIcons name="share" size={20} color="#FFFFFF" />
                <Text style={s.shareBtnText}>Share</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 12,
    },
    circleBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: w(0.08),
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 18,
      fontFamily: FF,
      fontWeight: '800',
      color: c.textPrimary,
      letterSpacing: -0.3,
    },

    // Content
    content: {
      flex: 1,
      paddingHorizontal: 16,
      justifyContent: 'center',
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 80,
    },

    // Photo row
    photoRow: {
      flexDirection: 'row',
      gap: 16,
      justifyContent: 'center',
    },
    photoCol: {
      alignItems: 'center',
      width: PHOTO_WIDTH,
    },
    photoLabel: {
      fontSize: 13,
      fontFamily: FF,
      fontWeight: '700',
      color: c.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    photo: {
      width: PHOTO_WIDTH,
      height: PHOTO_HEIGHT,
      borderRadius: 16,
      backgroundColor: c.surface,
    },
    placeholder: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: w(0.08),
      borderStyle: 'dashed',
    },
    placeholderText: {
      fontSize: 13,
      fontFamily: FF,
      color: c.textSecondary,
      marginTop: 8,
    },

    // Meta below photos
    metaContainer: {
      alignItems: 'center',
      marginTop: 10,
    },
    metaWeight: {
      fontSize: 15,
      fontFamily: FF,
      fontWeight: '700',
      color: c.textPrimary,
    },
    metaDate: {
      fontSize: 12,
      fontFamily: FF,
      color: c.textSecondary,
      marginTop: 2,
    },

    // Weight change banner
    banner: {
      alignItems: 'center',
      marginTop: 28,
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 16,
      backgroundColor: c.surface,
    },
    bannerDelta: {
      fontSize: 28,
      fontFamily: FF,
      fontWeight: '900',
      color: ORANGE,
      letterSpacing: -0.5,
    },
    bannerSub: {
      fontSize: 14,
      fontFamily: FF,
      color: c.textSecondary,
      marginTop: 4,
    },

    // Share button
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      height: 52,
      paddingHorizontal: 32,
      borderRadius: 26,
      backgroundColor: ORANGE,
      marginTop: 24,
      gap: 8,
      shadowColor: ORANGE,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 18,
      elevation: 8,
    },
    shareBtnText: {
      fontSize: 16,
      fontFamily: FF,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },

    // Error state
    backBtnLight: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    errorTitle: {
      fontSize: 20,
      fontFamily: FF,
      fontWeight: '700',
      color: c.textPrimary,
      marginTop: 14,
      marginBottom: 8,
    },
    errorDesc: {
      fontSize: 14,
      fontFamily: FF,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    errorBtn: {
      width: '100%',
      height: 56,
      borderRadius: 28,
      backgroundColor: ORANGE,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: ORANGE,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 18,
      elevation: 8,
    },
    errorBtnText: {
      fontSize: 16,
      fontFamily: FF,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },
  });
};
