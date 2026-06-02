// Fallback for Android and web — uses Lucide icons for consistent premium styling.
// iOS uses native SF Symbols via icon-symbol.ios.tsx.

import { SymbolWeight } from 'expo-symbols';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
  Home, List, BookOpen, Settings, Plus, X,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  ArrowUp, Zap, PersonStanding, FileText, Sun, Bell,
  Heart, Trash2, LogOut, Pencil, Utensils, Camera,
  ScanBarcode, Droplet, Activity, Dumbbell, Scale,
  Syringe, Pill, Leaf, HeartPulse, TriangleAlert,
  CircleCheck, Brain, Smile, Hospital, Search,
  TrendingDown, Mic, MessageCircle, User, BarChart3,
  Flame, CircleDashed, Percent, Sparkles, Info,
  Hand, HelpCircle, Paintbrush, Calendar, Check, RefreshCw,
} from 'lucide-react-native';

// ─── Fallback mapping: SF Symbol name → Lucide component ───────────────────

const MAPPING: Record<string, LucideIcon> = {
  // Tab bar & navigation
  'house.fill':       Home,
  'house':            Home,
  'list.bullet':      List,
  'book.fill':        BookOpen,
  'book':             BookOpen,
  'gearshape.fill':   Settings,
  'gearshape':        Settings,
  'plus':             Plus,
  'xmark':            X,
  'chevron.left':     ChevronLeft,
  'chevron.right':    ChevronRight,
  'chevron.up':       ChevronUp,
  'chevron.down':     ChevronDown,
  'arrow.up':         ArrowUp,

  // Settings
  'bolt.fill':        Zap,
  'figure.stand':     PersonStanding,
  'doc.text.fill':    FileText,
  'doc.text':         FileText,
  'sun.max.fill':     Sun,
  'bell.fill':        Bell,
  'heart.fill':       Heart,
  'trash.fill':       Trash2,
  'rectangle.portrait.and.arrow.right': LogOut,
  'pencil':           Pencil,
  'paintbrush.fill':  Paintbrush,
  'hand.raised.fill': Hand,
  'questionmark.circle.fill': HelpCircle,
  'info.circle':      Info,

  // Health / log / entry
  'fork.knife':       Utensils,
  'camera.fill':      Camera,
  'camera':           Camera,
  'barcode.viewfinder': ScanBarcode,
  'drop.fill':        Droplet,
  'figure.run':       Activity,
  'dumbbell.fill':    Dumbbell,
  'figure.strengthtraining.traditional': Dumbbell,
  'scalemass.fill':   Scale,
  'syringe.fill':     Syringe,
  'pills.fill':       Pill,
  'leaf.fill':        Leaf,
  'waveform.path.ecg': HeartPulse,
  'exclamationmark.triangle.fill': TriangleAlert,
  'checkmark.circle.fill': CircleCheck,
  'checkmark':        Check,
  'brain.head.profile': Brain,
  'face.smiling':     Smile,
  'cross.case.fill':  Hospital,
  'magnifyingglass':  Search,
  'chart.line.downtrend.xyaxis': TrendingDown,
  'mic.fill':         Mic,
  'bubble.left.fill': MessageCircle,
  'person.fill':      User,
  'chart.bar.fill':   BarChart3,
  'flame.fill':       Flame,
  'circle.dotted':    CircleDashed,
  'percent':          Percent,
  'sparkles':         Sparkles,
  'calendar':         Calendar,
  'arrow.triangle.2.circlepath': RefreshCw,

  // Legacy (kept for backward compat)
  'paperplane.fill':  ArrowUp,
  'chevron.left.forwardslash.chevron.right': BarChart3,
};

export type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SF Symbols on iOS, and Lucide
 * icons on Android and web for consistent premium styling.
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
  const Icon = MAPPING[name];
  if (!Icon) {
    return <HelpCircle size={size} color={color as string} style={style as any} />;
  }
  return <Icon size={size} color={color as string} style={style as any} />;
}
