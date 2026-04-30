// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    Gesture: {
      Tap: () => ({
        onEnd: function () { return this; },
        runOnJS: function () { return this; },
      }),
    },
    GestureDetector: ({ children }: any) => children,
    GestureHandlerRootView: View,
  };
});

// Mock expo-blur
jest.mock('expo-blur', () => {
  const View = require('react-native').View;
  return { BlurView: View };
});

// Mock expo-router
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  Link: ({ children }: any) => children,
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const Text = require('react-native').Text;
  return {
    Ionicons: (props: any) => require('react').createElement(Text, props, props.name),
    MaterialIcons: (props: any) => require('react').createElement(Text, props, props.name),
  };
});

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: View,
    Svg: View,
    Circle: View,
    Rect: View,
    Path: View,
    Defs: View,
    LinearGradient: View,
    Stop: View,
    G: View,
  };
});

// Mock supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: null }),
        })),
      })),
    })),
  },
}));

// Mock theme context
jest.mock('@/contexts/theme-context', () => ({
  useAppTheme: () => ({
    isDark: false,
    colors: {
      bg: '#FFFFFF',
      surface: '#F5F5F5',
      cardBg: '#FFFFFF',
      textPrimary: '#000000',
      textSecondary: '#666666',
      orangeDim: 'rgba(255,116,42,0.15)',
    },
  }),
}));

export {};
