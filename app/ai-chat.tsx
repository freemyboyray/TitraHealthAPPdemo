import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BG = '#141210';
const ORANGE = '#E8831A';
const DARK = '#FFFFFF';
const glassShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.3,
  shadowRadius: 24,
  elevation: 8,
};

const PROMPT_POOL = [
  'Analyze my recent health trends',
  'Why might I be feeling nauseous?',
  'What should I eat today?',
  'How is my medication working?',
  'Tips to improve my HRV score',
  'Help me understand my sleep data',
];

function GlassBorder({ r = 20 }: { r?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: r,
        borderWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.13)',
        borderLeftColor: 'rgba(255,255,255,0.08)',
        borderRightColor: 'rgba(255,255,255,0.03)',
        borderBottomColor: 'rgba(255,255,255,0.02)',
      }}
    />
  );
}

function AiOrb() {
  return (
    <View style={s.orbShadow}>
      <View style={s.orb}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 40, backgroundColor: 'rgba(232,131,26,0.88)' }]} />
        <GlassBorder r={40} />
        <View style={s.orbShine} />
        <View style={s.orbShineSmall} />
      </View>
    </View>
  );
}

export default function AiChatScreen() {
  const insets = useSafeAreaInsets();
  const [promptIndex, setPromptIndex] = useState(0);
  const [inputText, setInputText] = useState('');

  const currentPrompts = PROMPT_POOL.slice(promptIndex * 2, promptIndex * 2 + 2);
  const handleRefresh = () => setPromptIndex(p => (p + 1) % 3);
  const handlePromptPress = (p: string) => setInputText(p);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={DARK} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Ask AI</Text>
          <View style={s.headerSpacer} />
        </View>

        {/* Orb + Greeting */}
        <View style={s.heroSection}>
          <AiOrb />
          <Text style={s.greeting}>Good morning,{'\n'}How can I help?</Text>
          <Text style={s.subtitle}>Choose a prompt or write your own</Text>
        </View>

        {/* Prompt chips */}
        <View style={s.chipsRow}>
          {currentPrompts.map((p) => (
            <TouchableOpacity key={p} style={s.chipShadow} activeOpacity={0.75} onPress={() => handlePromptPress(p)}>
              <View style={s.chip}>
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
                <View style={[StyleSheet.absoluteFillObject, { borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)' }]} />
                <GlassBorder r={16} />
                <Text style={s.chipText}>{p}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Refresh prompts */}
        <TouchableOpacity style={s.refreshRow} onPress={handleRefresh} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={16} color={ORANGE} />
          <Text style={s.refreshText}>Refresh prompts</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {/* Input card */}
        <View style={[s.inputWrapper, { marginBottom: Math.max(insets.bottom, 12) + 4 }]}>
          <View style={[s.inputCardShadow, glassShadow]}>
            <View style={[s.inputCard, { backgroundColor: '#1E1B17' }]}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, { borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
              <GlassBorder r={24} />
              <View style={s.inputInner}>
                <TextInput
                  style={s.textInput}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Ask anything about your health…"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  multiline
                />
                <View style={s.inputBottomRow}>
                  <View style={s.modePill}>
                    <Ionicons name="chevron-down" size={14} color={DARK} style={{ marginRight: 3 }} />
                    <Text style={s.modePillText}>Coach</Text>
                  </View>
                  <View style={s.inputIcons}>
                    <TouchableOpacity activeOpacity={0.7} style={s.iconBtn}>
                      <Ionicons name="camera-outline" size={22} color="rgba(255,255,255,0.45)" />
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.7} style={s.iconBtn}>
                      <MaterialIcons name="attach-file" size={22} color="rgba(255,255,255,0.45)" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </View>
          <Text style={s.disclaimer}>AI responses are not medical advice. Always consult your doctor.</Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: DARK,
    letterSpacing: -0.2,
  },
  headerSpacer: { width: 40 },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  orbShadow: {
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
    marginBottom: 20,
  },
  orb: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbShine: {
    position: 'absolute',
    top: 12,
    right: 14,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  orbShineSmall: {
    position: 'absolute',
    top: 28,
    right: 22,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: DARK,
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 32,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
    fontWeight: '400',
  },

  // Chips
  chipsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  chipShadow: {
    flex: 1,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  chip: {
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: DARK,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Refresh
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 14,
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '600',
    color: ORANGE,
  },

  // Input
  inputWrapper: {
    paddingHorizontal: 16,
  },
  inputCardShadow: {
    borderRadius: 24,
  },
  inputCard: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  inputInner: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  textInput: {
    fontSize: 15,
    color: DARK,
    fontWeight: '400',
    lineHeight: 22,
    minHeight: 44,
    maxHeight: 120,
  },
  inputBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  modePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: DARK,
  },
  inputIcons: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    padding: 4,
  },
  disclaimer: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 15,
  },
});
