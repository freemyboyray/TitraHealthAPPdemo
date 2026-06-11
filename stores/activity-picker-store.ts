import { create } from 'zustand';

// One-shot channel so the workout-type picker page can hand its selection
// back to the Log Activity screen without remounting it (which would wipe the
// in-progress duration / intensity / notes). The picker sets `pendingKey`;
// Log Activity adopts it on focus and clears it.
interface ActivityPickerState {
  pendingKey: string | null;
  setPendingKey: (key: string | null) => void;
}

export const useActivityPicker = create<ActivityPickerState>((set) => ({
  pendingKey: null,
  setPendingKey: (pendingKey) => set({ pendingKey }),
}));
