import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassBorder } from '@/components/ui/glass-border';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useHealthData } from '@/contexts/health-data';
import { buildSystemPrompt, callOpenAI, callGPT4oMiniVision, UsageLimitError } from '@/lib/openai';
import { supabase } from '@/lib/supabase';
import { useUiStore } from '@/stores/ui-store';

const ORANGE = '#FF742A';
const SESSION_GAP_MS = 30 * 60 * 1000; // 30 min gap = new conversation

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  role: 'user' | 'assistant';
  content: string;
  contextLabel?: string;
  contextValue?: string;
  imageUri?: string;
  isError?: boolean;
  retryText?: string;
  retryImageBase64?: string;
};

type HistoryMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

type Conversation = {
  id: string;              // first message id
  messages: HistoryMessage[];
  startedAt: string;       // ISO timestamp of first message
  preview: string;         // first user message (truncated)
  messageCount: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupIntoConversations(flat: HistoryMessage[]): Conversation[] {
  if (flat.length === 0) return [];

  const convs: Conversation[] = [];
  let current: HistoryMessage[] = [flat[0]];

  for (let i = 1; i < flat.length; i++) {
    const prevTs = new Date(flat[i - 1].created_at).getTime();
    const currTs = new Date(flat[i].created_at).getTime();
    if (currTs - prevTs > SESSION_GAP_MS) {
      convs.push(buildConv(current));
      current = [flat[i]];
    } else {
      current.push(flat[i]);
    }
  }
  convs.push(buildConv(current));

  // Most recent first
  return convs.reverse();
}

function buildConv(msgs: HistoryMessage[]): Conversation {
  const firstUser = msgs.find(m => m.role === 'user');
  return {
    id: msgs[0].id,
    messages: msgs,
    startedAt: msgs[0].created_at,
    preview: firstUser?.content ?? '…',
    messageCount: msgs.length,
  };
}

function formatConvDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);

  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Yesterday, ${time}`;
  if (diffDays < 7) {
    return `${d.toLocaleDateString([], { weekday: 'long' })}, ${time}`;
  }
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

// ─── Typing bubble ────────────────────────────────────────────────────────────

function TypingBubble() {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(dot, { toValue: -6, duration: 260, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 260, useNativeDriver: true }),
          Animated.delay((2 - i) * 140 + 100),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 5, paddingHorizontal: 14, paddingVertical: 14 }}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: 'rgba(255,116,42,0.7)',
            transform: [{ translateY: dot }],
          }}
        />
      ))}
    </View>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

export function AiChatOverlay() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const { aiChatOpen, aiChatParams, closeAiChat } = useUiStore();
  const insets = useSafeAreaInsets();
  const healthData = useHealthData();

  // ─── Animation values ─────────────────────────────────────────────────────
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const inputTranslateY = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (aiChatOpen) {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(inputTranslateY, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]).start();
    }
  }, [aiChatOpen]);

  function handleDismiss() {
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(inputTranslateY, { toValue: 40, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      closeAiChat();
      overlayOpacity.setValue(0);
      inputTranslateY.setValue(40);
    });
  }

  // ─── Chat state ───────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showUpgradeCard, setShowUpgradeCard] = useState(false);
  const [pillVisible, setPillVisible] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<{ uri: string; base64: string } | null>(null);
  const [resumedFrom, setResumedFrom] = useState<string | null>(null); // date label of resumed conv
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const wasOpenRef = useRef(false);

  // ─── History state ────────────────────────────────────────────────────────
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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
      setInputText(aiChatParams.seedMessage ?? '');
      setPendingImage(null);
      setShowHistory(false);
      setResumedFrom(null);
      setPillVisible(!!aiChatParams.contextLabel);
    }
    wasOpenRef.current = aiChatOpen;
  }, [aiChatOpen]);

  // ─── Auto-focus ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (aiChatOpen && !showHistory) {
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [aiChatOpen, showHistory]);

  // ─── Load history when panel opens ────────────────────────────────────────
  useEffect(() => {
    if (!showHistory || !userId) return;
    setHistoryLoading(true);
    supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        const flat = (data ?? []) as HistoryMessage[];
        setConversations(groupIntoConversations(flat));
        setHistoryLoading(false);
      });
  }, [showHistory, userId]);

  // ─── Resume a conversation ─────────────────────────────────────────────────
  function resumeConversation(conv: Conversation) {
    const mapped: Message[] = conv.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
    setMessages(mapped);
    setResumedFrom(formatConvDate(conv.startedAt));
    setShowHistory(false);
    // Scroll to end after layout
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 120);
  }

  // ─── System prompt ────────────────────────────────────────────────────────
  function makeSystemPrompt(): string {
    const { type } = aiChatParams;
    const hasLegacyType = type === 'recovery' || type === 'support';
    const typeArg = hasLegacyType ? (type as 'recovery' | 'support') : undefined;
    const base = buildSystemPrompt(healthData, typeArg);

    const { contextLabel, contextValue } = aiChatParams;
    if (pillVisible && contextLabel) {
      const focusBlock = [
        `FOCUS DIRECTIVE (highest priority):`,
        `Topic: ${contextLabel}${contextValue ? ` (${contextValue})` : ''}.`,
        `Reply in 1–2 sentences MAX. Be analytical and trend-aware - call out what the number means and whether it's moving in the right direction. Be brief and encouraging. No lists, no preamble, no generic GLP-1 advice. Reference the actual value directly.`,
        ``,
      ].join('\n');
      return focusBlock + base;
    }
    return base;
  }

  // ─── Image pickers ────────────────────────────────────────────────────────
  async function handlePickCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'] as any,
      base64: true,
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]?.base64 && result.assets[0]?.uri) {
      setPendingImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  }

  async function handlePickLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      base64: true,
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]?.base64 && result.assets[0]?.uri) {
      setPendingImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  }

  // ─── Send message ─────────────────────────────────────────────────────────
  async function sendMessage(userText: string) {
    if ((!userText.trim() && !pendingImage) || loading) return;
    const text = userText.trim() || 'What is this?';
    const activeLabel = pillVisible && aiChatParams.contextLabel ? aiChatParams.contextLabel : undefined;
    const activeValue = pillVisible && aiChatParams.contextValue ? aiChatParams.contextValue : undefined;
    const imageUri = pendingImage?.uri;
    const imageBase64 = pendingImage?.base64;

    const newMsg: Message = {
      role: 'user',
      content: text,
      contextLabel: activeLabel,
      contextValue: activeValue,
      imageUri,
    };
    const newMessages: Message[] = [...messages, newMsg];
    setMessages(newMessages);
    setInputText('');
    setPendingImage(null);
    setLoading(true);

    if (userId) {
      supabase.from('chat_messages').insert({ user_id: userId, role: 'user', content: text }).then(() => {});
    }

    try {
      const systemPrompt = makeSystemPrompt();
      let response: string;
      if (imageBase64) {
        response = await callGPT4oMiniVision(systemPrompt, imageBase64, text);
      } else {
        response = await callOpenAI(newMessages, systemPrompt);
      }
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      if (userId) {
        supabase.from('chat_messages').insert({ user_id: userId, role: 'assistant', content: response }).then(() => {});
      }
    } catch (err: unknown) {
      const isAuth = err instanceof Error && err.message === 'AUTH_EXPIRED';
      const isUsageLimit = err instanceof UsageLimitError;
      if (isUsageLimit) {
        setShowUpgradeCard(true);
      } else if (isAuth) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Your session has expired. Please sign out and sign back in to continue.', isError: false } as Message]);
      } else if (err instanceof Error && err.message.includes('not set')) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'AI not configured. Restart the dev server with: npx expo start --clear', isError: true, retryText: text, retryImageBase64: imageBase64 } as Message]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Tap to retry.', isError: true, retryText: text, retryImageBase64: imageBase64 } as Message]);
      }
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  const iconColor = colors.isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
  const closeIconColor = colors.isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)';
  const canSend = inputText.trim().length > 0 || !!pendingImage;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, { zIndex: 9999, opacity: overlayOpacity }]}
      pointerEvents={aiChatOpen ? 'auto' : 'none'}
    >
      {/* Full-screen blur backdrop - tap to dismiss */}
      <Pressable style={StyleSheet.absoluteFillObject} onPress={handleDismiss}>
        <BlurView intensity={25} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
      </Pressable>

      {/* Top-left button row: X close + clock history */}
      <View style={[s.topFloatRow, { top: insets.top + 12 }]}>
        <Pressable onPress={handleDismiss} hitSlop={12} style={s.floatBtn}>
          <Ionicons name="close" size={20} color={closeIconColor} />
        </Pressable>
        <Pressable onPress={() => setShowHistory(true)} hitSlop={12} style={s.floatBtn}>
          <Ionicons name="time-outline" size={20} color={closeIconColor} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={s.overlayContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {showHistory ? (
          /* ── History: conversation list ─────────────────────────────────── */
          <View style={s.historyPanel}>
            <View style={[s.historyTopBar, { paddingTop: insets.top + 8 }]}>
              <Pressable onPress={() => setShowHistory(false)} hitSlop={12} style={s.floatBtn}>
                <Ionicons name="arrow-back" size={20} color={closeIconColor} />
              </Pressable>
              <Text style={s.historyTitle}>Chat History</Text>
              <View style={{ width: 44 }} />
            </View>

            {historyLoading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={ORANGE} />
            ) : conversations.length === 0 ? (
              <View style={s.historyEmptyWrap}>
                <Ionicons name="chatbubble-outline" size={40} color={colors.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'} />
                <Text style={s.historyEmpty}>No past conversations yet.</Text>
                <Text style={s.historyEmptySub}>Your chat history will appear here.</Text>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={s.convListContent}
                showsVerticalScrollIndicator={false}
              >
                {conversations.map((conv) => (
                  <TouchableOpacity
                    key={conv.id}
                    activeOpacity={0.75}
                    style={s.convCard}
                    onPress={() => resumeConversation(conv)}
                  >
                    <View style={s.convCardInner}>
                      <View style={s.convMeta}>
                        <Text style={s.convDate}>{formatConvDate(conv.startedAt)}</Text>
                        <View style={s.convCountBadge}>
                          <Text style={s.convCountText}>{conv.messageCount}</Text>
                        </View>
                      </View>
                      <Text style={s.convPreview} numberOfLines={2}>{conv.preview}</Text>
                      <View style={s.convResumePill}>
                        <Ionicons name="arrow-forward" size={12} color={ORANGE} />
                        <Text style={s.convResumeText}>Resume conversation</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        ) : (
          /* ── Normal chat ─────────────────────────────────────────────────── */
          <>
            <ScrollView
              ref={scrollRef}
              style={s.messagesArea}
              contentContainerStyle={s.chatContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
            >
              {/* Resumed-from banner */}
              {resumedFrom && messages.length > 0 && (
                <View style={s.resumedBanner}>
                  <Ionicons name="time-outline" size={13} color={ORANGE} />
                  <Text style={s.resumedBannerText}>Resumed from {resumedFrom}</Text>
                </View>
              )}

              {messages.map((msg, i) => (
                <View key={i} style={[s.bubbleRow, msg.role === 'user' ? s.bubbleRowUser : s.bubbleRowAssistant]}>
                  <Pressable
                    style={[s.bubble, msg.role === 'user' ? s.bubbleUser : s.bubbleAssistant, msg.isError && s.bubbleError]}
                    onPress={msg.isError && msg.retryText ? () => {
                      setMessages(prev => prev.slice(0, i));
                      sendMessage(msg.retryText!);
                    } : undefined}
                  >
                    {msg.role === 'user' && msg.imageUri && (
                      <Image source={{ uri: msg.imageUri }} style={s.bubbleImage} />
                    )}
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
                    <Text style={[s.bubbleText, msg.role === 'user' ? s.bubbleTextUser : s.bubbleTextAssistant, msg.isError && s.bubbleTextError]}>
                      {msg.content}
                    </Text>
                    {msg.isError && msg.retryText && (
                      <View style={s.retryRow}>
                        <Ionicons name="refresh" size={12} color="rgba(220,80,50,0.8)" />
                        <Text style={s.retryLabel}>Tap to retry</Text>
                      </View>
                    )}
                  </Pressable>
                </View>
              ))}
              {loading && (
                <View style={[s.bubbleRow, s.bubbleRowAssistant]}>
                  <View style={[s.bubble, s.bubbleAssistant, { paddingHorizontal: 0, paddingVertical: 0 }]}>
                    <TypingBubble />
                  </View>
                </View>
              )}

              {/* Upgrade card when usage limit hit */}
              {showUpgradeCard && (
                <View style={{
                  marginTop: 16, marginHorizontal: 4, borderRadius: 24, overflow: 'hidden',
                  backgroundColor: colors.isDark ? 'rgba(255,116,42,0.08)' : 'rgba(255,116,42,0.06)',
                  borderWidth: 1, borderColor: colors.isDark ? 'rgba(255,116,42,0.25)' : 'rgba(255,116,42,0.2)',
                  padding: 24,
                }}>
                  <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <Image
                      source={require('@/assets/images/titra-logo.png')}
                      style={{ width: 48, height: 48, borderRadius: 14, marginBottom: 12 }}
                      resizeMode="cover"
                    />
                    <Text style={{ fontSize: 20, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginBottom: 6 }}>
                      Upgrade to Titra Pro
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', textAlign: 'center', lineHeight: 20 }}>
                      You've used all your free AI messages for today. Unlock unlimited access with Pro.
                    </Text>
                  </View>

                  <View style={{ gap: 10, marginBottom: 20 }}>
                    {[
                      { icon: 'chatbubbles-outline', text: 'Unlimited AI coaching & insights' },
                      { icon: 'analytics-outline', text: 'Advanced weight projections & cycle intelligence' },
                      { icon: 'document-text-outline', text: 'Provider reports for your doctor' },
                      { icon: 'school-outline', text: 'All guided courses unlocked' },
                      { icon: 'camera-outline', text: 'Unlimited photo food logging' },
                      { icon: 'mic-outline', text: 'Unlimited voice logging' },
                      { icon: 'notifications-outline', text: 'Weekly AI summaries' },
                    ].map((item, i) => (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Ionicons name={item.icon as any} size={18} color="#FF742A" />
                        <Text style={{ fontSize: 14, color: colors.textPrimary, flex: 1 }}>{item.text}</Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={{
                      backgroundColor: '#FF742A', borderRadius: 16, paddingVertical: 16,
                      alignItems: 'center', justifyContent: 'center',
                      shadowColor: '#FF742A', shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.35, shadowRadius: 16, elevation: 6,
                    }}
                    onPress={() => router.push('/settings/subscription' as any)}
                    activeOpacity={0.85}
                  >
                    <Text style={{ fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 }}>
                      Subscribe for $4.99/month
                    </Text>
                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                      7-day free trial included
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ alignItems: 'center', marginTop: 12 }}
                    onPress={() => setShowUpgradeCard(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 13, color: colors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>
                      Maybe later
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            {/* Suggestion chips — shown only when conversation is empty */}
            {messages.length === 0 && !loading && aiChatParams.chips && (() => {
              let parsed: string[] = [];
              try { parsed = JSON.parse(aiChatParams.chips); } catch {}
              if (!parsed.length) return null;
              return (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ maxHeight: 48, marginBottom: 6 }}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}
                >
                  {parsed.map((chip, i) => (
                    <Pressable
                      key={i}
                      onPress={() => setInputText(chip)}
                      style={{
                        backgroundColor: 'rgba(255,116,42,0.12)',
                        borderWidth: 1, borderColor: 'rgba(255,116,42,0.25)',
                        borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
                      }}
                    >
                      <Text style={{ color: '#FF742A', fontSize: 15, fontWeight: '600' }}>{chip}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              );
            })()}

            {/* Input card - pinned at bottom */}
            <Animated.View
              style={[s.inputWrapper, { marginBottom: Math.max(insets.bottom, 12) + 4, transform: [{ translateY: inputTranslateY }] }]}
            >
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
                    {/* Image preview */}
                    {pendingImage && (
                      <View style={s.imagePreviewRow}>
                        <Image source={{ uri: pendingImage.uri }} style={s.imageThumb} />
                        <Pressable onPress={() => setPendingImage(null)} hitSlop={8} style={s.imageThumbClose}>
                          <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.9)" />
                        </Pressable>
                      </View>
                    )}
                    <TextInput
                      ref={inputRef}
                      style={s.textInput}
                      value={inputText}
                      onChangeText={setInputText}
                      placeholder={resumedFrom ? 'Continue the conversation…' : 'Ask anything about your health…'}
                      placeholderTextColor={colors.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'}
                      multiline
                      returnKeyType="send"
                      onSubmitEditing={() => sendMessage(inputText)}
                    />
                    <View style={s.inputBottomRow}>
                      <View style={s.inputIcons} />
                      <TouchableOpacity
                        activeOpacity={canSend ? 0.7 : 1}
                        style={[s.sendBtn, canSend && s.sendBtnActive]}
                        onPress={() => sendMessage(inputText)}
                      >
                        <Ionicons
                          name="arrow-up"
                          size={18}
                          color={canSend ? '#000000' : (colors.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)')}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
              <Text style={s.disclaimer}>AI responses are not medical advice. Always consult your doctor.</Text>
            </Animated.View>
          </>
        )}
      </KeyboardAvoidingView>
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
  overlayContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  messagesArea: {
    flex: 1,
    paddingTop: 60,
  },

  // ── Top-left button row ──────────────────────────────────────────────────
  topFloatRow: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  floatBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.isDark ? 'rgba(30,30,30,0.85)' : 'rgba(240,240,240,0.85)',
  },

  // ── Resumed banner ───────────────────────────────────────────────────────
  resumedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,116,42,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,116,42,0.20)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  resumedBannerText: {
    fontSize: 14,
    color: ORANGE,
    fontWeight: '500',
  },

  // ── Chat bubbles ─────────────────────────────────────────────────────────
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
    backgroundColor: c.isDark ? '#1A1A1A' : 'rgba(240,240,240,0.95)',
    borderWidth: 0.5,
    borderColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 17,
    lineHeight: 22,
  },
  bubbleTextUser: { color: '#FFFFFF', fontWeight: '500' },
  bubbleTextAssistant: { color: w(0.85), fontWeight: '400' },
  bubbleError: {
    borderColor: 'rgba(220,80,50,0.3)',
    borderWidth: 1,
  },
  bubbleTextError: { color: 'rgba(220,80,50,0.9)' },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  retryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(220,80,50,0.8)',
  },
  bubbleImage: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    marginBottom: 6,
  },
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
    backgroundColor: 'rgba(255,255,255,0.6)',
    flexShrink: 0,
  },
  bubbleContextText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.2,
    flex: 1,
  },
  bubbleContextDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 8,
  },

  // ── Image preview ────────────────────────────────────────────────────────
  imagePreviewRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  imageThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  imageThumbClose: {
    position: 'absolute',
    top: -4,
    left: 48,
  },

  // ── Input card ───────────────────────────────────────────────────────────
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
    fontSize: 13,
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
    fontSize: 17,
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
  inputIcons: {
    flexDirection: 'row',
    gap: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    fontSize: 13,
    color: w(0.25),
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 15,
  },

  // ── History panel ────────────────────────────────────────────────────────
  historyPanel: { flex: 1 },
  historyTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  historyTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 19,
    fontWeight: '700',
    color: c.textPrimary,
  },
  historyEmptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
    gap: 10,
  },
  historyEmpty: {
    textAlign: 'center',
    color: w(0.5),
    fontSize: 17,
    fontWeight: '600',
  },
  historyEmptySub: {
    textAlign: 'center',
    color: w(0.3),
    fontSize: 15,
  },

  // ── Conversation list ────────────────────────────────────────────────────
  convListContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 40,
    gap: 10,
  },
  convCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    borderWidth: 1,
    borderColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
  },
  convCardInner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  convMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  convDate: {
    fontSize: 14,
    fontWeight: '600',
    color: w(0.45),
    letterSpacing: 0.2,
  },
  convCountBadge: {
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  convCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: w(0.4),
  },
  convPreview: {
    fontSize: 16,
    lineHeight: 20,
    color: w(0.75),
    fontWeight: '400',
  },
  convResumePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  convResumeText: {
    fontSize: 14,
    fontWeight: '600',
    color: ORANGE,
  },
  });
};
