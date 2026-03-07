// NOTE: Set EXPO_PUBLIC_OPENAI_API_KEY in your .env to enable AI chat.
// Example: EXPO_PUBLIC_OPENAI_API_KEY=sk-proj-...

import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHealthData } from '@/contexts/health-data';
import { daysSinceInjection, getShotPhase } from '@/constants/scoring';
import { buildSystemPrompt, callOpenAI } from '@/lib/openai';

const BG = '#000000';
const ORANGE = '#FF742A';
const DARK = '#FFFFFF';

const glassShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.3,
  shadowRadius: 24,
  elevation: 8,
};

// ─── Type-aware prompt chips ──────────────────────────────────────────────────

const RECOVERY_CHIPS = [
  'Why is my HRV lower than usual?',
  'What can I do to sleep better tonight?',
  'Is my recovery score normal for peak phase?',
  'How does GLP-1 affect my resting heart rate?',
  'What causes low SpO₂ readings?',
  'Tips to improve deep sleep quality',
];

const READINESS_CHIPS = [
  'How much more protein should I eat?',
  'Why is hydration so important on GLP-1?',
  'What does my readiness score mean today?',
  'How do I hit my daily fiber target?',
  'Why should I log my injection?',
  'How does movement affect my score?',
];

const GENERIC_CHIPS = [
  'Analyze my recent health trends',
  'Why might I be feeling nauseous?',
  'What should I eat today?',
  'How is my medication working?',
  'Tips to improve my HRV score',
  'Help me understand my sleep data',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 40, backgroundColor: 'rgba(255,116,42,0.88)' }]} />
        <GlassBorder r={40} />
        <View style={s.orbShine} />
        <View style={s.orbShineSmall} />
      </View>
    </View>
  );
}

// ─── Message types ────────────────────────────────────────────────────────────

type Message = { role: 'user' | 'assistant'; content: string };

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AiChatScreen() {
  const insets = useSafeAreaInsets();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const isRecovery = type === 'recovery';
  const hasType = type === 'recovery' || type === 'support';

  const healthData = useHealthData();
  const { recoveryScore, supportScore, profile } = healthData;
  const score = isRecovery ? recoveryScore : supportScore;

  const dayNum = daysSinceInjection(profile.lastInjectionDate);
  const freq = profile.injectionFrequencyDays;
  const phaseLabel = (() => {
    if (dayNum === 1) return 'Shot Day';
    if (dayNum <= 3) return `Shot Phase · Day ${dayNum}`;
    if (dayNum < freq) return `Recovery Day ${dayNum}`;
    if (dayNum === freq) return 'Shot Day Tomorrow';
    return 'Shot Overdue';
  })();

  const chipPool = hasType ? (isRecovery ? RECOVERY_CHIPS : READINESS_CHIPS) : GENERIC_CHIPS;
  const [promptIndex, setPromptIndex] = useState(0);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const maxPage = Math.floor((chipPool.length - 1) / 2);
  const currentPrompts = chipPool.slice(promptIndex * 2, promptIndex * 2 + 2);
  const handleRefresh = () => setPromptIndex(p => (p >= maxPage ? 0 : p + 1));
  const handlePromptPress = (p: string) => setInputText(p);

  async function sendMessage(userText: string) {
    if (!userText.trim() || loading) return;
    const newMessages: Message[] = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setInputText('');
    setLoading(true);

    try {
      const systemPrompt = buildSystemPrompt(healthData, hasType ? (isRecovery ? 'recovery' : 'support') : undefined);
      const response = await callOpenAI(newMessages, systemPrompt);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Unable to reach AI. Check your connection and try again.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={DARK} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Ask AI</Text>
          <View style={s.headerSpacer} />
        </View>

        {/* Context strip — shown when navigated from a score detail screen */}
        {hasType && (
          <View style={s.contextStrip}>
            <View style={s.contextDot} />
            <Text style={s.contextText}>
              {isRecovery ? 'RECOVERY' : 'READINESS'} · {score}/100 · {phaseLabel}
            </Text>
          </View>
        )}

        {messages.length === 0 ? (
          /* Empty state: orb + greeting + chips */
          <>
            <View style={s.heroSection}>
              <AiOrb />
              <Text style={s.greeting}>Good morning,{'\n'}How can I help?</Text>
              <Text style={s.subtitle}>Choose a prompt or write your own</Text>
            </View>

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

            <TouchableOpacity style={s.refreshRow} onPress={handleRefresh} activeOpacity={0.7}>
              <Ionicons name="refresh-outline" size={16} color={ORANGE} />
              <Text style={s.refreshText}>Refresh prompts</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }} />
          </>
        ) : (
          /* Chat history */
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={s.chatContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.map((msg, i) => (
              <View
                key={i}
                style={[s.bubbleRow, msg.role === 'user' ? s.bubbleRowUser : s.bubbleRowAssistant]}
              >
                {msg.role === 'assistant' && (
                  <View style={s.bubbleAvatarWrap}>
                    <View style={s.bubbleAvatar} />
                  </View>
                )}
                <View style={[s.bubble, msg.role === 'user' ? s.bubbleUser : s.bubbleAssistant]}>
                  <Text style={[s.bubbleText, msg.role === 'user' ? s.bubbleTextUser : s.bubbleTextAssistant]}>
                    {msg.content}
                  </Text>
                </View>
              </View>
            ))}
            {loading && (
              <View style={[s.bubbleRow, s.bubbleRowAssistant]}>
                <View style={s.bubbleAvatarWrap}>
                  <View style={s.bubbleAvatar} />
                </View>
                <View style={[s.bubble, s.bubbleAssistant, s.bubbleLoading]}>
                  <ActivityIndicator size="small" color={ORANGE} />
                </View>
              </View>
            )}
          </ScrollView>
        )}

        {/* Input card */}
        <View style={[s.inputWrapper, { marginBottom: Math.max(insets.bottom, 12) + 4 }]}>
          <View style={[s.inputCardShadow, glassShadow]}>
            <View style={[s.inputCard, { backgroundColor: '#111111' }]}>
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
                  returnKeyType="send"
                  onSubmitEditing={() => sendMessage(inputText)}
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
                    <TouchableOpacity
                      activeOpacity={inputText.trim().length > 0 ? 0.7 : 1}
                      style={[s.iconBtn, s.sendBtn, inputText.trim().length > 0 && s.sendBtnActive]}
                      onPress={() => sendMessage(inputText)}
                    >
                      <Ionicons
                        name="arrow-up"
                        size={18}
                        color={inputText.trim().length > 0 ? '#000000' : 'rgba(255,255,255,0.25)'}
                      />
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

  // Context strip
  contextStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,116,42,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,116,42,0.30)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 12,
    gap: 6,
  },
  contextDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ORANGE,
  },
  contextText: {
    fontSize: 11,
    fontWeight: '700',
    color: ORANGE,
    letterSpacing: 0.8,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 24,
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

  // Chat bubbles
  chatContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 10,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowAssistant: {
    justifyContent: 'flex-start',
  },
  bubbleAvatarWrap: {
    marginBottom: 2,
  },
  bubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ORANGE,
    opacity: 0.85,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: ORANGE,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: '#1A1A1A',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderBottomLeftRadius: 4,
  },
  bubbleLoading: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  bubbleTextAssistant: {
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '400',
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
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 4,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sendBtnActive: {
    backgroundColor: ORANGE,
  },
  disclaimer: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 15,
  },
});
