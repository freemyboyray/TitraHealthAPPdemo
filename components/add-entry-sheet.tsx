import { FontAwesome5, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
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
const DARK_TEXT = '#1A1A1A';
const GRAY_TEXT = '#999999';
const BLUE_DASH = '#5B9BD5';

type GridItem = {
  label: string;
  special?: boolean;
  iconEl?: React.ReactNode;
};

const ICON_SIZE = 24;
const ICON_COLOR = '#2A2A2A';

const GRID_ITEMS: GridItem[] = [
  {
    label: 'DESCRIBE FOOD',
    iconEl: <MaterialIcons name="restaurant" size={ICON_SIZE} color={ICON_COLOR} />,
  },
  {
    label: 'LOG INJECTION',
    iconEl: <FontAwesome5 name="syringe" size={ICON_SIZE} color={ICON_COLOR} />,
  },
  {
    label: 'CAPTURE FOOD',
    iconEl: <Ionicons name="camera-outline" size={ICON_SIZE} color={ICON_COLOR} />,
  },
  {
    label: 'SCAN FOOD',
    iconEl: <Ionicons name="barcode-outline" size={ICON_SIZE} color={ICON_COLOR} />,
  },
  { label: 'ASK AI', special: true },
  {
    label: 'SEARCH FOOD',
    iconEl: <Ionicons name="search-outline" size={ICON_SIZE} color={ICON_COLOR} />,
  },
  {
    label: 'LOG WEIGHT',
    iconEl: <MaterialCommunityIcons name="scale-bathroom" size={ICON_SIZE} color={ICON_COLOR} />,
  },
  {
    label: 'SIDE EFFECTS',
    iconEl: <Ionicons name="warning-outline" size={ICON_SIZE} color={ICON_COLOR} />,
  },
  {
    label: 'LOG ACTIVITY',
    iconEl: <MaterialIcons name="directions-run" size={ICON_SIZE} color={ICON_COLOR} />,
  },
];

function GridButton({ item }: { item: GridItem }) {
  return (
    <TouchableOpacity style={styles.gridItem} activeOpacity={0.7}>
      {item.special ? (
        <View style={[styles.iconCircle, styles.iconCircleSpecial]}>
          <View style={styles.sphereReflect} />
        </View>
      ) : (
        <View style={styles.iconCircle}>{item.iconEl}</View>
      )}
      <Text style={[styles.gridLabel, item.special && styles.gridLabelSpecial]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
}

export function AddEntrySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        {/* Sheet */}
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Add Entry</Text>
            <Text style={styles.subtitle}>What would you like to log today?</Text>
          </View>

          <View style={styles.dashedLine} />

          <View style={styles.grid}>
            {GRID_ITEMS.map((item) => (
              <GridButton key={item.label} item={item} />
            ))}
          </View>
        </View>

        {/* Bottom nav replicated with X on FAB */}
        <View style={[styles.navWrapper, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
          <View style={styles.tabBar}>
            <Ionicons name="home-outline" size={24} color="#AAAAAA" style={styles.navIcon} />
            <MaterialIcons name="menu" size={26} color="#AAAAAA" style={styles.navIcon} />
            <Ionicons name="document-outline" size={24} color="#AAAAAA" style={styles.navIcon} />
          </View>
          <TouchableOpacity style={styles.fab} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  sheet: {
    backgroundColor: '#F0EAE4',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#C8C0B8',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 22,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: DARK_TEXT,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: GRAY_TEXT,
  },
  dashedLine: {
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: BLUE_DASH,
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '33.33%',
    alignItems: 'center',
    marginBottom: 22,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  iconCircleSpecial: {
    backgroundColor: TERRACOTTA,
    overflow: 'hidden',
  },
  sphereReflect: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.3)',
    position: 'absolute',
    top: 12,
    right: 12,
  },
  gridLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: DARK_TEXT,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  gridLabelSpecial: {
    color: TERRACOTTA,
  },
  navWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: '#F0EAE4',
  },
  tabBar: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingVertical: 14,
    paddingHorizontal: 10,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navIcon: {
    flex: 1,
    textAlign: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: TERRACOTTA,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
    marginBottom: 4,
  },
});
