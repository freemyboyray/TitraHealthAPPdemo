import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { GlassBorder } from '@/components/ui/glass-border';

const ORANGE = '#FF742A';
const FF = 'Helvetica Neue';

export type WeeklyCheckinCardProps = {
  label: string;
  subtitle: string;
  lastScore: number | null;
  lastLoggedAt: string | null;
  route: string;
  summaryRoute: string;
  sparklineData?: number[];
};

function scoreColor(score: number): string {
  if (score >= 70) return '#27AE60';
  if (score >= 50) return '#F6CB45';
  if (score >= 30) return '#E8960C';
  return '#E53E3E';
}

function SparkDot({ score, isLatest }: { score: number; isLatest: boolean }) {
  const color = scoreColor(score);
  const size = isLatest ? 10 : 7;
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color,
        opacity: isLatest ? 1 : 0.55,
      }}
    />
  );
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export function WeeklyCheckinCard({
  label,
  subtitle,
  lastScore,
  lastLoggedAt,
  route,
  summaryRoute,
  sparklineData,
}: WeeklyCheckinCardProps) {
  const router = useRouter();
  const isDone = lastLoggedAt != null && daysSince(lastLoggedAt) <= 6;

  const handlePress = () => router.push(route as any);

  if (!isDone) {
    // Pending state — show Check In button
    return (
      <TouchableOpacity
        style={[s.wrap, { shadowColor: ORANGE, shadowOpacity: 0.08 }]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
        <GlassBorder r={20} />
        <View style={s.inner}>
          <View style={s.leftCol}>
            <Text style={s.title}>{label}</Text>
            <Text style={s.subtitle}>{subtitle}</Text>
          </View>
          <View style={s.ctaBtn}>
            <Text style={s.ctaText}>Check In</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // Completed state — show score + sparkline + Review button
  const scoreVal = lastScore ?? 0;
  const color = scoreColor(scoreVal);
  const spark = sparklineData ? sparklineData.slice(-3) : [scoreVal];

  return (
    <View style={[s.wrap, { shadowColor: color, shadowOpacity: 0.1 }]}>
      <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
      <GlassBorder r={20} />
      <View style={s.inner}>
        <View style={s.leftCol}>
          <Text style={s.title}>{label}</Text>
          <View style={s.doneBadge}>
            <Text style={s.doneText}>Done this week</Text>
          </View>
          <TouchableOpacity
            style={s.reviewBtn}
            onPress={() => router.push(summaryRoute as any)}
            activeOpacity={0.7}
          >
            <Text style={s.reviewText}>Review</Text>
          </TouchableOpacity>
        </View>
        <View style={s.rightCol}>
          <Text style={[s.scoreText, { color }]}>{scoreVal}</Text>
          <Text style={s.scoreDenom}>/100</Text>
          {spark.length > 1 && (
            <View style={s.sparkRow}>
              {spark.map((v, i) => (
                <SparkDot key={i} score={v} isLatest={i === spark.length - 1} />
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#111111',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 20,
    elevation: 6,
    marginRight: 12,
    width: 200,
  },
  inner: {
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 88,
  },
  leftCol: { flex: 1, gap: 6 },
  title: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', fontFamily: FF },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: FF, lineHeight: 15 },
  ctaBtn: {
    backgroundColor: ORANGE, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 7, marginLeft: 8,
  },
  ctaText: { fontSize: 12, fontWeight: '700', color: '#FFF', fontFamily: FF },
  rightCol: { alignItems: 'flex-end', gap: 2, marginLeft: 8 },
  scoreText: { fontSize: 24, fontWeight: '800', lineHeight: 26, fontFamily: FF },
  scoreDenom: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: FF },
  sparkRow: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 4 },
  doneBadge: {
    backgroundColor: 'rgba(39,174,96,0.15)',
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  doneText: { fontSize: 10, fontWeight: '700', color: '#27AE60', fontFamily: FF },
  reviewBtn: {
    borderWidth: 1.5, borderColor: ORANGE, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 2,
  },
  reviewText: { fontSize: 11, fontWeight: '700', color: ORANGE, fontFamily: FF },
});
