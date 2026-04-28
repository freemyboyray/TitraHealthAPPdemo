import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { useVoiceInput } from '@/hooks/useVoiceInput';

const ORANGE = '#FF742A';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type Props = {
  /** Called when the conversation produces parsed food items */
  onComplete: (items: { item: string; estimated_g: number }[]) => void;
  onCancel: () => void;
};

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
  const { isRecording, isProcessing, startRecording, stopAndTranscribe } = useVoiceInput();
  const scale = useSharedValue(1);
  const activeRef = useRef(false);

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

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInputText('');
    setLoading(true);

    try {
      const result: ConverseFoodResult = await converseFoodLog(updated);
      const assistantMsg: ChatMessage = { role: 'assistant', content: result.message };
      setMessages([...updated, assistantMsg]);

      if (result.done && result.items && result.items.length > 0) {
        // Small delay so user can read the confirmation
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => onComplete(result.items!), 1200);
      }
    } catch {
      setMessages([...updated, { role: 'assistant', content: "Sorry, I couldn't process that. Could you try again?" }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, onComplete]);

  // Voice handlers
  const handlePressIn = useCallback(async () => {
    if (isProcessing || loading) return;
    activeRef.current = true;
    await startRecording();
  }, [isProcessing, loading, startRecording]);

  const handlePressOut = useCallback(async () => {
    if (!activeRef.current) return;
    activeRef.current = false;
    const text = await stopAndTranscribe();
    if (text) sendMessage(text);
  }, [stopAndTranscribe, sendMessage]);

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
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
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
          <View
            key={i}
            style={[
              st.bubble,
              msg.role === 'user'
                ? [st.userBubble, { backgroundColor: ORANGE }]
                : [st.aiBubble, { backgroundColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }],
            ]}
          >
            <Text style={[
              st.bubbleText,
              { color: msg.role === 'user' ? '#FFF' : colors.textPrimary },
            ]}>
              {msg.content}
            </Text>
          </View>
        ))}
        {loading && (
          <View style={[st.bubble, st.aiBubble, { backgroundColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
            <ActivityIndicator size="small" color={ORANGE} />
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
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={isProcessing || loading}
                style={({ pressed }) => [
                  st.micButton,
                  {
                    backgroundColor: isRecording
                      ? 'rgba(229,62,62,0.15)'
                      : pressed
                      ? 'rgba(255,116,42,0.2)'
                      : 'rgba(255,116,42,0.12)',
                    borderColor: isRecording ? '#E53E3E' : ORANGE,
                  },
                ]}
              >
                <Ionicons
                  name={isProcessing ? 'hourglass-outline' : isRecording ? 'mic' : 'mic-outline'}
                  size={32}
                  color={isProcessing ? w(0.3) : isRecording ? '#E53E3E' : ORANGE}
                />
              </Pressable>
            </Animated.View>
            <Text style={[st.voiceHint, { color: w(0.5) }]}>
              {isProcessing ? 'Processing...' : isRecording ? 'Listening... release when done' : 'Hold to speak'}
            </Text>
            <Pressable onPress={() => setVoiceMode(false)} style={st.switchBtn}>
              <Ionicons name="keypad-outline" size={18} color={w(0.4)} />
              <Text style={[st.switchText, { color: w(0.4) }]}>Type instead</Text>
            </Pressable>
          </View>
        ) : (
          /* Text mode — input bar */
          <View style={st.textInputRow}>
            <Pressable onPress={() => setVoiceMode(true)} style={st.micSmall}>
              <Ionicons name="mic-outline" size={20} color={ORANGE} />
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
              <Ionicons name="arrow-up-circle" size={34} color={ORANGE} />
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
