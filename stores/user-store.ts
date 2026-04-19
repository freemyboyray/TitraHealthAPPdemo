import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { ProfileRow } from './log-store';

type UserStore = {
  session: Session | null;
  sessionLoaded: boolean;
  demoMode: boolean;
  profile: ProfileRow | null;
  setSession: (s: Session | null) => void;
  setSessionLoaded: (v: boolean) => void;
  setDemoMode: (v: boolean) => void;
  loadProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

export const useUserStore = create<UserStore>((set) => ({
  session: null,
  sessionLoaded: false,
  demoMode: false,
  profile: null,

  setSession: (session) => set({ session }),
  setSessionLoaded: (sessionLoaded) => set({ sessionLoaded }),
  setDemoMode: (demoMode) => set({ demoMode }),

  loadProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      set({ profile: data as ProfileRow });
    } else if (error?.code === 'PGRST116') {
      // No row found - insert minimal placeholder
      const { data: inserted } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          username: (user.user_metadata?.username as string) ?? null,
        })
        .select()
        .single();
      if (inserted) set({ profile: inserted as ProfileRow });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null, demoMode: false, sessionLoaded: true });
  },

  deleteAccount: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not signed in');

    const userId = session.user.id;

    // 1. Delete all user data client-side (RLS ensures only own rows)
    const tables = [
      'weight_logs', 'injection_logs', 'side_effect_logs', 'food_logs',
      'activity_logs', 'food_noise_logs', 'weekly_checkins', 'chat_messages',
      'garmin_tokens', 'user_goals',
    ];
    for (const table of tables) {
      await supabase.from(table).delete().eq('user_id', userId);
    }

    // 2. Delete the profile row
    await supabase.from('profiles').delete().eq('id', userId);

    // 3. Call edge function to delete the auth user (requires service-role key)
    const res = await supabase.functions.invoke('delete-account', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.error) {
      console.warn('delete-account edge function failed:', res.error.message);
    }

    // 4. Sign out first (while Supabase client still has valid state), then clear storage
    await supabase.auth.signOut();
    await AsyncStorage.clear().catch(() => {});
    set({ session: null, profile: null, demoMode: false, sessionLoaded: true });
  },
}));
