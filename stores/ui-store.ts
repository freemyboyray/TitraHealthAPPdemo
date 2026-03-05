import { create } from 'zustand';

type UiStore = {
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
};

export const useUiStore = create<UiStore>((set) => ({
  sheetOpen: false,
  setSheetOpen: (open) => set({ sheetOpen: open }),
}));
