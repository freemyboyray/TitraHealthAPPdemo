import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { TOS_VERSION, PRIVACY_VERSION } from '@/constants/legal';
import { ChevronRight, FileText, Lock } from 'lucide-react-native';

const FF = 'System';
const TERMS_URL = 'https://titrahealth.io/terms-conditions';
const PRIVACY_URL = 'https://titrahealth.io/privacy-policy';

export default function TosUpdateScreen() {
  const router = useRouter();
  const { updateProfile } = useProfile();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [saving, setSaving] = useState(false);

  const handleAccept = async () => {
    if (saving) return;
    setSaving(true);
    const now = new Date().toISOString();
    await updateProfile({
      tosAcceptedAt: now,
      tosVersion: TOS_VERSION,
      privacyAcceptedAt: now,
      privacyVersion: PRIVACY_VERSION,
    });
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <Text style={s.title}>Terms & Privacy</Text>
        <Text style={s.subtitle}>
          Please review our terms and privacy policy before continuing.
        </Text>

        <View style={s.center}>
          <TouchableOpacity
            style={s.linkRow}
            activeOpacity={0.7}
            onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
          >
            <FileText size={22} color={colors.textSecondary} />
            <Text style={s.linkText}>Terms of Use</Text>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.linkRow}
            activeOpacity={0.7}
            onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
          >
            <Lock size={22} color={colors.textSecondary} />
            <Text style={s.linkText}>Privacy Policy</Text>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={s.bottom}>
          <TouchableOpacity
            style={[s.acceptBtn, saving && s.acceptBtnDisabled]}
            onPress={handleAccept}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={s.acceptBtnText}>
              {saving ? 'Saving…' : 'Accept and Continue'}
            </Text>
          </TouchableOpacity>
          <Text style={s.footerText}>
            By tapping "Accept and Continue", you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 60 },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: c.textPrimary,
    lineHeight: 34,
    fontFamily: FF,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: c.textSecondary,
    lineHeight: 22,
    fontFamily: FF,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
  },
  linkText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: c.textPrimary,
    fontFamily: FF,
  },

  bottom: {
    paddingBottom: 24,
  },
  acceptBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: c.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnDisabled: { opacity: 0.5 },
  acceptBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: c.bg,
    fontFamily: FF,
  },
  footerText: {
    fontSize: 13,
    color: c.textMuted,
    textAlign: 'center',
    fontFamily: FF,
    lineHeight: 18,
    marginTop: 12,
    paddingHorizontal: 8,
  },
});
