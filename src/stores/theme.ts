import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CanvasTheme = 'dark' | 'light';
export type ThemeStyle = 'tech' | 'pixel';

interface ThemeState {
  theme: CanvasTheme;
  style: ThemeStyle;
  toggleTheme: () => void;
  setTheme: (theme: CanvasTheme) => void;
  toggleStyle: () => void;
  setStyle: (style: ThemeStyle) => void;
}

/**
 * 主题状态管理(支持持久化到 localStorage)
 * - theme: dark | light 明暗模式
 * - style: tech | pixel 视觉风格
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      // 默认主题：像素风 + 白天模式（跟随风格联动）
      theme: 'light',
      style: 'pixel',
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setTheme: (theme) => set({ theme }),
      // 切换风格时联动默认模式:科技风默认深色、像素风默认浅色(切后用户仍可手动改)
      toggleStyle: () =>
        set((state) => {
          const next: ThemeStyle = state.style === 'tech' ? 'pixel' : 'tech';
          return { style: next, theme: next === 'pixel' ? 'light' : 'dark' };
        }),
      setStyle: (style) =>
        set({ style, theme: style === 'pixel' ? 'light' : 'dark' }),
    }),
    {
      name: 't8-canvas-theme',
    }
  )
);
