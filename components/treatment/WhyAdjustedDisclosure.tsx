import { useMemo, useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';

import { resolveTargetRationale, type TargetCitation } from '@/constants/target-rationale';
import { useAppTheme } from '@/contexts/theme-context';
import { ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react-native';

const FF = 'System';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  /** Target labels that changed (e.g. ['Protein', 'Carbs']). Aliases like
   *  'Daily Protein' / 'Active Calories' are normalized automatically. */
  labels: string[];
  /** Optional override for the trigger text. */
  title?: string;
};

/**
 * Collapsed-by-default "Why these changes?" disclosure. Expands to show a
 * plain-language rationale per changed target plus the clinical sources behind
 * them. Shown wherever we adjust a user's daily targets.
 */
export function WhyAdjustedDisclosure({ labels, title = 'Why these changes?' }: Props) {
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);

  // Resolve rationale per label and dedupe citations across them.
  const { entries, citations } = useMemo(() => {
    const seenLabels = new Set<string>();
    const entries: { label: string; rationale: string }[] = [];
    const citations: TargetCitation[] = [];
    for (const raw of labels) {
      const r = resolveTargetRationale(raw);
      if (!r) continue;
      const display = raw.replace(/^Daily\s+/i, '').trim();
      if (!seenLabels.has(display)) {
        seenLabels.add(display);
        entries.push({ label: display, rationale: r.rationale });
      }
      for (const c of r.citations) {
        if (!citations.some((x) => x.label === c.label)) citations.push(c);
      }
    }
    return { entries, citations };
  }, [labels]);

  const s = useMemo(() => createStyles(colors), [colors]);

  if (entries.length === 0) return null;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <View style={s.wrap}>
      <Pressable onPress={toggle} style={s.trigger} accessibilityRole="button">
        <Text style={s.triggerText}>{title}</Text>
        {expanded
          ? <ChevronUp size={16} color={w(0.45)} />
          : <ChevronDown size={16} color={w(0.45)} />}
      </Pressable>

      {expanded && (
        <View style={s.body}>
          {entries.map((e) => (
            <View key={e.label} style={s.rationaleRow}>
              <Text style={s.rationaleLabel}>{e.label}</Text>
              <Text style={s.rationaleText}>{e.rationale}</Text>
            </View>
          ))}

          {citations.length > 0 && (
            <View style={s.citationsBlock}>
              <View style={s.informedRow}>
                <ShieldCheck size={13} color={w(0.35)} />
                <Text style={s.informedLabel}>INFORMED BY</Text>
              </View>
              {citations.map((c) => (
                <View key={c.label} style={s.citationRow}>
                  <Text style={s.citationLabel}>{c.label}</Text>
                  <Text style={s.citationDesc}>{c.shortDesc}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={s.disclaimer}>
            General guidance, not medical advice. Always follow your healthcare provider.
          </Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) => {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    wrap: {
      marginTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: w(0.1),
    },
    trigger: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
    },
    triggerText: {
      fontSize: 15,
      fontWeight: '700',
      color: c.orange,
      fontFamily: FF,
    },
    body: {
      paddingBottom: 8,
    },
    rationaleRow: {
      marginBottom: 12,
    },
    rationaleLabel: {
      fontSize: 13,
      fontWeight: '800',
      color: c.textPrimary,
      fontFamily: FF,
      letterSpacing: 0.3,
      marginBottom: 3,
    },
    rationaleText: {
      fontSize: 14,
      color: w(0.5),
      fontFamily: FF,
      lineHeight: 19,
    },
    citationsBlock: {
      marginTop: 4,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: w(0.08),
    },
    informedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 8,
    },
    informedLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: w(0.35),
      fontFamily: FF,
      letterSpacing: 1,
    },
    citationRow: {
      marginBottom: 8,
    },
    citationLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: w(0.6),
      fontFamily: FF,
    },
    citationDesc: {
      fontSize: 13,
      color: w(0.4),
      fontFamily: FF,
      lineHeight: 17,
      marginTop: 1,
    },
    disclaimer: {
      fontSize: 11,
      color: w(0.3),
      fontFamily: FF,
      lineHeight: 15,
      marginTop: 8,
    },
  });
};
