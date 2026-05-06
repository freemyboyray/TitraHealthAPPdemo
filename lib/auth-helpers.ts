import { Session } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import { supabase } from './supabase';
import { useUserStore } from '@/stores/user-store';
import { useProfile } from '@/contexts/profile-context';

/**
 * Shared post-auth flow used by all sign-in paths (Apple, Google, email).
 * Persists the session, ensures a profile row with a username, and routes
 * the user to onboarding (first time) or home (returning).
 */
export function useFinishAuth() {
  const router = useRouter();
  const { setSession, loadProfile } = useUserStore();
  const { reloadProfile } = useProfile();

  return async function finishAuth(
    session: Session,
    fallbackName?: string | null,
  ): Promise<void> {
    setSession(session);
    const user = session.user;
    if (!user) {
      await loadProfile();
      router.replace('/');
      return;
    }

    const { data: existing } = await supabase
      .from('profiles')
      .select('username, program_start_date')
      .eq('id', user.id)
      .single();

    if (!existing?.username) {
      const name =
        fallbackName ||
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        user.email?.split('@')[0];
      if (name) {
        await supabase
          .from('profiles')
          .upsert({ id: user.id, username: name }, { onConflict: 'id' });
      }
    }

    await loadProfile();
    if (existing?.program_start_date) {
      await reloadProfile();
      router.replace('/');
    } else {
      router.replace('/onboarding');
    }
  };
}
