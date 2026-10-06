import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const KEY = "kimbo.profileId";

interface SessionState {
  profileId: string | null;
  loaded: boolean;
  load: () => Promise<void>;
  setProfileId: (id: string) => Promise<void>;
  clear: () => Promise<void>;
}

/** The anonymous device profile. No login in Phase 1 — the id is the device's key to its data. */
export const useSession = create<SessionState>((set) => ({
  profileId: null,
  loaded: false,
  load: async () => {
    const id = await SecureStore.getItemAsync(KEY);
    set({ profileId: id, loaded: true });
  },
  setProfileId: async (id) => {
    await SecureStore.setItemAsync(KEY, id);
    set({ profileId: id });
  },
  clear: async () => {
    await SecureStore.deleteItemAsync(KEY);
    set({ profileId: null });
  },
}));
