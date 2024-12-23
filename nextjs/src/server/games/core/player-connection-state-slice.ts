import { StateCreator } from "zustand";

interface PlayerState {
  joined: boolean;
  ready: boolean;
  disconnected: boolean;
  id: string;
}
