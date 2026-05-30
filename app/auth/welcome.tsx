import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors: c } = useAppTheme();
  const s = useMemo(() => createStyles(c), [c]);

  return (
    <View style={s.root}>
      <StatusBar style={c.isDark ? 'light' : 'dark'} />

      {/* Background illustration */}
      <Image
        source={c.isDark ? require('@/assets/images/welcome-bg-dark.png') : require('@/assets/images/welcome-bg.png')}
        style={s.bgImage}
        resizeMode="cover"
        pointerEvents="none"
      />

      <SafeAreaView style={s.safe}>
        {/* Header text — top left */}
        <View style={s.textContainer}>
          <Text style={s.headline}>
            Your Journey,{'\n'}
            <Text style={s.headlineAccent}>Optimized.</Text>
          </Text>
          <Text style={s.subtext}>
            Smart tracking, AI insights, and personalized guidance for your GLP-1 treatment.
          </Text>
        </View>

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Login button — bottom right */}
        <View style={s.buttonContainer}>
          <Pressable
            style={s.loginBtn}
            onPress={() => router.navigate('/auth/sign-in' as any)}
            accessibilityLabel="Login"
            accessibilityRole="button"
          >
            <Text style={s.loginBtnText}>Login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.isDark ? '#1A1A1A' : '#FFFFFF',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_W,
    height: SCREEN_H,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 24,
  },
  textContainer: {
    maxWidth: 300,
  },
  headline: {
    fontSize: 36,
    fontWeight: '400',
    color: c.isDark ? '#FFFFFF' : '#1A1A1A',
    lineHeight: 42,
    letterSpacing: -0.5,
    fontFamily: 'System',
  },
  headlineAccent: {
    color: c.orange,
    fontWeight: '800',
  },
  subtext: {
    fontSize: 16,
    fontWeight: '400',
    color: c.isDark ? 'rgba(255,255,255,0.6)' : '#555555',
    lineHeight: 23,
    marginTop: 14,
    fontFamily: 'System',
  },
  buttonContainer: {
    alignItems: 'flex-end',
  },
  loginBtn: {
    backgroundColor: c.orange,
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'System',
  },
});
