import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TERRACOTTA = '#C4784B';
const BG = '#F0EAE4';
const WHITE = '#FFFFFF';
const DARK_TEXT = '#1A1A1A';
const GRAY_TEXT = '#999999';
const GREEN = '#4CAF50';

function ScoreRing() {
  return (
    <View style={styles.ringOuter}>
      <View style={styles.ringMiddle}>
        <View style={styles.ringInner}>
          <Text style={styles.scoreNumber}>85</Text>
          <Text style={styles.scoreLabel}>SCORE</Text>
        </View>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={styles.dateTitle}>October 24</Text>
        <Text style={styles.dateSubtitle}>Shot Day</Text>

        {/* Score Card */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreCardRow}>
            <ScoreRing />
            <View style={styles.statsCol}>
              <View style={styles.statLabelRow}>
                <View style={[styles.dot, { backgroundColor: WHITE }]} />
                <Text style={styles.statLabelText}>Exercise</Text>
              </View>
              <Text style={styles.statValueRow}>
                <Text style={styles.statBold}>240</Text>
                <Text style={styles.statLight}>/600min</Text>
              </Text>
              <View style={[styles.statLabelRow, { marginTop: 18 }]}>
                <View style={[styles.dot, { backgroundColor: 'rgba(255,255,255,0.5)' }]} />
                <Text style={styles.statLabelText}>Stand</Text>
              </View>
              <Text style={styles.statValueRow}>
                <Text style={styles.statBold}>160</Text>
                <Text style={styles.statLight}>/600min</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Insights Card */}
        <View style={styles.insightsCard}>
          <View style={styles.insightsHeader}>
            <Text style={styles.insightsTitle}>Insights</Text>
            <Text style={styles.shotPhase}>SHOT PHASE</Text>
          </View>
          <View style={styles.bulletRow}>
            <View style={[styles.bullet, { backgroundColor: TERRACOTTA }]} />
            <Text style={styles.bulletText}>Increase protein by 20g today</Text>
          </View>
          <View style={styles.bulletRow}>
            <View style={[styles.bullet, { backgroundColor: TERRACOTTA }]} />
            <Text style={styles.bulletText}>Drink 2 more liters of water</Text>
          </View>
          <Text style={styles.insightsFooter}>
            Levels are peaking. Focus on hydration to minimize side effects.
          </Text>
        </View>

        {/* Today's Focuses */}
        <Text style={styles.sectionTitle}>Today's Focuses</Text>

        <View style={styles.focusCard}>
          <View style={styles.focusIconWrap}>
            <Ionicons name="book-outline" size={22} color={TERRACOTTA} />
          </View>
          <Text style={styles.focusLabel}>High Protein Meal</Text>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreBadgeText}>+3% Score</Text>
          </View>
        </View>

        <View style={styles.focusCard}>
          <View style={styles.focusIconWrap}>
            <MaterialIcons name="trending-up" size={22} color={TERRACOTTA} />
          </View>
          <Text style={styles.focusLabel}>15 min Walk</Text>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreBadgeText}>+2% Score</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 110 },

  dateTitle: { fontSize: 26, fontWeight: '700', color: DARK_TEXT, textAlign: 'center' },
  dateSubtitle: {
    fontSize: 15,
    color: GRAY_TEXT,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 20,
  },

  scoreCard: { backgroundColor: TERRACOTTA, borderRadius: 20, padding: 22, marginBottom: 16 },
  scoreCardRow: { flexDirection: 'row', alignItems: 'center' },

  ringOuter: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringMiddle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: { fontSize: 32, fontWeight: '700', color: WHITE, lineHeight: 36 },
  scoreLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 2,
    fontWeight: '500',
  },

  statsCol: { flex: 1, paddingLeft: 20 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  statLabelText: { fontSize: 14, color: WHITE },
  statValueRow: { marginLeft: 15 },
  statBold: { fontSize: 22, fontWeight: '700', color: WHITE },
  statLight: { fontSize: 15, color: 'rgba(255,255,255,0.8)' },

  insightsCard: { backgroundColor: WHITE, borderRadius: 16, padding: 18, marginBottom: 24 },
  insightsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  insightsTitle: { fontSize: 17, fontWeight: '700', color: DARK_TEXT },
  shotPhase: { fontSize: 11, fontWeight: '600', color: GRAY_TEXT, letterSpacing: 0.6 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  bullet: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  bulletText: { fontSize: 15, color: DARK_TEXT },
  insightsFooter: { fontSize: 13, color: GRAY_TEXT, marginTop: 6, lineHeight: 19 },

  sectionTitle: { fontSize: 20, fontWeight: '700', color: DARK_TEXT, marginBottom: 14 },
  focusCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  focusIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#FAF0EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  focusLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: DARK_TEXT },
  scoreBadge: {
    backgroundColor: '#EBF7EC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  scoreBadgeText: { fontSize: 12, fontWeight: '600', color: GREEN },
});
