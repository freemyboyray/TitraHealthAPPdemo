import { create } from 'zustand';

type AiChatParams = {
  type?: string;
  contextLabel?: string;
  contextValue?: string;
  seedMessage?: string;
  chips?: string; // JSON string
};

type InsightsTab = 'medication' | 'lifestyle' | 'progress';

type UiStore = {
  sheetOpen: boolean;
  setSheetOpen: (open: boolean) => void;
  aiChatOpen: boolean;
  aiChatParams: AiChatParams;
  openAiChat: (params?: AiChatParams) => void;
  closeAiChat: () => void;
  insightsDefaultTab: InsightsTab | null;
  setInsightsDefaultTab: (tab: InsightsTab | null) => void;
  healthSyncToast: string | null;
  showHealthSyncToast: (msg: string) => void;
  hideHealthSyncToast: () => void;
  // Session-only dismissal: the Apple Health promo re-appears on the next app
  // launch (this store isn't persisted), but stays hidden after an X this session.
  healthPromoDismissed: boolean;
  dismissHealthPromo: () => void;
};

let _toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useUiStore = create<UiStore>((set) => ({
  sheetOpen: false,
  setSheetOpen: (open) => set({ sheetOpen: open }),
  aiChatOpen: false,
  aiChatParams: {},
  openAiChat: (params = {}) => set({ aiChatOpen: true, aiChatParams: params }),
  closeAiChat: () => set({ aiChatOpen: false, aiChatParams: {} }),
  insightsDefaultTab: null,
  setInsightsDefaultTab: (tab) => set({ insightsDefaultTab: tab }),
  healthSyncToast: null,
  showHealthSyncToast: (msg) => {
    if (_toastTimer) clearTimeout(_toastTimer);
    set({ healthSyncToast: msg });
    _toastTimer = setTimeout(() => set({ healthSyncToast: null }), 2500);
  },
  hideHealthSyncToast: () => {
    if (_toastTimer) clearTimeout(_toastTimer);
    set({ healthSyncToast: null });
  },
  healthPromoDismissed: false,
  dismissHealthPromo: () => set({ healthPromoDismissed: true }),
}));
