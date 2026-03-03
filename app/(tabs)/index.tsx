import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TERRACOTTA = '#C4784B';
const WHITE = '#FFFFFF';
const DARK = '#1C0F09';

const glassShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.2,
  shadowRadius: 28,
  elevation: 12,
};

// ─── Background ──────────────────────────────────────────────────────────────

function AppBackground() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#D97040' }]} />
      <View style={s.blob1} />
      <View style={s.blob2} />
      <View style={s.blob3} />
      <View style={s.blob4} />
    </View>
  );
}

// ─── Glass primitives ─────────────────────────────────────────────────────────

function GlassBorder({ r = 28 }: { r?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: r,
        borderWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.72)',
        borderLeftColor: 'rgba(255,255,255,0.48)',
        borderRightColor: 'rgba(255,255,255,0.14)',
        borderBottomColor: 'rgba(255,255,255,0.08)',
      }}
    />
  );
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing() {
  return (
    <View style={s.ringOuter}>
      <View style={s.ringMiddle}>
        <View style={s.ringInner}>
          <Text style={s.scoreNum}>85</Text>
          <Text style={s.scoreLbl}>SCORE</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

          {/* ── Header ── */}
          <Text style={s.dateTitle}>October 24</Text>
          <Text style={s.dateSub}>Shot Day</Text>

          {/* ── Score Card — Terracotta Glass ── */}
          <View style={[s.cardWrap, { marginBottom: 16 }]}>
            <View style={[s.cardBody, { minHeight: 180 }]}>
              <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, s.terracottaOverlay]} />
              <GlassBorder />
              <View style={s.scoreRow}>
                <ScoreRing />
                <View style={s.statsCol}>
                  <View style={s.statLabel}>
                    <View style={[s.dot, { backgroundColor: WHITE }]} />
                    <Text style={s.statName}>Exercise</Text>
                  </View>
                  <Text style={s.statValWrap}>
                    <Text style={s.statBold}>240</Text>
                    <Text style={s.statLight}>/600min</Text>
                  </Text>
                  <View style={[s.statLabel, { marginTop: 18 }]}>
                    <View style={[s.dot, { backgroundColor: 'rgba(255,255,255,0.45)' }]} />
                    <Text style={s.statName}>Stand</Text>
                  </View>
                  <Text style={s.statValWrap}>
                    <Text style={s.statBold}>160</Text>
                    <Text style={s.statLight}>/600min</Text>
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Insights Card — White Glass ── */}
          <View style={[s.cardWrap, { marginBottom: 24 }]}>
            <View style={s.cardBody}>
              <BlurView intensity={55} tint="light" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, s.whiteOverlay]} />
              <GlassBorder />
              <View style={{ padding: 20 }}>
                <View style={s.insightsHead}>
                  <Text style={s.insightsTitle}>Insights</Text>
                  <Text style={s.shotPhase}>SHOT PHASE</Text>
                </View>
                <View style={s.bulletRow}>
                  <View style={[s.bullet, { backgroundColor: TERRACOTTA }]} />
                  <Text style={s.bulletText}>Increase protein by 20g today</Text>
                </View>
                <View style={s.bulletRow}>
                  <View style={[s.bullet, { backgroundColor: TERRACOTTA }]} />
                  <Text style={s.bulletText}>Drink 2 more liters of water</Text>
                </View>
                <Text style={s.insightsFooter}>
                  Levels are peaking. Focus on hydration to minimize side effects.
                </Text>
              </View>
            </View>
          </View>

          {/* ── Today's Focuses ── */}
          <Text style={s.sectionTitle}>Today's Focuses</Text>

          {[
            {
              icon: <Ionicons name="book-outline" size={22} color={TERRACOTTA} />,
              label: 'High Protein Meal',
              badge: '+3% Score',
            },
            {
              icon: <MaterialIcons name="trending-up" size={22} color={TERRACOTTA} />,
              label: '15 min Walk',
              badge: '+2% Score',
            },
          ].map((item) => (
            <View key={item.label} style={[s.focusWrap, { marginBottom: 12 }]}>
              <View style={s.focusBody}>
                <BlurView intensity={50} tint="light" style={StyleSheet.absoluteFillObject} />
                <View style={[StyleSheet.absoluteFillObject, s.whiteOverlay]} />
                <GlassBorder r={20} />
                <View style={s.focusRow}>
                  <View style={s.focusIconWrap}>{item.icon}</View>
                  <Text style={s.focusLabel}>{item.label}</Text>
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{item.badge}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 120 },

  // Background blobs
  blob1: { position: 'absolute', width: 380, height: 380, borderRadius: 190, top: -140, left: -110, backgroundColor: 'rgba(164, 54, 22, 0.65)' },
  blob2: { position: 'absolute', width: 280, height: 280, borderRadius: 140, top: 90, right: -80, backgroundColor: 'rgba(238, 124, 38, 0.52)' },
  blob3: { position: 'absolute', width: 230, height: 230, borderRadius: 115, top: 360, left: 40, backgroundColor: 'rgba(248, 170, 95, 0.48)' },
  blob4: { position: 'absolute', width: 360, height: 360, borderRadius: 180, bottom: -90, right: -70, backgroundColor: 'rgba(185, 68, 36, 0.42)' },

  // Header
  dateTitle: { fontSize: 36, fontWeight: '800', color: WHITE, textAlign: 'center', letterSpacing: -1, marginBottom: 4, textShadowColor: 'rgba(0,0,0,0.22)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  dateSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.72)', textAlign: 'center', letterSpacing: 3.5, textTransform: 'uppercase', marginBottom: 28 },

  // Glass card containers
  cardWrap: { borderRadius: 28, ...glassShadow },
  cardBody: { borderRadius: 28, overflow: 'hidden' },

  // Color overlays
  terracottaOverlay: { borderRadius: 28, backgroundColor: 'rgba(196, 90, 48, 0.60)' },
  whiteOverlay: { borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.14)' },

  // Score row
  scoreRow: { flexDirection: 'row', alignItems: 'center', padding: 22 },

  // Score ring
  ringOuter: { width: 138, height: 138, borderRadius: 69, borderWidth: 2.5, borderColor: WHITE, alignItems: 'center', justifyContent: 'center' },
  ringMiddle: { width: 114, height: 114, borderRadius: 57, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  ringInner: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontSize: 36, fontWeight: '800', color: WHITE, letterSpacing: -1.5, lineHeight: 40 },
  scoreLbl: { fontSize: 9, color: 'rgba(255,255,255,0.88)', letterSpacing: 2.8, fontWeight: '600', textTransform: 'uppercase' },

  // Stats
  statsCol: { flex: 1, paddingLeft: 22 },
  statLabel: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  dot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 7 },
  statName: { fontSize: 13, color: 'rgba(255,255,255,0.78)', fontWeight: '500' },
  statValWrap: { marginLeft: 14 },
  statBold: { fontSize: 26, fontWeight: '800', color: WHITE },
  statLight: { fontSize: 15, color: 'rgba(255,255,255,0.65)', fontWeight: '400' },

  // Insights card
  insightsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  insightsTitle: { fontSize: 17, fontWeight: '700', color: DARK },
  shotPhase: { fontSize: 10, fontWeight: '700', color: TERRACOTTA, letterSpacing: 1.2 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  bullet: { width: 7, height: 7, borderRadius: 3.5, marginRight: 10 },
  bulletText: { fontSize: 15, color: DARK, fontWeight: '400' },
  insightsFooter: { fontSize: 13, color: 'rgba(28,15,9,0.52)', marginTop: 6, lineHeight: 19 },

  // Section title
  sectionTitle: { fontSize: 24, fontWeight: '800', color: WHITE, letterSpacing: -0.5, marginBottom: 14, textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },

  // Focus cards
  focusWrap: { borderRadius: 20, ...glassShadow, shadowOpacity: 0.14, shadowRadius: 18 },
  focusBody: { borderRadius: 20, overflow: 'hidden' },
  focusRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  focusIconWrap: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.38)', borderWidth: 1, borderTopColor: 'rgba(255,255,255,0.7)', borderLeftColor: 'rgba(255,255,255,0.5)', borderRightColor: 'rgba(255,255,255,0.18)', borderBottomColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  focusLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: DARK },
  badge: { backgroundColor: 'rgba(50,168,82,0.18)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(50,168,82,0.35)' },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#2B9450' },
});
