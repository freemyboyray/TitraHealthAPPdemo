import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProgressPhoto = {
  id: string;
  photoUrl: string;
  weightLbs: number;
  milestoneLbs: number | null;
  isStarting: boolean;
  note: string | null;
  takenAt: string;
};

type ProgressPhotoStore = {
  photos: ProgressPhoto[];
  loading: boolean;
  fetchPhotos(): Promise<void>;
  uploadPhoto(
    base64: string,
    weightLbs: number,
    opts?: { milestone?: number; isStarting?: boolean; note?: string },
  ): Promise<boolean>;
  deletePhoto(id: string): Promise<void>;
  getStartingPhoto(): ProgressPhoto | null;
  getSignedUrl(path: string): Promise<string | null>;
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useProgressPhotoStore = create<ProgressPhotoStore>((set, get) => ({
  photos: [],
  loading: false,

  async fetchPhotos() {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('progress_photos')
        .select('*')
        .order('taken_at', { ascending: false });

      if (error) {
        console.error('[progress-photo-store] fetchPhotos error:', error.message);
        return;
      }

      const photos: ProgressPhoto[] = (data ?? []).map((row: any) => ({
        id: row.id,
        photoUrl: row.photo_url,
        weightLbs: Number(row.weight_lbs),
        milestoneLbs: row.milestone_lbs != null ? Number(row.milestone_lbs) : null,
        isStarting: row.is_starting,
        note: row.note ?? null,
        takenAt: row.taken_at,
      }));

      set({ photos });
    } finally {
      set({ loading: false });
    }
  },

  async uploadPhoto(base64, weightLbs, opts) {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        console.error('[progress-photo-store] auth error:', userError?.message);
        return false;
      }

      const userId = userData.user.id;
      const path = `${userId}/${Date.now()}.jpg`;

      // Decode base64 to Uint8Array
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

      const { error: uploadError } = await supabase.storage
        .from('progress-photos')
        .upload(path, bytes, { contentType: 'image/jpeg' });

      if (uploadError) {
        console.error('[progress-photo-store] upload error:', uploadError.message);
        return false;
      }

      const { error: insertError } = await supabase.from('progress_photos').insert({
        user_id: userId,
        photo_url: path,
        weight_lbs: weightLbs,
        milestone_lbs: opts?.milestone ?? null,
        is_starting: opts?.isStarting ?? false,
        note: opts?.note ?? null,
        taken_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error('[progress-photo-store] insert error:', insertError.message);
        return false;
      }

      await get().fetchPhotos();
      return true;
    } catch (err) {
      console.error('[progress-photo-store] uploadPhoto error:', err);
      return false;
    }
  },

  async deletePhoto(id) {
    const photo = get().photos.find((p) => p.id === id);
    if (!photo) return;

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('progress-photos')
      .remove([photo.photoUrl]);

    if (storageError) {
      console.error('[progress-photo-store] storage delete error:', storageError.message);
    }

    // Delete row from table
    const { error: dbError } = await supabase
      .from('progress_photos')
      .delete()
      .eq('id', id);

    if (dbError) {
      console.error('[progress-photo-store] db delete error:', dbError.message);
    }

    await get().fetchPhotos();
  },

  getStartingPhoto() {
    return get().photos.find((p) => p.isStarting) ?? null;
  },

  async getSignedUrl(path) {
    const { data, error } = await supabase.storage
      .from('progress-photos')
      .createSignedUrl(path, 3600);

    if (error) {
      console.error('[progress-photo-store] signedUrl error:', error.message);
      return null;
    }

    return data?.signedUrl ?? null;
  },
}));
