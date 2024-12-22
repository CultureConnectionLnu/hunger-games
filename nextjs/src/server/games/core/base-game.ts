import { create } from "domain";

export interface BaseGameState {
  isRunning: boolean;
  startOrResumeGame: () => void;
  pauseGame: () => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  isRunning: false,
  pauseGame: () => set({ isRunning: false }),
  resumeGame: () => set({ isRunning: true }),
  resetGame: () => set({ isRunning: false }), // Additional logic as needed
}));
