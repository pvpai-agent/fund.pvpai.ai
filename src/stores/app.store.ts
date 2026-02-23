import { create } from 'zustand';

interface AppState {
  sidebarOpen: boolean;
  confettiTrigger: boolean;
  terminalLogs: string[];
  toggleSidebar: () => void;
  triggerConfetti: () => void;
  resetConfetti: () => void;
  addTerminalLog: (log: string) => void;
  clearTerminalLogs: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: false,
  confettiTrigger: false,
  terminalLogs: [],

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  triggerConfetti: () => set({ confettiTrigger: true }),
  resetConfetti: () => set({ confettiTrigger: false }),

  addTerminalLog: (log: string) =>
    set((state) => ({
      terminalLogs: [...state.terminalLogs.slice(-99), log],
    })),

  clearTerminalLogs: () => set({ terminalLogs: [] }),
}));
