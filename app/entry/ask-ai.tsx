import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { callOpenAI, UsageLimitError } from '../../lib/openai';
import { UsageBadge } from '../../components/ui/usage-badge';
import { buildContextSnapshot } from '../../lib/context-snapshot';
import { supabase } from '../../lib/supabase';
import { computeScore } from '../../stores/insights-store';
import { useLogStore } from '../../stores/log-store';
import { useUserStore } from '../../stores/user-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const ORANGE = '#FF742A';
const MUTED = 'rgba(255,255,255,0.45)';

const SUGGESTION_PROMPTS = [
  'How am I doing this week?',
  'What should I eat today?',
  'Why am I feeling nauseous?',
];

function buildSystemPrompt(userName: string | null, contextSnapshot: string): string {
  return `You are a proactive GLP-1 medication companion${userName ? ` for ${userName}` : ''}. You don't just answer questions - you identify patterns, flag concerns, and create actionable plans. Be warm, specific, and evidence-based. Reference the user's actual data in your responses. Never diagnose or replace medical advice. Recommend consulting their provider for medical decisions.

${contextSnapshot}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlassBorder({ r = 16, topOnly = false }: { r?: number; topOnly?: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: topOnly ? 0 : r,
          borderWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.13)',
          borderLeftColor: topOnly ? 'transparent' : 'rgba(255,255,255,0.08)',
          borderRightColor: topOnly ? 'transparent' : 'rgba(255,255,255,0.03)',
          borderBottomColor: topOnly ? 'transparent' : 'rgba(255,255,255,0.02)',
        },
      ]}
    />
  );
}

function TypingIndicator({ colors }: { colors: AppColors }) {
  const s = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={s.typingRow}>
      <View style={s.assistantBubble}>
        <BlurView intensity={80} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
        <View style={s.assistantOverlay} />
        <GlassBorder r={18} />
        <Text style={s.typingDots}>• • •</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AskAIScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  // Store data for context
  const injectionLogs = useLogStore((s) => s.injectionLogs);
  const foodLogs = useLogStore((s) => s.foodLogs);
  const weightLogs = useLogStore((s) => s.weightLogs);
  const activityLogs = useLogStore((s) => s.activityLogs);
  const sideEffectLogs = useLogStore((s) => s.sideEffectLogs);
  const userGoals = useLogStore((s) => s.userGoals);
  const storeProfile = useLogStore((s) => s.profile);
  const userProfile = useUserStore((s) => s.profile);
  const profile = storeProfile ?? userProfile;
  const userName = profile?.username ?? null;

  const score = computeScore(injectionLogs, foodLogs, activityLogs, sideEffectLogs, userGoals, profile);
  const contextSnapshot = buildContextSnapshot({
    injectionLogs, foodLogs, weightLogs, activityLogs, sideEffectLogs,
    userGoals, profile, userName,
    score: { total: score.total, medication: score.medication, nutrition: score.nutrition, activity: score.activity },
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [typing, setTyping] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  // Load user + history
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingHistory(false); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(20);

      if (data) setMessages(data as Message[]);
      setLoadingHistory(false);
    }
    init();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, typing]);

  async function handleSend() {
    const text = input.trim();
    if (!text || typing) return;
    setInput('');

    const userMsg: Message = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setTyping(true);

    if (userId) {
      supabase.from('chat_messages').insert({ user_id: userId, role: 'user', content: text }).then(() => {});
    }

    try {
      const allMsgs = [...messages, userMsg];
      const contextMsgs = allMsgs.slice(-20).map((m) => ({ role: m.role, content: m.content }));
      const systemPrompt = buildSystemPrompt(userName, contextSnapshot);
      const reply = await callOpenAI(contextMsgs, systemPrompt);

      const assistantMsg: Message = {
        id: `local-${Date.now()}-a`,
        role: 'assistant',
        content: reply,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (userId) {
        supabase.from('chat_messages').insert({ user_id: userId, role: 'assistant', content: reply }).then(() => {});
      }
    } catch (err) {
      const isAuth = err instanceof Error && err.message === 'AUTH_EXPIRED';
      const isUsageLimit = err instanceof UsageLimitError;
      setMessages((prev) => [...prev, {
        id: `local-err-${Date.now()}`,
        role: 'assistant',
        content: isAuth
          ? "Your session has expired. Please sign out and sign back in to continue."
          : isUsageLimit
            ? `You've reached your ${err.limit} free messages for today. Upgrade to Titra Pro for unlimited AI coaching.`
            : "I'm having trouble connecting right now. Please try again in a moment.",
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setTyping(false);
    }
  }

  function sendSuggestion(prompt: string) {
    const userMsg: Message = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: prompt,
      created_at: new Date().toISOString(),
    };
    setMessages([userMsg]);
    setTyping(true);
    if (userId) {
      supabase.from('chat_messages').insert({ user_id: userId, role: 'user', content: prompt }).then(() => {});
    }
    const systemPrompt = buildSystemPrompt(userName, contextSnapshot);
    callOpenAI([{ role: 'user', content: prompt }], systemPrompt)
      .then((reply) => {
        const aMsg: Message = { id: `local-${Date.now()}-a`, role: 'assistant', content: reply, created_at: new Date().toISOString() };
        setMessages((prev) => [...prev, aMsg]);
        if (userId) supabase.from('chat_messages').insert({ user_id: userId, role: 'assistant', content: reply }).then(() => {});
      })
      .catch((err: unknown) => {
        const isAuth = err instanceof Error && err.message === 'AUTH_EXPIRED';
        const isUsageLimit = err instanceof UsageLimitError;
        setMessages((prev) => [...prev, {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: isAuth
            ? "Your session has expired. Please sign out and sign back in to continue."
            : isUsageLimit
              ? `You've reached your ${err.limit} free messages for today. Upgrade to Titra Pro for unlimited AI coaching.`
              : "I'm having trouble connecting. Please try again.",
          created_at: new Date().toISOString(),
        }]);
      })
      .finally(() => setTyping(false));
  }

  function renderMessage({ item }: { item: Message }) {
    const isUser = item.role === 'user';
    return (
      <View style={[s.msgRow, isUser ? s.msgRowUser : s.msgRowAssistant]}>
        {isUser ? (
          <View style={s.userBubble}>
            <Text style={s.userText}>{item.content}</Text>
          </View>
        ) : (
          <View style={s.assistantBubble}>
            <BlurView intensity={80} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
            <View style={s.assistantOverlay} />
            <GlassBorder r={18} />
            <Text style={s.assistantText}>{item.content}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backShadow} activeOpacity={0.75}>
          <View style={s.backClip}>
            <BlurView intensity={76} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, s.backOverlay]} />
            <GlassBorder r={20} />
            <Ionicons name="chevron-back" size={22} color={colors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
          </View>
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Ask AI</Text>
          <Text style={s.headerSubtitle}>GLP-1 Companion</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <UsageBadge feature="ai_chat" />
          <TouchableOpacity
            onPress={() => setShowDisclaimer(true)}
            style={s.infoBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="information-circle-outline" size={22} color={colors.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      {loadingHistory ? (
        <View style={s.loadingCenter}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[s.listContent, { paddingBottom: 16 }]}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Ionicons name="chatbubbles-outline" size={56} color={colors.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'} />
              <Text style={s.emptyTitle}>
                {userName ? `Hi, ${userName.split(' ')[0]}` : 'Your GLP-1 Companion'}
              </Text>
              <Text style={s.emptyDesc}>
                Ask anything about your GLP-1 journey - I have your latest data ready.
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chipsRow}
              >
                {SUGGESTION_PROMPTS.map((prompt) => (
                  <TouchableOpacity
                    key={prompt}
                    style={s.chip}
                    onPress={() => sendSuggestion(prompt)}
                    activeOpacity={0.75}
                  >
                    <Text style={s.chipText}>{prompt}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          }
          ListFooterComponent={typing ? <TypingIndicator colors={colors} /> : null}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Input bar */}
      <View style={[s.inputBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <BlurView intensity={80} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
        <View style={s.inputBarOverlay} />
        <GlassBorder topOnly />

        <View style={s.inputRow}>
          <View style={s.inputWrapper}>
            <BlurView intensity={70} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
            <View style={s.inputWrapperOverlay} />
            <GlassBorder r={22} />
            <TextInput
              style={s.textInput}
              placeholder="Ask anything about GLP-1…"
              placeholderTextColor={colors.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
          </View>

          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || typing) && s.sendBtnDisabled]}
            onPress={handleSend}
            activeOpacity={0.85}
            disabled={!input.trim() || typing}
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Disclaimer modal */}
      {showDisclaimer && (
        <TouchableOpacity
          style={s.disclaimerBackdrop}
          activeOpacity={1}
          onPress={() => setShowDisclaimer(false)}
        >
          <View style={s.disclaimerCard}>
            <BlurView intensity={85} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
            <View style={s.disclaimerOverlay} />
            <GlassBorder r={24} />
            <View style={s.disclaimerContent}>
              <Text style={s.disclaimerTitle}>Medical Disclaimer</Text>
              <Text style={s.disclaimerBody}>
                This AI provides general information about GLP-1 medications and is not a substitute for professional medical advice. Always consult your healthcare provider for medical decisions.
              </Text>
              <TouchableOpacity
                style={s.disclaimerBtn}
                onPress={() => setShowDisclaimer(false)}
                activeOpacity={0.85}
              >
                <Text style={s.disclaimerBtnText}>Got It</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  backShadow: {
    shadowColor: c.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  backClip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backOverlay: { borderRadius: 20, backgroundColor: c.borderSubtle },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 11, color: w(0.45), fontWeight: '500', letterSpacing: 0.5 },
  infoBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  listContent: { paddingHorizontal: 16, paddingTop: 8 },

  msgRow: { marginBottom: 10 },
  msgRowUser: { alignItems: 'flex-end' },
  msgRowAssistant: { alignItems: 'flex-start' },

  userBubble: {
    maxWidth: '80%',
    backgroundColor: ORANGE,
    borderRadius: 20,
    borderBottomRightRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  userText: { fontSize: 15, color: '#FFFFFF', lineHeight: 21 },

  assistantBubble: {
    maxWidth: '80%',
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 16,
    overflow: 'hidden',
    shadowColor: c.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  assistantOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.borderSubtle,
  },
  assistantText: { fontSize: 15, color: c.textPrimary, lineHeight: 21 },

  typingRow: { alignItems: 'flex-start', marginBottom: 10 },
  typingDots: { fontSize: 18, color: w(0.45), letterSpacing: 4 },

  // Input bar
  inputBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    overflow: 'hidden',
  },
  inputBarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  inputWrapper: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  inputWrapperOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.borderSubtle,
  },
  textInput: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: c.textPrimary,
    lineHeight: 20,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  sendBtnDisabled: { opacity: 0.45 },

  // Empty state
  emptyState: { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: c.textPrimary, marginTop: 16, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: w(0.45), textAlign: 'center', lineHeight: 20, marginBottom: 20 },

  // Suggestion chips
  chipsRow: { paddingVertical: 4, gap: 8, paddingHorizontal: 4 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,116,42,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,116,42,0.25)',
  },
  chipText: { fontSize: 13, fontWeight: '600', color: ORANGE },

  // Disclaimer
  disclaimerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  disclaimerCard: {
    width: '85%',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: c.shadowColor,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 12,
  },
  disclaimerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  disclaimerContent: { padding: 24 },
  disclaimerTitle: { fontSize: 18, fontWeight: '800', color: c.textPrimary, marginBottom: 12 },
  disclaimerBody: { fontSize: 14, color: w(0.45), lineHeight: 22, marginBottom: 20 },
  disclaimerBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimerBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  });
};
