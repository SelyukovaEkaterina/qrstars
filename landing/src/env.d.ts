/// <reference path="../.astro/types.d.ts" />

interface Window {
  __QRSTARS_NO_ANALYTICS__?: boolean;
  ymGoal?: (goal: string, params?: Record<string, string | number | boolean>) => void;
}
