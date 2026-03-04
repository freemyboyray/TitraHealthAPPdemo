import { FontAwesome5, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TERRACOTTA = '#C4784B';
const DARK = '#1C0F09';
const ICON_SIZE = 24;
const ICON_COLOR = '#2A1A12';

type GridItem = {
  label: string;
  special?: boolean;
  icon?: React.ReactNode;
};

const GRID: GridItem[] = [
  { label: 'DESCRIBE FOOD', icon: <MaterialIcons name="restaurant" size={ICON_SIZE} color={ICON_COLOR} /> },
  { label: 'LOG INJECTION', icon: <FontAwesome5 name="syringe" size={ICON_SIZE} color={ICON_COLOR} /> },
  { label: 'CAPTURE FOOD', icon: <Ionicons name="camera-outline" size={ICON_SIZE} color={ICON_COLOR} /> },
  { label: 'SCAN FOOD', icon: <Ionicons name="barcode-outline" size={ICON_SIZE} color={ICON_COLOR} /> },
  { label: 'ASK AI', special: true },
  { label: 'SEARCH FOOD', icon: <Ionicons name="search-outline" size={ICON_SIZE} color={ICON_COLOR} /> },
  { label: 'LOG WEIGHT', icon: <MaterialCommunityIcons name="scale-bathroom" size={ICON_SIZE} color={ICON_COLOR} /> },
  { label: 'SIDE EFFECTS', icon: <Ionicons name="warning-outline" size={ICON_SIZE} color={ICON_COLOR} /> },
  { label: 'LOG ACTIVITY', icon: <MaterialIcons name="directions-run" size={ICON_SIZE} color={ICON_COLOR} /> },
];

// ─── Glass border overlay ──────────────────────────────────────────────────────

function GlassBorder({ r = 24 }: { r?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: r, borderWidth: 1, borderTopColor: 'rgba(255,255,255,0.72)', borderLeftColor: 'rgba(255,255,255,0.48)', borderRightColor: 'rgba(255,255,255,0.14)', borderBottomColor: 'rgba(255,255,255,0.08)' }}
    />
  );
}

// ─── Grid button ───────────────────────────────────────────────────────────────

function GridBtn({ item }: { item: GridItem }) {
  return (
    <TouchableOpacity style={s.gridItem} activeOpacity={0.7}>
      {item.special ? (
        <View style={s.specialCircle}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 32, backgroundColor: 'rgba(196,90,48,0.85)' }]} />
          <GlassBorder r={32} />
          <View style={s.sphereShine} />
          <View style={s.sphereShineSmall} />
        </View>
      ) : (
        <View style={s.iconCircle}>
          <GlassBorder r={32} />
          {item.icon}
        </View>
      )}
      <Text style={[s.gridLabel, item.special && s.gridLabelSpecial]}>{item.label}</Text>
    </TouchableOpacity>
  );
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

export function AddEntrySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>

        {/* Backdrop */}
        <Pressable style={s.backdrop} onPress={onClose} />

        {/* Sheet — heavy frosted glass */}
        <View style={s.sheetShadow}>
          <View style={s.sheetBody}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: 'rgba(255,255,255,0.35)' }]} />
            {/* Top glass border only */}
            <View pointerEvents="none" style={s.sheetTopBorder} />

            {/* Content */}
            <View style={s.sheetContent}>
              {/* Handle */}
              <View style={s.handle} />

              {/* Header */}
              <Text style={s.title}>Add Entry</Text>
              <Text style={s.subtitle}>What would you like to log today?</Text>

              {/* Dashed divider */}
              <View style={s.dash} />

              {/* Grid */}
              <View style={s.grid}>
                {GRID.map((item) => <GridBtn key={item.label} item={item} />)}
              </View>
            </View>
          </View>
        </View>

        {/* Bottom nav — glass pill + FAB X */}
        <View style={[s.navWrapper, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
          <View style={s.navPillShadow}>
            <View style={s.navPillInner}>
              <BlurView intensity={75} tint="light" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, { borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.18)' }]} />
              <View pointerEvents="none" style={s.pillBorder} />
              <View style={s.navIcons}>
                <Ionicons name="home-outline" size={24} color="rgba(0,0,0,0.4)" style={s.navIcon} />
                <MaterialIcons name="menu" size={26} color="rgba(0,0,0,0.4)" style={s.navIcon} />
                <Ionicons name="document-outline" size={24} color="rgba(0,0,0,0.4)" style={s.navIcon} />
              </View>
            </View>
          </View>
          <TouchableOpacity style={s.fabClose} onPress={onClose} activeOpacity={0.85}>
            <View style={s.fabInner}>
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, { borderRadius: 31, backgroundColor: 'rgba(196,90,48,0.92)' }]} />
              <View pointerEvents="none" style={s.fabBorder} />
              <Ionicons name="close" size={32} color="#FFF" />
            </View>
          </TouchableOpacity>
        </View>

      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },

  // Sheet
  sheetShadow: { borderTopLeftRadius: 28, borderTopRightRadius: 28, shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.22, shadowRadius: 28, elevation: 16 },
  sheetBody: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  sheetTopBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.65)' },
  sheetContent: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8 },

  handle: { width: 44, height: 4, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 2, alignSelf: 'center', marginBottom: 22 },
  title: { fontSize: 24, fontWeight: '800', color: DARK, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 14, color: 'rgba(28,15,9,0.5)', fontWeight: '400', marginBottom: 18 },
  dash: { borderBottomWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(80,130,210,0.6)', marginBottom: 22 },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: '33.33%', alignItems: 'center', marginBottom: 24 },

  // Icon circles
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },

  // ASK AI sphere
  specialCircle: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowColor: TERRACOTTA, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 6 },
  sphereShine: { position: 'absolute', top: 10, right: 12, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.32)' },
  sphereShineSmall: { position: 'absolute', top: 22, right: 18, width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)' },

  gridLabel: { fontSize: 10, fontWeight: '700', color: DARK, letterSpacing: 0.4, textAlign: 'center' },
  gridLabelSpecial: { color: TERRACOTTA },

  // Bottom nav
  navWrapper: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 8, backgroundColor: 'transparent' },
  navPillShadow: { flex: 1, marginRight: 14, borderRadius: 36, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 10 },
  navPillInner: { borderRadius: 36, overflow: 'hidden' },
  pillBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 36, borderWidth: 1, borderTopColor: 'rgba(255,255,255,0.7)', borderLeftColor: 'rgba(255,255,255,0.45)', borderRightColor: 'rgba(255,255,255,0.12)', borderBottomColor: 'rgba(255,255,255,0.06)' },
  navIcons: { flexDirection: 'row', paddingVertical: 15, paddingHorizontal: 10 },
  navIcon: { flex: 1, textAlign: 'center' },

  fabClose: { width: 62, height: 62, borderRadius: 31, shadowColor: TERRACOTTA, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.7, shadowRadius: 16, elevation: 10, marginBottom: 2 },
  fabInner: { width: 62, height: 62, borderRadius: 31, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fabBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 31, borderWidth: 1.5, borderTopColor: 'rgba(255,210,170,0.65)', borderLeftColor: 'rgba(255,200,160,0.4)', borderRightColor: 'rgba(0,0,0,0.12)', borderBottomColor: 'rgba(0,0,0,0.18)' },
});
