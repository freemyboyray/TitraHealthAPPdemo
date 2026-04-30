import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GlassBorder } from '@/components/ui/glass-border';
import type { AppColors } from '@/constants/theme';
import { TYPE, cardElevation } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';

type Props = {
  description?: string;
  children: React.ReactNode;
};

export function MedicationGroupSection({ description, children }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={s.wrapper}>
      {description ? (
        <Text style={s.description}>{description}</Text>
      ) : null}
      <View style={s.container}>
        <GlassBorder r={16} isDark={colors.isDark} />
        {children}
      </View>
    </View>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  wrapper: {
    marginTop: 12,
  },
  description: {
    ...TYPE.caption1,
    color: c.textSecondary,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  container: {
    borderRadius: 16,
    backgroundColor: c.cardBg,
    overflow: 'hidden',
    ...cardElevation(c.isDark),
  },
});
