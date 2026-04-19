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
    // Clear all cached user data from AsyncStorage
    try {
      const keys = await AsyncStorage.getAllKeys();
      const appKeys = keys.filter(k => k.startsWith('@titrahealth_'));
      if (appKeys.length > 0) await AsyncStorage.multiRemove(appKeys);
    } catch {}
    set({ session: null, profile: null, demoMode: false, sessionLoaded: true });
  },

  deleteAccount: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not signed in');

    // Call edge function to delete all user data + auth user (requires service-role key).
    // The edge function handles table deletions, profile deletion, and auth user removal.
    const res = await supabase.functions.invoke('delete-account', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.error) {
      throw new Error(`Account deletion failed: ${res.error.message}`);
    }
    // Check for error in the response body (edge function returned 200 with error JSON)
    if (res.data?.error) {
      throw new Error(`Account deletion failed: ${res.data.error}`);
    }

    // Sign out and clear local storage
    await supabase.auth.signOut();
    await AsyncStorage.clear().catch(() => {});
    set({ session: null, profile: null, demoMode: false, sessionLoaded: true });
  },
}));
