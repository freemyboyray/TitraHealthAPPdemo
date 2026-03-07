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
      // No row found — insert minimal placeholder
      const { data: inserted } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          full_name: (user.user_metadata?.full_name as string) ?? null,
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
}));
