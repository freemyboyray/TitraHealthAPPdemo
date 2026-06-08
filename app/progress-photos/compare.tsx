import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useProgressPhotoStore, type ProgressPhoto } from '@/stores/progress-photo-store';
import { AlertCircle, ChevronLeft, MoveHorizontal, Plus } from 'lucide-react-native';


// ─── Constants ────────────────────────────────────────────────────────────────

const FF = 'System';
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const STAGE_W = SCREEN_W - 32;
// Portrait-ish stage, capped so the stats + film strip always fit on screen.
const STAGE_H = Math.min(Math.round(STAGE_W * 1.18), Math.round(SCREEN_H * 0.46));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeight(lbs: number): string {
  return `${lbs % 1 === 0 ? lbs : lbs.toFixed(1)}`;
}

function weeksBetween(aIso: string, bIso: string): number {
  const ms = Math.abs(new Date(bIso).getTime() - new Date(aIso).getTime());
  return Math.max(0, Math.round(ms / (7 * 86400000)));
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

  // ── Selected before/after photos (default: starting → tapped/latest) ──────
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<'before' | 'after'>('after');

  useEffect(() => {
    if (photos.length === 0) return;
    const oldest = photos[photos.length - 1];
    const newest = photos[0];
    setBeforeId((prev) => prev ?? (getStartingPhoto()?.id ?? oldest.id));
    setAfterId((prev) => prev ?? (photoId ?? newest.id));
  }, [photos, photoId]);

  const beforePhoto = useMemo(() => photos.find((p) => p.id === beforeId) ?? null, [photos, beforeId]);
  const afterPhoto = useMemo(() => photos.find((p) => p.id === afterId) ?? null, [photos, afterId]);

  // ── Signed URLs for every photo (stage + film strip) ──────────────────────
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      setLoading(true);
      const out: Record<string, string> = {};
      for (const p of photos) {
        const u = await getSignedUrl(p.photoUrl);
        if (cancelled) return;
        if (u) out[p.photoUrl] = u;
      }
      if (!cancelled) { setUrls(out); setLoading(false); }
    }
    if (photos.length > 0) resolve(); else setLoading(false);
    return () => { cancelled = true; };
  }, [photos, getSignedUrl]);

  const beforeUrl = beforePhoto ? urls[beforePhoto.photoUrl] : undefined;
  const afterUrl = afterPhoto ? urls[afterPhoto.photoUrl] : undefined;

  // ── Slider position (drag to reveal). Animated so dragging never re-renders ──
  const sliderX = useRef(new Animated.Value(STAGE_W / 2)).current;
  const setSlider = (x: number) => sliderX.setValue(Math.max(0, Math.min(STAGE_W, x)));

  // ── Stats ──────────────────────────────────────────────────────────────────
  const weightDelta = beforePhoto && afterPhoto ? afterPhoto.weightLbs - beforePhoto.weightLbs : null;
  const weeks = beforePhoto && afterPhoto ? weeksBetween(beforePhoto.takenAt, afterPhoto.takenAt) : 0;
  const lost = weightDelta !== null && weightDelta <= 0;

  const pickPhoto = (p: ProgressPhoto) => {
    if (activeSlot === 'before') setBeforeId(p.id);
    else setAfterId(p.id);
  };

  // ── Guard: need two photos ───────────────────────────────────────────────
  if (!loading && photos.length < 2) {
    return (
      <View style={[s.root, s.centered, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[s.backBtnLight, { position: 'absolute', top: insets.top + 12, left: 20 }]}
        >
          <ChevronLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <AlertCircle size={56} color={colors.orange} />
        <Text style={s.errorTitle}>Need Two Photos</Text>
        <Text style={s.errorDesc}>Add at least two progress photos to compare your before & after.</Text>
        <TouchableOpacity style={s.errorBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={s.errorBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.circleBtn} activeOpacity={0.75}>
          <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <ChevronLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Compare</Text>
        <TouchableOpacity onPress={() => router.push('/progress-photos/capture')} style={s.circleBtn} activeOpacity={0.75}>
          <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <Plus size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loadingContainer}><ActivityIndicator size="large" color={colors.orange} /></View>
      ) : (
        <View style={s.content}>
          {/* ── Before/After slider stage ── */}
          <View
            style={s.stage}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => setSlider(e.nativeEvent.locationX)}
            onResponderMove={(e) => setSlider(e.nativeEvent.locationX)}
          >
            {/* After = full bottom layer */}
            {afterUrl ? (
              <Image source={{ uri: afterUrl }} style={s.stageImg} resizeMode="cover" />
            ) : (
              <View style={[s.stageImg, s.stagePlaceholder]} />
            )}

            {/* Before = top layer, clipped to slider width */}
            <Animated.View style={[s.clip, { width: sliderX }]}>
              {beforeUrl ? (
                <Image source={{ uri: beforeUrl }} style={s.stageImg} resizeMode="cover" />
              ) : (
                <View style={[s.stageImg, s.stagePlaceholder]} />
              )}
            </Animated.View>

            {/* Corner tags */}
            <View style={[s.tag, s.tagL]}>
              <Text style={s.tagText}>
                {beforePhoto ? `${formatDate(beforePhoto.takenAt)} · ${formatWeight(beforePhoto.weightLbs)}` : 'Before'}
              </Text>
            </View>
            <View style={[s.tag, s.tagR]}>
              <Text style={s.tagText}>
                {afterPhoto ? `${formatDate(afterPhoto.takenAt)} · ${formatWeight(afterPhoto.weightLbs)}` : 'After'}
              </Text>
            </View>

            {/* Divider + handle */}
            <Animated.View style={[s.divider, { left: sliderX }]} pointerEvents="none" />
            <Animated.View style={[s.handle, { left: sliderX }]} pointerEvents="none">
              <MoveHorizontal size={18} color="#1A1A1A" />
            </Animated.View>
          </View>

          {/* ── Delta stats ── */}
          <View style={s.stats}>
            <Pressable style={s.statCol} onPress={() => setActiveSlot('before')}>
              <Text style={[s.statBig, activeSlot === 'before' && { color: colors.orange }]}>
                {beforePhoto ? formatWeight(beforePhoto.weightLbs) : '—'}
                <Text style={s.statUnit}> lbs</Text>
              </Text>
              <Text style={s.statSub}>{beforePhoto ? formatDate(beforePhoto.takenAt) : 'Before'}</Text>
            </Pressable>

            <View style={s.statMid}>
              {weightDelta !== null && (
                <Text style={[s.deltaBig, { color: lost ? '#34C759' : colors.textPrimary }]}>
                  {weightDelta <= 0 ? '−' : '+'}{formatWeight(Math.abs(weightDelta))}
                </Text>
              )}
              <Text style={s.deltaSub}>{weeks > 0 ? `${weeks} ${weeks === 1 ? 'week' : 'weeks'}` : 'lbs'}</Text>
            </View>

            <Pressable style={[s.statCol, { alignItems: 'flex-end' }]} onPress={() => setActiveSlot('after')}>
              <Text style={[s.statBig, activeSlot === 'after' && { color: colors.orange }]}>
                {afterPhoto ? formatWeight(afterPhoto.weightLbs) : '—'}
                <Text style={s.statUnit}> lbs</Text>
              </Text>
              <Text style={s.statSub}>{afterPhoto ? formatDate(afterPhoto.takenAt) : 'After'}</Text>
            </Pressable>
          </View>

          {/* ── Film strip ── */}
          <View style={s.stripHeader}>
            {/* Segmented selector — clearly shows which slot a photo tap will set */}
            <View style={s.segment}>
              <Pressable
                style={[s.segBtn, activeSlot === 'before' && s.segBtnActive]}
                onPress={() => setActiveSlot('before')}
              >
                <Text style={[s.segText, activeSlot === 'before' && s.segTextActive]}>Before (A)</Text>
              </Pressable>
              <Pressable
                style={[s.segBtn, activeSlot === 'after' && s.segBtnActive]}
                onPress={() => setActiveSlot('after')}
              >
                <Text style={[s.segText, activeSlot === 'after' && s.segTextActive]}>After (B)</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => router.push('/progress-photos?view=grid')} hitSlop={8}>
              <Text style={s.allPhotos}>All Photos ›</Text>
            </Pressable>
          </View>
          <Text style={s.stripHint}>
            Tap a photo to set the{' '}
            <Text style={{ color: colors.orange, fontWeight: '700' }}>
              {activeSlot === 'before' ? 'before (A)' : 'after (B)'}
            </Text>{' '}photo
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>
            {photos.map((p) => {
              const isBefore = p.id === beforeId;
              const isAfter = p.id === afterId;
              const uri = urls[p.photoUrl];
              return (
                <Pressable key={p.id} onPress={() => pickPhoto(p)} style={s.thumbWrap}>
                  <View
                    style={[
                      s.thumb,
                      isBefore && { borderColor: '#FFFFFF', borderWidth: 2 },
                      isAfter && { borderColor: colors.orange, borderWidth: 2 },
                    ]}
                  >
                    {uri ? (
                      <Image source={{ uri }} style={s.thumbImg} resizeMode="cover" />
                    ) : (
                      <View style={[s.thumbImg, s.stagePlaceholder]} />
                    )}
                  </View>
                  {(isBefore || isAfter) && (
                    <View style={[s.thumbTag, { backgroundColor: isAfter ? colors.orange : '#FFFFFF' }]}>
                      <Text style={[s.thumbTagText, { color: isAfter ? '#FFF' : '#1A1A1A' }]}>
                        {isAfter ? 'B' : 'A'}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },

    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12,
    },
    circleBtn: {
      width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
      alignItems: 'center', justifyContent: 'center', backgroundColor: w(0.08),
    },
    headerTitle: {
      flex: 1, textAlign: 'center', fontSize: 18, fontFamily: FF,
      fontWeight: '800', color: c.textPrimary, letterSpacing: -0.3,
    },

    content: { flex: 1, paddingHorizontal: 16 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    // Slider stage
    stage: {
      width: STAGE_W, height: STAGE_H, borderRadius: 20,
      overflow: 'hidden', backgroundColor: c.surface, alignSelf: 'center',
    },
    stageImg: { position: 'absolute', left: 0, top: 0, width: STAGE_W, height: STAGE_H },
    stagePlaceholder: { backgroundColor: c.surface },
    clip: { position: 'absolute', left: 0, top: 0, height: STAGE_H, overflow: 'hidden' },

    tag: {
      position: 'absolute', top: 12, zIndex: 5,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8,
    },
    tagL: { left: 12 },
    tagR: { right: 12 },
    tagText: { color: '#FFF', fontSize: 11, fontWeight: '800', fontFamily: FF, letterSpacing: 0.3 },

    divider: {
      position: 'absolute', top: 0, bottom: 0, width: 2,
      backgroundColor: '#FFFFFF', marginLeft: -1, zIndex: 6,
      shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 0 },
    },
    handle: {
      position: 'absolute', top: '50%', marginTop: -18, marginLeft: -18,
      width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF',
      alignItems: 'center', justifyContent: 'center', zIndex: 7,
      shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
    },

    // Stats
    stats: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 18, paddingHorizontal: 4,
    },
    statCol: { minWidth: 80 },
    statBig: { fontSize: 22, fontWeight: '800', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.5 },
    statUnit: { fontSize: 13, fontWeight: '700', color: c.textMuted },
    statSub: { fontSize: 12, color: c.textMuted, fontFamily: FF, marginTop: 2 },
    statMid: { alignItems: 'center' },
    deltaBig: { fontSize: 26, fontWeight: '900', fontFamily: FF, letterSpacing: -0.6 },
    deltaSub: { fontSize: 11, color: c.textMuted, fontFamily: FF, marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.5 },

    // Film strip
    stripHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 22, marginBottom: 8,
    },
    segment: {
      flexDirection: 'row', backgroundColor: w(0.07),
      borderRadius: 10, padding: 3,
    },
    segBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
    segBtnActive: { backgroundColor: c.orange },
    segText: { fontSize: 13, fontWeight: '700', color: c.textMuted, fontFamily: FF },
    segTextActive: { color: '#FFFFFF' },
    stripHint: {
      fontSize: 12.5, color: c.textMuted, fontFamily: FF, fontWeight: '500',
      marginLeft: 2, marginBottom: 10,
    },
    allPhotos: { fontSize: 13, fontWeight: '700', color: c.orange, fontFamily: FF },
    strip: { gap: 10, paddingRight: 8, paddingBottom: 8 },
    thumbWrap: { position: 'relative' },
    thumb: {
      width: 64, height: 82, borderRadius: 11, overflow: 'hidden',
      backgroundColor: c.surface, borderWidth: 0, borderColor: 'transparent',
    },
    thumbImg: { width: '100%', height: '100%' },
    thumbTag: {
      position: 'absolute', top: -5, right: -5,
      width: 20, height: 20, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: c.bg,
    },
    thumbTagText: { fontSize: 11, fontWeight: '900', fontFamily: FF },

    // Error state
    backBtnLight: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface,
    },
    errorTitle: { fontSize: 20, fontFamily: FF, fontWeight: '700', color: c.textPrimary, marginTop: 14, marginBottom: 8 },
    errorDesc: { fontSize: 14, fontFamily: FF, color: c.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    errorBtn: {
      width: '100%', height: 56, borderRadius: 28, backgroundColor: c.orange,
      alignItems: 'center', justifyContent: 'center',
    },
    errorBtnText: { fontSize: 16, fontFamily: FF, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  });
};
