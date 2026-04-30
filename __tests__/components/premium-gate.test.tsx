import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { PremiumGate } from '@/components/ui/premium-gate';
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

describe('PremiumGate', () => {
  it('renders children when user is premium', () => {
    useSubscriptionStore.setState({ isPremium: true });

    render(
      <PremiumGate feature="cycle_intelligence">
        <Text>Premium Content</Text>
      </PremiumGate>,
    );

    expect(screen.getByText('Premium Content')).toBeTruthy();
  });

  it('renders children for free features even when not premium', () => {
    render(
      <PremiumGate feature="basic_logging">
        <Text>Free Content</Text>
      </PremiumGate>,
    );

    expect(screen.getByText('Free Content')).toBeTruthy();
  });

  it('shows upgrade button for locked features (hard gate)', () => {
    render(
      <PremiumGate feature="cycle_intelligence" variant="hard">
        <Text>Locked Content</Text>
      </PremiumGate>,
    );

    expect(screen.getByText('Upgrade to Pro')).toBeTruthy();
  });

  it('shows unlock button for locked features (soft gate)', () => {
    render(
      <PremiumGate feature="peer_comparison" variant="soft" teaser="See how you compare">
        <Text>Blurred Content</Text>
      </PremiumGate>,
    );

    expect(screen.getByText('Unlock with Pro')).toBeTruthy();
    expect(screen.getByText('See how you compare')).toBeTruthy();
  });

  it('renders children for metered features with usage variant', () => {
    render(
      <PremiumGate feature="ai_chat" variant="usage">
        <Text>AI Chat</Text>
      </PremiumGate>,
    );

    expect(screen.getByText('AI Chat')).toBeTruthy();
  });

  it('calls custom onUpgrade handler', () => {
    const onUpgrade = jest.fn();

    render(
      <PremiumGate feature="clinical_alerts" variant="hard" onUpgrade={onUpgrade}>
        <Text>Alerts</Text>
      </PremiumGate>,
    );

    fireEvent.press(screen.getByText('Upgrade to Pro'));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });
});
