import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

import {
  FullUserProfile,
  ProfileDraft,
  computeProfileDerivedMetrics,
} from '@/constants/user-profile';

const STORAGE_KEY = '@titrahealth_profile';

// ─── Context Type ─────────────────────────────────────────────────────────────

type ProfileContextValue = {
  profile: FullUserProfile | null;
  draft: ProfileDraft;
  updateDraft: (fields: Partial<FullUserProfile>) => void;
  completeOnboarding: () => Promise<void>;
  resetProfile: () => Promise<void>;
  isLoading: boolean;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<FullUserProfile | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((json) => {
        if (json) {
          setProfile(JSON.parse(json) as FullUserProfile);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const updateDraft = (fields: Partial<FullUserProfile>) => {
    setDraft((prev) => ({ ...prev, ...fields }));
  };

  const completeOnboarding = async () => {
    const derived = computeProfileDerivedMetrics(draft);
    const complete: FullUserProfile = {
      ...draft,
      ...derived,
      onboardingCompletedAt: new Date().toISOString(),
    } as FullUserProfile;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(complete));
    setProfile(complete);
  };

  const resetProfile = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setProfile(null);
    setDraft({});
  };

  return (
    <ProfileContext.Provider
      value={{ profile, draft, updateDraft, completeOnboarding, resetProfile, isLoading }}>
      {children}
    </ProfileContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
