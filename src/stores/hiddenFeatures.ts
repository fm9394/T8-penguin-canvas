import { create } from 'zustand';

interface HiddenFeatureState {
  rhDuckUploadIds: string[];
  toggleRhDuckUpload: (id: string) => boolean;
  clearRhDuckUpload: (id: string) => void;
}

export const useHiddenFeatureStore = create<HiddenFeatureState>()((set) => ({
  rhDuckUploadIds: [],
  toggleRhDuckUpload: (id) => {
    let enabled = false;
    set((state) => {
      const exists = state.rhDuckUploadIds.includes(id);
      enabled = !exists;
      return {
        rhDuckUploadIds: exists
          ? state.rhDuckUploadIds.filter((item) => item !== id)
          : [...state.rhDuckUploadIds, id],
      };
    });
    return enabled;
  },
  clearRhDuckUpload: (id) =>
    set((state) => ({ rhDuckUploadIds: state.rhDuckUploadIds.filter((item) => item !== id) })),
}));

export function isRhDuckUploadEnabled(ids: string[], id?: string | null): boolean {
  return !!id && ids.includes(id);
}
