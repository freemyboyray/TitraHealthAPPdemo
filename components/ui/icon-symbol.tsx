// Fallback for using various icon libraries on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SymbolWeight } from 'expo-symbols';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

// ─── Fallback mapping: SF Symbol name → { icon name, library } ──────────────

type FallbackIcon = {
  name: string;
  library: 'MaterialIcons' | 'Ionicons' | 'FontAwesome5' | 'MaterialCommunityIcons';
};

const MAPPING: Record<string, FallbackIcon> = {
  // Tab bar & navigation
  'house.fill':       { name: 'home', library: 'Ionicons' },
  'house':            { name: 'home-outline', library: 'Ionicons' },
  'list.bullet':      { name: 'menu', library: 'MaterialIcons' },
  'book.fill':        { name: 'document', library: 'Ionicons' },
  'book':             { name: 'document-outline', library: 'Ionicons' },
  'gearshape.fill':   { name: 'settings', library: 'Ionicons' },
  'gearshape':        { name: 'settings-outline', library: 'Ionicons' },
  'plus':             { name: 'add', library: 'Ionicons' },
  'xmark':            { name: 'close', library: 'Ionicons' },
  'chevron.left':     { name: 'chevron-back', library: 'Ionicons' },
  'chevron.right':    { name: 'chevron-forward', library: 'Ionicons' },
  'chevron.up':       { name: 'chevron-up', library: 'Ionicons' },
  'chevron.down':     { name: 'chevron-down', library: 'Ionicons' },
  'arrow.up':         { name: 'arrow-up', library: 'Ionicons' },

  // Settings
  'bolt.fill':        { name: 'flash', library: 'Ionicons' },
  'figure.stand':     { name: 'body-outline', library: 'Ionicons' },
  'doc.text.fill':    { name: 'document-text-outline', library: 'Ionicons' },
  'doc.text':         { name: 'document-text-outline', library: 'Ionicons' },
  'sun.max.fill':     { name: 'sunny', library: 'Ionicons' },
  'moon.fill':        { name: 'moon', library: 'Ionicons' },
  'bell.fill':        { name: 'notifications-outline', library: 'Ionicons' },
  'heart.fill':       { name: 'heart', library: 'Ionicons' },
  'trash.fill':       { name: 'trash-outline', library: 'Ionicons' },
  'rectangle.portrait.and.arrow.right': { name: 'log-out-outline', library: 'Ionicons' },
  'pencil':           { name: 'pencil-outline', library: 'Ionicons' },

  // Health / log / entry
  'fork.knife':       { name: 'restaurant', library: 'MaterialIcons' },
  'camera.fill':      { name: 'camera-outline', library: 'Ionicons' },
  'camera':           { name: 'camera-outline', library: 'Ionicons' },
  'barcode.viewfinder': { name: 'barcode-outline', library: 'Ionicons' },
  'drop.fill':        { name: 'water-outline', library: 'Ionicons' },
  'figure.run':       { name: 'directions-run', library: 'MaterialIcons' },
  'figure.walk':      { name: 'directions-walk', library: 'MaterialIcons' },
  'dumbbell.fill':    { name: 'fitness-center', library: 'MaterialIcons' },
  'scalemass.fill':   { name: 'scale', library: 'MaterialCommunityIcons' },
  'syringe.fill':     { name: 'syringe', library: 'FontAwesome5' },
  'pills.fill':       { name: 'capsules', library: 'FontAwesome5' },
  'leaf.fill':        { name: 'leaf-outline', library: 'Ionicons' },
  'waveform.path.ecg': { name: 'show-chart', library: 'MaterialIcons' },
  'exclamationmark.triangle.fill': { name: 'warning-outline', library: 'Ionicons' },
  'checkmark.circle.fill': { name: 'checkmark-circle', library: 'Ionicons' },
  'brain.head.profile': { name: 'psychology', library: 'MaterialIcons' },
  'face.smiling':     { name: 'face', library: 'MaterialIcons' },
  'cross.case.fill':  { name: 'local-hospital', library: 'MaterialIcons' },
  'magnifyingglass':  { name: 'search', library: 'Ionicons' },
  'chart.line.downtrend.xyaxis': { name: 'trending-down', library: 'MaterialIcons' },
  'mic.fill':         { name: 'mic-outline', library: 'Ionicons' },
  'bubble.left.fill': { name: 'chatbubble-ellipses-outline', library: 'Ionicons' },
  'person.fill':      { name: 'person-outline', library: 'Ionicons' },
  'chart.bar.fill':   { name: 'analytics-outline', library: 'Ionicons' },

  // Legacy (kept for backward compat)
  'paperplane.fill':  { name: 'send', library: 'MaterialIcons' },
  'chevron.left.forwardslash.chevron.right': { name: 'code', library: 'MaterialIcons' },
};

export type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SF Symbols on iOS, and the best
 * matching icon library on Android and web.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const fallback = MAPPING[name];
  if (!fallback) {
    return <Ionicons name="help-circle-outline" size={size} color={color} style={style} />;
  }

  switch (fallback.library) {
    case 'Ionicons':
      return <Ionicons name={fallback.name as any} size={size} color={color} style={style} />;
    case 'FontAwesome5':
      return <FontAwesome5 name={fallback.name as any} size={size - 4} color={color} style={style} />;
    case 'MaterialCommunityIcons':
      return <MaterialCommunityIcons name={fallback.name as any} size={size} color={color} style={style} />;
    default:
      return <MaterialIcons name={fallback.name as any} size={size} color={color} style={style} />;
  }
}
