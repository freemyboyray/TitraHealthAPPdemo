import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { severityColor } from '@/constants/side-effects';

/**
 * Bare severity bar strip for the Symptom Log card — one thin bar per day,
 * left-aligned, no track behind it. Each value is the worst severity logged
 * that day on the 0–10 scale (or null when nothing was logged, which renders
 * as an empty column so the days stay evenly spaced).
 *
 * Bars are rounded only on top and meant to be clipped at the bottom by the
 * card, so they read as rising out of the card's bottom edge.
 */
export function SeverityBars({
  values,
  width,
  height = 44,
}: {
  /** One entry per day, oldest → newest. Severity 0–10, or null when no log. */
  values: (number | null)[];
  width: number;
  height?: number;
}) {
  const n = values.length || 1;
  const gap = 3;
  const barW = useMemo(() => Math.max(3, (width - gap * (n - 1)) / n), [width, n]);
  const minFill = 16; // a logged day always shows above the clipped bottom

  if (width <= 0) return <View style={{ width, height }} />;

  return (
    <View style={[styles.row, { width, height, gap }]}>
      {values.map((v, i) =>
        v == null ? (
          <View key={i} style={{ width: barW }} />
        ) : (
          <View
            key={i}
            style={{
              width: barW,
              height: Math.max(minFill, (v / 10) * height),
              borderTopLeftRadius: barW / 2,
              borderTopRightRadius: barW / 2,
              backgroundColor: severityColor(v),
            }}
          />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
});
