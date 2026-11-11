import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';

import { copyText, type GeneratorHost, type ThemeName } from './types';

const STORAGE_KEY = 'atgenerator.theme';

export interface StandaloneDependencies {
  readTheme(): string | null;
  writeTheme(theme: ThemeName): void;
  saveDialog(options: {
    defaultPath: string;
    filters: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | null>;
  invoke(command: string, payload: unknown): Promise<unknown>;
}

export function createStandaloneHost(dependencies: StandaloneDependencies): GeneratorHost {
  let theme: ThemeName = 'dark';
  let themeListener: ((theme: ThemeName) => void) | null = null;
  return {
    mode: 'standalone',
    async initialize(onTheme) {
      themeListener = onTheme;
      theme = dependencies.readTheme() === 'light' ? 'light' : 'dark';
      return theme;
    },
    async toggleTheme() {
      theme = theme === 'dark' ? 'light' : 'dark';
      dependencies.writeTheme(theme);
      themeListener?.(theme);
      return theme;
    },
    copy: copyText,
    async savePng(suggestedName, base64) {
      const path = await dependencies.saveDialog({
        defaultPath: suggestedName,
        filters: [{ name: 'PNG', extensions: ['png'] }]
      });
      if (!path) return false;
      await dependencies.invoke('write_binary_file', { path, base64 });
      return true;
    },
    dispose() {
      themeListener = null;
    }
  };
}

export const host = createStandaloneHost({
  readTheme: () => localStorage.getItem(STORAGE_KEY),
  writeTheme: (theme) => localStorage.setItem(STORAGE_KEY, theme),
  saveDialog: (options) => save(options),
  invoke
});
