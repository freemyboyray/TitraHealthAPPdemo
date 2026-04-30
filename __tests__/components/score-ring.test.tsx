import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ScoreRing } from '@/components/score-ring';

// ScoreRing uses Reanimated, gesture-handler, and SVG — all mocked in setup/mocks.ts

describe('ScoreRing', () => {
  const defaultProps = {
    score: 75,
    size: 160,
    strokeWidth: 10,
    gradientStart: '#1E8449',
    gradientEnd: '#27AE60',
    label: 'Recovery',
    message: 'Moderately recovered',
    onTap: jest.fn(),
  };

  it('renders the score number', () => {
    render(<ScoreRing {...defaultProps} />);
    expect(screen.getByText('75')).toBeTruthy();
  });

  it('renders the label in uppercase', () => {
    render(<ScoreRing {...defaultProps} />);
    expect(screen.getByText('RECOVERY')).toBeTruthy();
  });

  it('renders the message text', () => {
    render(<ScoreRing {...defaultProps} />);
    expect(screen.getByText('Moderately recovered')).toBeTruthy();
  });

  it('does not render message when empty', () => {
    render(<ScoreRing {...defaultProps} message="" />);
    expect(screen.queryByText('Moderately recovered')).toBeNull();
  });

  it('renders different scores', () => {
    const { rerender } = render(<ScoreRing {...defaultProps} score={42} />);
    expect(screen.getByText('42')).toBeTruthy();

    rerender(<ScoreRing {...defaultProps} score={100} />);
    expect(screen.getByText('100')).toBeTruthy();
  });
});
