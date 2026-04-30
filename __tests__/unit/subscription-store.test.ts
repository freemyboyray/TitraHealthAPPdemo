import { useSubscriptionStore } from '@/stores/subscription-store';

// Reset store before each test
beforeEach(() => {
  useSubscriptionStore.setState({
    isPremium: false,
    status: 'none',
    trialEndsAt: null,
    currentPeriodEnd: null,
    loaded: false,
  });
});

describe('subscription-store', () => {
  describe('checkFeatureAccess', () => {
    it('returns "allowed" for premium users on any feature', () => {
      useSubscriptionStore.setState({ isPremium: true });
      const store = useSubscriptionStore.getState();
      expect(store.checkFeatureAccess('cycle_intelligence')).toBe('allowed');
      expect(store.checkFeatureAccess('ai_chat')).toBe('allowed');
      expect(store.checkFeatureAccess('some_free_feature')).toBe('allowed');
    });

    it('returns "locked" for premium features when not premium', () => {
      const store = useSubscriptionStore.getState();
      expect(store.checkFeatureAccess('cycle_intelligence')).toBe('locked');
      expect(store.checkFeatureAccess('provider_report')).toBe('locked');
      expect(store.checkFeatureAccess('peer_comparison')).toBe('locked');
      expect(store.checkFeatureAccess('clinical_alerts')).toBe('locked');
      expect(store.checkFeatureAccess('weight_projection')).toBe('locked');
      expect(store.checkFeatureAccess('ai_insights')).toBe('locked');
    });

    it('returns "limited" for metered features when not premium', () => {
      const store = useSubscriptionStore.getState();
      expect(store.checkFeatureAccess('ai_chat')).toBe('limited');
      expect(store.checkFeatureAccess('photo_analysis')).toBe('limited');
      expect(store.checkFeatureAccess('voice_log')).toBe('limited');
    });

    it('returns "allowed" for unrecognized features (free by default)', () => {
      const store = useSubscriptionStore.getState();
      expect(store.checkFeatureAccess('basic_logging')).toBe('allowed');
      expect(store.checkFeatureAccess('weight_log')).toBe('allowed');
    });
  });

  describe('getFeatureLimit', () => {
    it('returns correct limits for metered features', () => {
      const store = useSubscriptionStore.getState();
      expect(store.getFeatureLimit('ai_chat')).toBe(5);
      expect(store.getFeatureLimit('photo_analysis')).toBe(3);
      expect(store.getFeatureLimit('voice_log')).toBe(3);
    });
  });

  describe('setPremium', () => {
    it('sets premium status', () => {
      useSubscriptionStore.getState().setPremium(true);
      expect(useSubscriptionStore.getState().isPremium).toBe(true);

      useSubscriptionStore.getState().setPremium(false);
      expect(useSubscriptionStore.getState().isPremium).toBe(false);
    });
  });
});
