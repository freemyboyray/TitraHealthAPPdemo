import { LinearGradient } from 'expo-linear-gradient';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppColors } from '@/constants/theme';
import {
  Apple,
  Banana,
  Beef,
  Camera,
  Carrot,
  Cherry,
  Cookie,
  Croissant,
  CupSoda,
  Donut,
  EggFried,
  Fish,
  Grape,
  IceCreamCone,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  Utensils,
  X,
} from 'lucide-react-native';

const FF = 'System';

// Faded food icons that tile the top of the sheet (decorative only).
const GRID_ICONS = [
  Apple, Pizza, Carrot, EggFried, Fish,
  Salad, CupSoda, Cherry, Beef, Croissant,
  Banana, Sandwich, Soup, Grape, Cookie,
  IceCreamCone, Donut, Apple, Salad, Pizza,
];

type Props = {
  visible: boolean;
  colors: AppColors;
  isDark: boolean;
  /** Override the title (defaults to "Food not identified"). */
  title?: string;
  /** Override the body copy. */
  message?: string;
  /** Primary CTA label (defaults to "Describe it instead"). */
  primaryLabel?: string;
  onPrimary: () => void;
  onDismiss: () => void;
};

export function FoodNotIdentifiedModal({
  visible,
  colors,
  isDark,
  title = 'Food not identified',
  message = "We couldn't identify the food in your photo. Try a clearer photo, or describe your meal instead.",
  primaryLabel = 'Describe it instead',
  onPrimary,
  onDismiss,
}: Props) {
  const insets = useSafeAreaInsets();

  const scrim = isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)';
  const cardBg = colors.cardBg;
  const tileBg = colors.surfaceElevated;
  const gridColor = colors.textMuted;
  const grabber = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)';
  // Fade the decorative grid down into the sheet body (cardBg with alpha).
  const fadeColors = [`${cardBg}00`, `${cardBg}CC`, `${cardBg}FF`] as const;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={[s.root, { backgroundColor: scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

        <View style={[s.sheet, { backgroundColor: cardBg, borderColor: colors.borderSubtle, paddingBottom: insets.bottom + 18 }]}>
          <View style={[s.grabber, { backgroundColor: grabber }]} />

          {/* ── Decorative header: faded food-icon grid + the "no match" graphic ── */}
          <View style={s.headerArt}>
            <View style={s.grid} pointerEvents="none">
              {GRID_ICONS.map((Icon, i) => (
                <View key={i} style={s.gridCell}>
                  <Icon size={26} color={gridColor} strokeWidth={1.75} opacity={isDark ? 0.1 : 0.14} />
                </View>
              ))}
            </View>
            <LinearGradient colors={fadeColors} style={StyleSheet.absoluteFillObject} pointerEvents="none" />

            {/* photo  ✕  food */}
            <View style={s.graphicRow} pointerEvents="none">
              <View style={[s.tile, { backgroundColor: tileBg }]}>
                <Camera size={26} color={colors.textSecondary} strokeWidth={2} />
              </View>
              <View style={[s.xBadge, { backgroundColor: tileBg, borderColor: cardBg }]}>
                <X size={16} color={colors.orange} strokeWidth={3} />
              </View>
              <View style={[s.tile, { backgroundColor: tileBg }]}>
                <Utensils size={24} color={colors.textSecondary} strokeWidth={2} />
              </View>
            </View>
          </View>

          {/* ── Copy + actions ── */}
          <Text style={[s.title, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[s.body, { color: colors.textSecondary }]}>{message}</Text>

          <TouchableOpacity
            style={[s.btn, { backgroundColor: colors.orange }]}
            onPress={onPrimary}
            activeOpacity={0.85}
          >
            <Text style={s.btnPrimaryText}>{primaryLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.btnGhost} onPress={onDismiss} activeOpacity={0.7}>
            <Text style={[s.btnGhostText, { color: colors.textMuted }]}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 10,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 5,
    borderRadius: 3,
    marginBottom: 8,
  },
  headerArt: {
    height: 138,
    marginHorizontal: -24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  gridCell: {
    width: '20%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  graphicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -8,
    zIndex: 2,
    borderWidth: 3,
  },
  title: {
    fontSize: 23,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
    letterSpacing: -0.3,
    fontFamily: FF,
  },
  body: {
    fontSize: 14.5,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 4,
    fontFamily: FF,
  },
  btn: {
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    fontFamily: FF,
  },
  btnGhost: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  btnGhostText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FF,
  },
});
