import { create } from 'zustand';

type AiChatParams = {
  type?: string;
  contextLabel?: string;
  contextValue?: string;
  seedMessage?: string;
  chips?: string; // JSON string
};

type UiStore = {
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
  aiChatOpen: boolean;
  aiChatParams: AiChatParams;
  openAiChat: (params?: AiChatParams) => void;
  closeAiChat: () => void;
};

export const useUiStore = create<UiStore>((set) => ({
  sheetOpen: false,
  setSheetOpen: (open) => set({ sheetOpen: open }),
  aiChatOpen: false,
  aiChatParams: {},
  openAiChat: (params = {}) => set({ aiChatOpen: true, aiChatParams: params }),
  closeAiChat: () => set({ aiChatOpen: false, aiChatParams: {} }),
}));
