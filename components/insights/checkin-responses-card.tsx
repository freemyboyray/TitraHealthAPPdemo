import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { SolidCard } from '@/components/ui/solid-card';
import type { AppColors } from '@/constants/theme';
import {
  CHECKIN_ASSETS, CHECKIN_QUESTIONS, CHECKIN_SCALE_LABELS, DOMAIN_BY_KEY,
  type CheckinDomainKey,
} from '@/constants/checkin-domains';

const FF = 'System';

/**
 * One section's check-in responses: the asset + label, then each question with
 * the answer the user gave (a 1–5 segment meter + its word, e.g. "Often").
 * `answers` is the stored {q1,q2,q3} map, 0–4 each.
 */
export function CheckinResponsesCard({
  domainKey, answers, colors,
}: {
  domainKey: CheckinDomainKey;
  answers: Record<string, number>;
  colors: AppColors;
}) {
  const meta = DOMAIN_BY_KEY[domainKey];
  const questions = CHECKIN_QUESTIONS[domainKey];
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  const s = styles(colors);

  return (
    <SolidCard radius={24} style={{ marginBottom: 12 }}>
      <View style={{ padding: 18 }}>
        <View style={s.head}>
          <Image source={CHECKIN_ASSETS[domainKey]} style={s.asset} resizeMode="contain" accessibilityIgnoresInvertColors />
          <Text style={s.label}>{meta.label}</Text>
        </View>

        {questions.map((q, i) => {
          const value = answers[`q${i + 1}`] ?? 0;
          return (
            <View key={i} style={{ marginTop: i === 0 ? 4 : 18 }}>
              <Text style={s.question}>{q}</Text>
              <View style={s.answerRow}>
                <View style={s.meter}>
                  {[0, 1, 2, 3, 4].map((seg) => (
                    <View
                      key={seg}
                      style={[s.seg, { backgroundColor: seg <= value ? meta.color : w(0.1) }]}
                    />
                  ))}
                </View>
                <Text style={s.answerWord}>{CHECKIN_SCALE_LABELS[value]}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </SolidCard>
  );
}

const styles = (c: AppColors) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  asset: { width: 40, height: 40 },
  label: { fontSize: 17, fontWeight: '800', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.3, flexShrink: 1 },

  question: { fontSize: 15, fontWeight: '600', color: c.textPrimary, fontFamily: FF, lineHeight: 20 },
  answerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  meter: { flexDirection: 'row', gap: 5, flex: 1 },
  seg: { flex: 1, height: 6, borderRadius: 3 },
  answerWord: { width: 80, textAlign: 'right', fontSize: 14, fontWeight: '700', color: c.textPrimary, fontFamily: FF },
});
