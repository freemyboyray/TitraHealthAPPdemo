import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassBorder } from '@/components/ui/glass-border';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useHealthData } from '@/contexts/health-data';
import { daysSinceInjection } from '@/constants/scoring';
import { buildSystemPrompt, callOpenAI } from '@/lib/openai';
import { supabase } from '@/lib/supabase';
import { useUiStore } from '@/stores/ui-store';

const ORANGE = '#FF742A';
const SCREEN_HEIGHT = Dimensions.get('window').height;
const PANEL_HEIGHT = SCREEN_HEIGHT * 0.88;

// ─── Chip pools ───────────────────────────────────────────────────────────────

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

const INSIGHT_CHIPS = [
  'Tell me more about this',
  'Give me a detailed action plan',
  'What should I prioritize today?',
  'How does this relate to my medication phase?',
  'What progress should I expect?',
  'How can I improve this metric?',
];

const METRIC_CHIPS = [
  'How can I improve this?',
  'Is this typical for my phase?',
  'How does GLP-1 affect this?',
  'What does this mean for my health?',
  'Should I be concerned?',
  'What trends should I watch?',
];

const GENERIC_CHIPS = [
  'Analyze my recent health trends',
  'Why might I be feeling nauseous?',
  'What should I eat today?',
  'How is my medication working?',
  'Tips to improve my HRV score',
  'Help me understand my sleep data',
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  role: 'user' | 'assistant';
  content: string;
  contextLabel?: string;
  contextValue?: string;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function AiOrb({ blurTint }: { blurTint: 'dark' | 'light' }) {
  return (
    <View style={os.orbShadow}>
      <View style={os.orb}>
        <BlurView intensity={30} tint={blurTint} style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 40, backgroundColor: 'rgba(255,116,42,0.88)' }]} />
        <GlassBorder r={40} />
        <View style={os.orbShine} />
        <View style={os.orbShineSmall} />
      </View>
    </View>
  );
}

