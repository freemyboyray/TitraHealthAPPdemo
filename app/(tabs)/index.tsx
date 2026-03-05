import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTabBarVisibility } from '@/contexts/tab-bar-visibility';

const TERRACOTTA = '#D67455';
const DARK = '#1A1A1A';

const glassShadow = {
  shadowColor: '#1A1A1A',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 24,
  elevation: 8,
};

// ─── Glass primitives ─────────────────────────────────────────────────────────

function GlassBorder({ r = 28 }: { r?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: r,
        borderWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.80)',
        borderLeftColor: 'rgba(255,255,255,0.55)',
        borderRightColor: 'rgba(255,255,255,0.18)',
        borderBottomColor: 'rgba(255,255,255,0.10)',
      }}
    />
  );
}

// ─── Score Rings ──────────────────────────────────────────────────────────────
// Two concentric rings: outer = Exercise (terracotta), inner = Stand (dark)

function ScoreRings() {
  return (
    <View style={s.ringsContainer}>
      {/* Outer ring — Exercise */}
      <View style={s.ringOuter} />
      {/* Inner ring — Stand */}
      <View style={s.ringInner} />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { onScroll } = useTabBarVisibility();

  return (
    <View style={{ flex: 1, backgroundColor: '#F0EAE4' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >

          {/* ── Header ── */}
          <Text style={s.dateTitle}>October 24</Text>
          <Text style={s.dateSub}>Shot Day</Text>

          {/* ── Score Card — White Glass ── */}
          <View style={[s.cardWrap, { marginBottom: 16 }]}>
            <View style={s.cardBody}>
              <BlurView intensity={75} tint="light" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, s.whiteOverlay]} />
              <GlassBorder />
              <View style={s.scoreRow}>
                <ScoreRings />
                <View style={s.statsCol}>
                  {/* Exercise stat */}
                  <View style={s.statLabel}>
                    <View style={[s.dot, { backgroundColor: TERRACOTTA }]} />
                    <Text style={s.statName}>Exercise</Text>
                  </View>
                  <Text style={s.statValWrap}>
                    <Text style={s.statBold}>240</Text>
                    <Text style={s.statLight}>/600min</Text>
                  </Text>
                  {/* Stand stat */}
                  <View style={[s.statLabel, { marginTop: 20 }]}>
                    <View style={[s.dot, { backgroundColor: DARK }]} />
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
              icon: <MaterialIcons name="restaurant" size={22} color={TERRACOTTA} />,
              label: 'High Protein Meal',
              badge: '+3% Score',
            },
            {
              icon: <MaterialIcons name="trending-up" size={22} color={TERRACOTTA} />,
              label: '15 min Walk',
              badge: '+2% Score',
            },
            {
              icon: <Ionicons name="water-outline" size={22} color={TERRACOTTA} />,
              label: 'Hydration Goal',
              badge: '+1% Score',
            },
          ].map((item) => (
            <View key={item.label} style={[s.focusWrap, { marginBottom: 12 }]}>
              <View style={s.focusBody}>
                <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFillObject} />
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

  // Header
  dateTitle: { fontSize: 36, fontWeight: '800', color: DARK, textAlign: 'center', letterSpacing: -1, marginBottom: 4 },
  dateSub: { fontSize: 14, fontWeight: '500', color: '#888888', textAlign: 'center', marginBottom: 28 },

  // Glass card containers
  cardWrap: { borderRadius: 28, ...glassShadow },
  cardBody: { borderRadius: 28, overflow: 'hidden' },

  // Color overlays
  whiteOverlay: { borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.45)' },

  // Score row
  scoreRow: { flexDirection: 'row', alignItems: 'center', padding: 28 },

  // Score rings (concentric circles)
  ringsContainer: { width: 148, height: 148, alignItems: 'center', justifyContent: 'center' },
  ringOuter: {
    position: 'absolute',
    width: 148, height: 148, borderRadius: 74,
    borderWidth: 10, borderColor: TERRACOTTA,
    opacity: 0.9,
  },
  ringInner: {
    position: 'absolute',
    width: 108, height: 108, borderRadius: 54,
    borderWidth: 10, borderColor: DARK,
    opacity: 0.85,
  },

  // Stats (right of rings)
  statsCol: { flex: 1, paddingLeft: 24 },
  statLabel: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  dot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 8 },
  statName: { fontSize: 13, color: '#888888', fontWeight: '500' },
  statValWrap: { marginLeft: 15 },
  statBold: { fontSize: 24, fontWeight: '800', color: DARK, letterSpacing: -0.5 },
  statLight: { fontSize: 14, color: '#AAAAAA', fontWeight: '400' },

  // Insights card
  insightsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  insightsTitle: { fontSize: 17, fontWeight: '700', color: DARK },
  shotPhase: { fontSize: 10, fontWeight: '700', color: '#5B8BF5', letterSpacing: 1.2 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  bullet: { width: 7, height: 7, borderRadius: 3.5, marginRight: 10 },
  bulletText: { fontSize: 15, color: '#444444', fontWeight: '400' },
  insightsFooter: { fontSize: 12, color: '#AAAAAA', fontWeight: '500', marginTop: 6, lineHeight: 18 },

  // Section title
  sectionTitle: { fontSize: 22, fontWeight: '800', color: DARK, letterSpacing: -0.5, marginBottom: 14 },

  // Focus cards
  focusWrap: { borderRadius: 20, ...glassShadow },
  focusBody: { borderRadius: 20, overflow: 'hidden' },
  focusRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  focusIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(214,116,85,0.10)',
    borderWidth: 1, borderColor: 'rgba(214,116,85,0.18)',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  focusLabel: { flex: 1, fontSize: 16, fontWeight: '700', color: DARK },
  badge: {
    backgroundColor: 'rgba(50,168,82,0.12)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(50,168,82,0.25)',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#2B9450' },
});
