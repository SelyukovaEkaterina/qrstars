import { create } from "zustand";

import { DEFAULT_QR_CONFIG } from "@/qr/presets";
import type { QRContentState, QRTemplateConfig } from "@/qr/types";
import { DEFAULT_QR_CONTENT } from "@/qr/payload";

interface DesignState {
  config: QRTemplateConfig;
  content: QRContentState;
  setConfig: (patch: Partial<QRTemplateConfig>) => void;
  setContent: (patch: Partial<QRContentState>) => void;
  applyPreset: (config: QRTemplateConfig) => void;
  reset: () => void;
}

export const useDesignStore = create<DesignState>((set) => ({
  config: { ...DEFAULT_QR_CONFIG },
  content: { ...DEFAULT_QR_CONTENT },
  setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
  setContent: (patch) => set((s) => ({ content: { ...s.content, ...patch } })),
  applyPreset: (config) => set({ config: { ...config } }),
  reset: () =>
    set({
      config: { ...DEFAULT_QR_CONFIG },
      content: { ...DEFAULT_QR_CONTENT },
    }),
}));