const os = StyleSheet.create({
  orbShadow: {
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 18, elevation: 10, marginBottom: 20,
  },
  orb: { width: 80, height: 80, borderRadius: 40, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  orbShine: { position: 'absolute', top: 12, right: 14, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.25)' },
  orbShineSmall: { position: 'absolute', top: 28, right: 22, width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.15)' },
});

// ─── Main overlay ─────────────────────────────────────────────────────────────

export function AiChatOverlay() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const { aiChatOpen, aiChatParams, closeAiChat } = useUiStore();
  const insets = useSafeAreaInsets();
  const healthData = useHealthData();
  const { profile } = healthData;

  // ─── Animation values ─────────────────────────────────────────────────────
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    if (aiChatOpen) {
      overlayOpacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, { damping: 26, stiffness: 280, mass: 0.8 });
    }
  }, [aiChatOpen]);

  function handleDismiss() {
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 320, easing: Easing.in(Easing.cubic) },
      () => runOnJS(closeAiChat)());
    overlayOpacity.value = withTiming(0, { duration: 280 });
  }

  const outerStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // ─── Chat state ───────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [pillVisible, setPillVisible] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const wasOpenRef = useRef(false);
  const seedSentRef = useRef(false);

  // ─── Load user ────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // ─── Reset + seed on open ─────────────────────────────────────────────────
  useEffect(() => {
    if (aiChatOpen && !wasOpenRef.current) {
      setMessages([]);
      setInputText('');
      setPromptIndex(0);
      setPillVisible(!!aiChatParams.contextLabel);
      seedSentRef.current = false;
    }
    wasOpenRef.current = aiChatOpen;
  }, [aiChatOpen]);

  // Auto-send seed message after state resets
  useEffect(() => {
    if (aiChatOpen && aiChatParams.seedMessage && !seedSentRef.current && messages.length === 0) {
      seedSentRef.current = true;
      sendMessage(aiChatParams.seedMessage);
    }
  }, [aiChatOpen, aiChatParams.seedMessage]);

  // ─── Auto-focus ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (aiChatOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [aiChatOpen]);

  // ─── Chip pool ────────────────────────────────────────────────────────────
  let chipPool: string[] = GENERIC_CHIPS;
  const { type, chips: chipsParam } = aiChatParams;
  if (chipsParam) {
    try {
      const parsed = JSON.parse(chipsParam);
      if (Array.isArray(parsed) && parsed.length > 0) chipPool = parsed;
    } catch {}
  } else if (type === 'insight' || type === 'focus') {
    chipPool = INSIGHT_CHIPS;
  } else if (type === 'metric') {
    chipPool = METRIC_CHIPS;
  } else if (type === 'recovery') {
    chipPool = RECOVERY_CHIPS;
  } else if (type === 'support') {
    chipPool = READINESS_CHIPS;
  }

  const maxPage = Math.floor((chipPool.length - 1) / 2);
  const currentPrompts = chipPool.slice(promptIndex * 2, promptIndex * 2 + 2);
  const handleRefresh = () => setPromptIndex(p => (p >= maxPage ? 0 : p + 1));

  // ─── System prompt ────────────────────────────────────────────────────────
  function makeSystemPrompt(): string {
    const isRecovery = type === 'recovery';
    const hasLegacyType = type === 'recovery' || type === 'support';
    const typeArg = hasLegacyType ? (isRecovery ? 'recovery' : 'support') : undefined;
    const base = buildSystemPrompt(healthData, typeArg);

    const { contextLabel, contextValue } = aiChatParams;
    if (pillVisible && contextLabel) {
      const focusBlock = [
        `FOCUS DIRECTIVE (highest priority):`,
        `The user is asking specifically about: ${contextLabel}${contextValue ? ` — current value: ${contextValue}` : ''}.`,
        `Your response MUST:`,
        `1. Directly address this specific metric/insight first — do not open with generic GLP-1 advice`,
        `2. Explain what this specific value means for this user's GLP-1 journey`,
        `3. Give 2–3 concrete, actionable steps tied directly to this metric`,
        `4. Reference the actual value (${contextValue ?? contextLabel}) in your response`,
        `Do NOT give a general health overview. Stay tightly focused on ${contextLabel}.`,
        ``,
      ].join('\n');
      return focusBlock + base;
    }
    return base;
  }

  // ─── Send message ─────────────────────────────────────────────────────────
  async function sendMessage(userText: string) {
    if (!userText.trim() || loading) return;
    const activeLabel = pillVisible && aiChatParams.contextLabel ? aiChatParams.contextLabel : undefined;
    const activeValue = pillVisible && aiChatParams.contextValue ? aiChatParams.contextValue : undefined;
    const newMessages: Message[] = [...messages, {
      role: 'user',
      content: userText,
      contextLabel: activeLabel,
      contextValue: activeValue,
    }];
    setMessages(newMessages);
    setInputText('');
    setLoading(true);

    if (userId) {
      supabase.from('chat_messages').insert({ user_id: userId, role: 'user', content: userText }).then(() => {});
    }

    try {
      const systemPrompt = makeSystemPrompt();
      const response = await callOpenAI(newMessages, systemPrompt);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      if (userId) {
        supabase.from('chat_messages').insert({ user_id: userId, role: 'assistant', content: response }).then(() => {});
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Unable to reach AI. Check your connection and try again.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  // ─── Phase label ──────────────────────────────────────────────────────────
  const dayNum = daysSinceInjection(profile.lastInjectionDate);
  const freq = profile.injectionFrequencyDays;
  const greetingLabel = aiChatParams.contextLabel
    ? `About your\n${aiChatParams.contextLabel}`
    : 'Good morning,\nHow can I help?';

  // Don't render at all if never opened
  if (!aiChatOpen && translateY.value === SCREEN_HEIGHT) {
    // Still need to mount so animations work; render but invisible
  }

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, { zIndex: 9999 }, outerStyle]}
      pointerEvents={aiChatOpen ? 'auto' : 'none'}
    >
      {/* Backdrop */}
      <Pressable style={StyleSheet.absoluteFillObject} onPress={handleDismiss}>
        <BlurView intensity={25} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
      </Pressable>

      {/* Panel */}
      <Animated.View style={[s.panelWrap, panelStyle]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={s.panel}>
            <BlurView intensity={75} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, s.panelOverlay]} />
            <GlassBorder r={28} />

            {/* Top bar */}
            <View style={s.topBar}>
              <Pressable onPress={handleDismiss} hitSlop={12} style={s.closeBtn}>
                <Ionicons name="close" size={22} color={colors.isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'} />
              </Pressable>
              <Text style={s.title}>Ask AI</Text>
              <View style={{ width: 44 }} />
            </View>

            {/* Content */}
            {messages.length === 0 && !loading ? (
              <>
                <View style={s.heroSection}>
                  <AiOrb blurTint={colors.blurTint} />
                  <Text style={s.greeting}>{greetingLabel}</Text>
                  <Text style={s.subtitle}>Choose a prompt or write your own</Text>
                </View>

                <View style={s.chipsRow}>
                  {currentPrompts.map((p) => (
                    <TouchableOpacity key={p} style={s.chipShadow} activeOpacity={0.75} onPress={() => setInputText(p)}>
                      <View style={s.chip}>
                        <BlurView intensity={30} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
                        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 16, backgroundColor: colors.glassOverlay }]} />
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
              <ScrollView
                ref={scrollRef}
                style={{ flex: 1 }}
                contentContainerStyle={s.chatContent}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
              >
                {messages.map((msg, i) => (
                  <View key={i} style={[s.bubbleRow, msg.role === 'user' ? s.bubbleRowUser : s.bubbleRowAssistant]}>
                    {msg.role === 'assistant' && (
                      <View style={s.bubbleAvatarWrap}>
                        <View style={s.bubbleAvatar} />
                      </View>
                    )}
                    <View style={[s.bubble, msg.role === 'user' ? s.bubbleUser : s.bubbleAssistant]}>
                      {msg.role === 'user' && msg.contextLabel && (
                        <>
                          <View style={s.bubbleContextTag}>
                            <View style={s.bubbleContextDot} />
                            <Text style={s.bubbleContextText} numberOfLines={1}>
                              {msg.contextLabel}{msg.contextValue ? ` · ${msg.contextValue}` : ''}
                            </Text>
                          </View>
                          <View style={s.bubbleContextDivider} />
                        </>
                      )}
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
                <View style={[s.inputCard, { backgroundColor: colors.surface }]}>
                  <BlurView intensity={30} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
                  <View style={[StyleSheet.absoluteFillObject, { borderRadius: 24, backgroundColor: colors.glassOverlay }]} />
                  <GlassBorder r={24} />
                  <View style={s.inputInner}>
                    {pillVisible && aiChatParams.contextLabel && (
                      <View style={s.inputPillRow}>
                        <View style={s.inputPillDot} />
                        <Text style={s.inputPillText} numberOfLines={1}>
                          {aiChatParams.contextLabel}{aiChatParams.contextValue ? ` · ${aiChatParams.contextValue}` : ''}
                        </Text>
                        <Pressable onPress={() => setPillVisible(false)} hitSlop={10} style={s.inputPillClose}>
                          <Ionicons name="close" size={13} color="rgba(255,116,42,0.7)" />
                        </Pressable>
                      </View>
                    )}
                    <TextInput
                      ref={inputRef}
                      style={s.textInput}
                      value={inputText}
                      onChangeText={setInputText}
                      placeholder="Ask anything about your health…"
                      placeholderTextColor={colors.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'}
                      multiline
                      returnKeyType="send"
                      onSubmitEditing={() => sendMessage(inputText)}
                    />
                    <View style={s.inputBottomRow}>
                      <View style={s.modePill}>
                        <Ionicons name="chevron-down" size={14} color={colors.textPrimary} style={{ marginRight: 3 }} />
                        <Text style={s.modePillText}>Coach</Text>
                      </View>
                      <View style={s.inputIcons}>
                        <TouchableOpacity activeOpacity={0.7} style={s.iconBtn}>
                          <Ionicons name="camera-outline" size={22} color={colors.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'} />
                        </TouchableOpacity>
                        <TouchableOpacity activeOpacity={0.7} style={s.iconBtn}>
                          <MaterialIcons name="attach-file" size={22} color={colors.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          activeOpacity={inputText.trim().length > 0 ? 0.7 : 1}
                          style={[s.iconBtn, s.sendBtn, inputText.trim().length > 0 && s.sendBtnActive]}
                          onPress={() => sendMessage(inputText)}
                        >
                          <Ionicons
                            name="arrow-up"
                            size={18}
                            color={inputText.trim().length > 0 ? '#000000' : (colors.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)')}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
              <Text style={s.disclaimer}>AI responses are not medical advice. Always consult your doctor.</Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const glassShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.3,
  shadowRadius: 24,
  elevation: 8,
};

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
  panelWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: PANEL_HEIGHT,
  },
  panel: {
    flex: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: c.bg,
  },
  panelOverlay: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: 'rgba(14,12,10,0.72)',
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: c.textPrimary,
    letterSpacing: -0.2,
  },

  heroSection: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: c.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 32,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: w(0.35),
    textAlign: 'center',
    fontWeight: '400',
  },

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
    color: c.textPrimary,
    textAlign: 'center',
    lineHeight: 18,
  },

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
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAssistant: { justifyContent: 'flex-start' },
  bubbleAvatarWrap: { marginBottom: 2 },
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
    borderColor: c.ringTrack,
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
  bubbleTextUser: { color: '#FFFFFF', fontWeight: '500' },
  bubbleTextAssistant: { color: w(0.85), fontWeight: '400' },

  bubbleContextTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  bubbleContextDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.6)', // on orange bubble — stays white
    flexShrink: 0,
  },
  bubbleContextText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)', // on orange bubble — stays white
    letterSpacing: 0.2,
    flex: 1,
  },
  bubbleContextDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.25)', // on orange bubble — stays white
    marginBottom: 8,
  },

  inputWrapper: { paddingHorizontal: 16 },
  inputCardShadow: { borderRadius: 24 },
  inputCard: { borderRadius: 24, overflow: 'hidden' },
  inputInner: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  inputPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,116,42,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,116,42,0.25)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
    gap: 7,
  },
  inputPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ORANGE,
    flexShrink: 0,
  },
  inputPillText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: ORANGE,
    letterSpacing: 0.3,
  },
  inputPillClose: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textInput: {
    fontSize: 15,
    color: c.textPrimary,
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
    backgroundColor: c.borderSubtle,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: w(0.10),
  },
  modePillText: { fontSize: 13, fontWeight: '600', color: c.textPrimary },
  inputIcons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { padding: 4 },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.borderSubtle,
  },
  sendBtnActive: { backgroundColor: ORANGE },
  disclaimer: {
    fontSize: 11,
    color: w(0.25),
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 15,
  },
  });
};
