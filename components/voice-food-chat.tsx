import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated as RNAnimated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/theme-context';
import { converseFoodLog, type ConverseFoodResult } from '@/lib/openai';
import { ensureAiConsent } from '@/lib/ai-consent';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { ArrowUpCircle, ChevronLeft, Grid3x3, Mic } from 'lucide-react-native';


type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type Props = {
  /** Called when the conversation produces parsed food items */
  onComplete: (items: { item: string; estimated_g: number }[]) => void;
  onCancel: () => void;
};

function ChatBubble({ msg, colors }: { msg: ChatMessage; colors: ReturnType<typeof useAppTheme>['colors'] }) {
  const opacity = useRef(new RNAnimated.Value(0)).current;
  const ty = useRef(new RNAnimated.Value(14)).current;

  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      RNAnimated.spring(ty, { toValue: 0, damping: 18, stiffness: 140, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <RNAnimated.View
      style={[
        st.bubble,
        msg.role === 'user'
          ? [st.userBubble, { backgroundColor: colors.orange }]
          : [st.aiBubble, { backgroundColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }],
        { opacity, transform: [{ translateY: ty }] },
      ]}
    >
      <Text style={[st.bubbleText, { color: msg.role === 'user' ? '#FFF' : colors.textPrimary }]}>
        {msg.content}
      </Text>
    </RNAnimated.View>
  );
}

export function VoiceFoodChat({ onComplete, onCancel }: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceMode, setVoiceMode] = useState(true); // start in voice mode
  const sentInitial = useRef(false);

  // Voice input
  const { isRecording, isProcessing, toggleRecording } = useVoiceInput();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isRecording) {
      scale.value = withRepeat(
        withSequence(withTiming(1.15, { duration: 500 }), withTiming(1, { duration: 500 })),
        -1,
        false,
      );
    } else {
      scale.value = withTiming(1, { duration: 150 });
    }
  }, [isRecording]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // Send message to AI
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    // Conversational food logging sends descriptions to OpenAI — prompt for
    // consent before the first message; bail (input preserved) if declined.
    if (!(await ensureAiConsent())) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const updated = [...messages, userMsg];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMessages(updated);
    setInputText('');
    setLoading(true);

    try {
      const result: ConverseFoodResult = await converseFoodLog(updated);
      const assistantMsg: ChatMessage = { role: 'assistant', content: result.message };
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessages([...updated, assistantMsg]);

      if (result.done && result.items && result.items.length > 0) {
        // Small delay so user can read the confirmation
        setTimeout(() => onComplete(result.items!), 1200);
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setMessages([...updated, { role: 'assistant', content: "Sorry, I couldn't process that. Could you try again?" }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, onComplete]);

  // Voice handler — tap to start, tap to stop
  const handleMicTap = useCallback(async () => {
    if (isProcessing || loading) return;
    const text = await toggleRecording();
    if (text) sendMessage(text);
  }, [isProcessing, loading, toggleRecording, sendMessage]);

  // Auto-scroll on new messages
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, loading]);

  // Greet on mount
  useEffect(() => {
    if (sentInitial.current) return;
    sentInitial.current = true;
    setMessages([{
      role: 'assistant',
      content: "Tell me what you had! You can describe your whole meal \u2014 I'll figure out the details.",
    }]);
  }, []);

  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[st.header, { borderBottomColor: w(0.08) }]}>
        <Pressable onPress={onCancel} hitSlop={12}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[st.headerTitle, { color: colors.textPrimary }]}>Describe Your Meal</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[st.messagesContainer, { paddingBottom: 16 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((msg, i) => (
          <ChatBubble key={i} msg={msg} colors={colors} />
        ))}
        {loading && (
          <View style={[st.bubble, st.aiBubble, { backgroundColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
            <ActivityIndicator size="small" color={colors.orange} />
          </View>
        )}
      </ScrollView>

      {/* Input area */}
      <View style={[st.inputArea, { paddingBottom: Math.max(insets.bottom, 12), borderTopColor: w(0.08) }]}>
        {voiceMode ? (
          /* Voice mode — big mic button */
          <View style={st.voiceArea}>
            <Animated.View style={pulseStyle}>
              <Pressable
                onPress={handleMicTap}
                disabled={isProcessing || loading}
                style={({ pressed }) => [
                  st.micButton,
                  {
                    backgroundColor: isRecording
                      ? 'rgba(229,62,62,0.15)'
                      : pressed
                      ? 'rgba(255,116,42,0.2)'
                      : 'rgba(255,116,42,0.12)',
                    borderColor: isRecording ? '#E53E3E' : colors.orange,
                  },
                ]}
              >
                {isProcessing ? 'hourglass-outline' : isRecording ? <Mic
                  size={32}
                  color={isProcessing ? w(0.3) : isRecording ? '#E53E3E' : colors.orange}
                /> : <Mic
                  size={32}
                  color={isProcessing ? w(0.3) : isRecording ? '#E53E3E' : colors.orange}
                />}
              </Pressable>
            </Animated.View>
            <Text style={[st.voiceHint, { color: w(0.5) }]}>
              {isProcessing ? 'Processing...' : isRecording ? 'Listening... tap to stop' : 'Tap to speak'}
            </Text>
            <Pressable onPress={() => setVoiceMode(false)} style={st.switchBtn}>
              <Grid3x3 size={18} color={w(0.4)} />
              <Text style={[st.switchText, { color: w(0.4) }]}>Type instead</Text>
            </Pressable>
          </View>
        ) : (
          /* Text mode — input bar */
          <View style={st.textInputRow}>
            <Pressable onPress={() => setVoiceMode(true)} style={st.micSmall}>
              <Mic size={20} color={colors.orange} />
            </Pressable>
            <TextInput
              style={[st.textInput, { color: colors.textPrimary, borderColor: w(0.12) }]}
              placeholder="Type what you had..."
              placeholderTextColor={w(0.3)}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => sendMessage(inputText)}
              returnKeyType="send"
              autoFocus
              multiline={false}
            />
            <Pressable
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim() || loading}
              style={[st.sendBtn, (!inputText.trim() || loading) && { opacity: 0.3 }]}
            >
              <ArrowUpCircle size={34} color={colors.orange} />
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontFamily: 'System',
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 17,
    lineHeight: 21,
    fontFamily: 'System',
  },
  inputArea: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  voiceArea: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  micButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceHint: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: 'System',
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  switchText: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: 'System',
  },
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  micSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: 17,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: 'System',
  },
  sendBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
