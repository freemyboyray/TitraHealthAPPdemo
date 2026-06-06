import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

export type UserMedication = {
  id: string;
  medication_brand: string;
  medication_custom_name: string | null;
  glp1_type: string;
  route_of_administration: string;
  dose_mg: number;
  frequency_days: number;
  dose_time: string | null;
  notes: string | null;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
};

type MedicationsStore = {
  medications: UserMedication[];
  /** True once the first fetch has completed (so the UI can distinguish
   *  "loading" from "genuinely empty" and avoid a no-medications flash). */
  loaded: boolean;
  /** Fetch the user's medication library into the store. Preloaded at app start
   *  so screens like medication-detail render instantly instead of showing a gap. */
  fetchMedications: () => Promise<void>;
  resetMedications: () => void;
};

export const useMedicationsStore = create<MedicationsStore>((set) => ({
  medications: [],
  loaded: false,
  fetchMedications: async () => {
    const { data } = await supabase
      .from('user_medications')
      .select('*')
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false });
    set(data ? { medications: data as UserMedication[], loaded: true } : { loaded: true });
  },
  resetMedications: () => set({ medications: [], loaded: false }),
}));
