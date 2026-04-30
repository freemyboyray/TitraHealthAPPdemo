import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const ORANGE = '#FF742A';

type Category = 'bug' | 'feature' | 'general';

const CATEGORY_LABELS: Record<Category, string> = {
  bug: 'Bug Report',
  feature: 'Feature Request',
  general: 'General',
};

const PLACEHOLDER: Record<Category, string> = {
  bug: 'What happened? What did you expect to happen instead?',
  feature: 'Describe the feature you\'d like to see and why it would be useful.',
  general: 'Tell us what\'s on your mind.',
};

function getDeviceInfo() {
  return {
    os_name: Platform.OS,
    os_version: String(Platform.Version),
    app_version: Constants.expoConfig?.version ?? null,
    build_number: Constants.expoConfig?.ios?.buildNumber ?? null,
    device_model: Platform.OS === 'ios'
      ? (Platform.constants as any)?.systemName ?? 'iOS'
      : 'Android',
  };
}

export default function FeedbackScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [category, setCategory] = useState<Category>('bug');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = subject.trim().length > 0 && description.trim().length > 0 && !submitting;

  async function handlePickScreenshot() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      base64: true,
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.base64 && asset.base64.length > 500000) {
        Alert.alert('Image Too Large', 'Please choose a smaller screenshot.');
        return;
      }
      setScreenshotUri(asset.uri);
      setScreenshotBase64(asset.base64 ?? null);
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be signed in to submit feedback.');
        return;
      }

      // Rate limit: block if user submitted in the last 60 seconds
      const { data: recent } = await supabase
        .from('feedback')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (recent && recent.length > 0) {
        const lastSubmitted = new Date(recent[0].created_at).getTime();
        if (Date.now() - lastSubmitted < 60000) {
          Alert.alert('Please Wait', 'You can submit another feedback in a moment.');
          return;
        }
      }

      const device = getDeviceInfo();
      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        category,
        subject: subject.trim(),
        description: description.trim(),
        screenshot: screenshotBase64 ? `data:image/jpeg;base64,${screenshotBase64}` : null,
        ...device,
      });

      if (error) {
        console.warn('[Feedback] insert failed:', error);
        Alert.alert('Error', 'Failed to submit feedback. Please try again.');
        return;
      }

      Alert.alert(
        'Thank You!',
        'Your feedback has been submitted. We appreciate you helping us improve TitraHealth.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (e: any) {
      console.warn('[Feedback] unexpected error:', e);
      Alert.alert('Error', 'Something went wrong. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Send Feedback</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Category selector */}
          <View style={s.tabRow}>
            {(['bug', 'feature', 'general'] as Category[]).map((cat) => (
              <Pressable
                key={cat}
                style={[s.tab, category === cat && s.tabActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[s.tabText, category === cat && s.tabTextActive]}>
                  {CATEGORY_LABELS[cat]}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Form */}
          <View style={s.card}>
            {/* Subject */}
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Subject</Text>
              <TextInput
                style={s.textInput}
                placeholder="Brief summary"
                placeholderTextColor={colors.textMuted}
                value={subject}
                onChangeText={setSubject}
                maxLength={120}
                returnKeyType="next"
              />
            </View>

            <View style={s.divider} />

            {/* Description */}
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Description</Text>
              <TextInput
                style={[s.textInput, s.textArea]}
                placeholder={PLACEHOLDER[category]}
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
                maxLength={2000}
              />
              <Text style={s.charCount}>{description.length}/2000</Text>
            </View>

            {/* Screenshot (bug reports only) */}
            {category === 'bug' && (
              <>
                <View style={s.divider} />
                <View style={s.fieldGroup}>
                  <Text style={s.fieldLabel}>Screenshot (optional)</Text>
                  {screenshotUri ? (
                    <View style={s.screenshotPreview}>
                      <Image source={{ uri: screenshotUri }} style={s.screenshotImage} />
                      <TouchableOpacity
                        style={s.removeScreenshot}
                        onPress={() => { setScreenshotUri(null); setScreenshotBase64(null); }}
                      >
                        <Ionicons name="close-circle-sharp" size={24} color="#FF453A" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Pressable style={s.attachBtn} onPress={handlePickScreenshot}>
                      <IconSymbol name="camera.fill" size={18} color={ORANGE} />
                      <Text style={s.attachBtnText}>Attach Screenshot</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}
          </View>

          {/* Submit button */}
          <TouchableOpacity
            style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={!canSubmit}
          >
            {submitting ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={s.submitBtnText}>Submitting…</Text>
              </View>
            ) : (
              <Text style={s.submitBtnText}>Submit Feedback</Text>
            )}
          </TouchableOpacity>

          <Text style={s.footnote}>
            Your device and app version info will be included to help us diagnose issues.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(c: AppColors) {
  const w = (a: number) =>
    c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 19, fontWeight: '700', color: c.textPrimary },

    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },

    tabRow: {
      flexDirection: 'row',
      backgroundColor: w(0.06),
      borderRadius: 12,
      padding: 3,
      marginBottom: 16,
    },
    tab: {
      flex: 1, paddingVertical: 10,
      borderRadius: 10, alignItems: 'center',
    },
    tabActive: { backgroundColor: ORANGE },
    tabText: { fontSize: 14, fontWeight: '600', color: w(0.5) },
    tabTextActive: { color: '#FFFFFF' },

    card: {
      backgroundColor: c.glassOverlay,
      borderRadius: 16,
      borderWidth: 1,
      borderTopColor: c.border,
      borderLeftColor: c.borderSubtle,
      borderRightColor: c.borderSubtle,
      borderBottomColor: c.borderSubtle,
      overflow: 'hidden',
      marginBottom: 20,
    },

    fieldGroup: { paddingHorizontal: 16, paddingVertical: 14 },
    fieldLabel: {
      fontSize: 13, fontWeight: '600', color: c.textSecondary,
      textTransform: 'uppercase', letterSpacing: 0.5,
      marginBottom: 8,
    },
    textInput: {
      fontSize: 16, color: c.textPrimary, fontWeight: '500',
      padding: 0,
    },
    textArea: { minHeight: 120, lineHeight: 22 },
    charCount: {
      fontSize: 12, color: c.textMuted, textAlign: 'right', marginTop: 6,
    },

    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.borderSubtle,
      marginLeft: 16, marginRight: 16,
    },

    screenshotPreview: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    },
    screenshotImage: {
      width: 80, height: 80, borderRadius: 10, backgroundColor: w(0.06),
    },
    removeScreenshot: { marginTop: 2 },

    attachBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingVertical: 10, paddingHorizontal: 14,
      backgroundColor: 'rgba(255,116,42,0.1)',
      borderRadius: 10, alignSelf: 'flex-start',
    },
    attachBtnText: { fontSize: 15, fontWeight: '600', color: ORANGE },

    submitBtn: {
      backgroundColor: ORANGE,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtnDisabled: { opacity: 0.45 },
    submitBtnText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },

    footnote: {
      fontSize: 13, color: c.textMuted, textAlign: 'center',
      marginTop: 12, lineHeight: 18, paddingHorizontal: 20,
    },
  });
}
