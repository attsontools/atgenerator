import { connectPlugin, type PluginClient } from '@attson/plugin-sdk/browser';

import { copyText, type GeneratorHost, type ThemeName } from './types';

interface PluginConnection {
  handshake(): Promise<{ theme: ThemeName }>;
  onThemeChange(listener: (theme: ThemeName) => void): () => void;
  call<T>(method: string, params?: unknown): Promise<T>;
  close(): void;
}

type ConnectPlugin = (appId: string) => Promise<PluginConnection>;

export function createPluginHost(connect: ConnectPlugin): GeneratorHost {
  let client: PluginConnection | null = null;
  let removeThemeListener: (() => void) | null = null;
  let currentTheme: ThemeName = 'dark';
  return {
    mode: 'plugin',
    async initialize(onTheme) {
      client = await connect('com.attson.generator');
      const handshake = await client.handshake();
      currentTheme = handshake.theme;
      removeThemeListener = client.onThemeChange((theme) => {
        currentTheme = theme;
        onTheme(theme);
      });
      return currentTheme;
    },
    async toggleTheme() {
      return currentTheme;
    },
    copy: copyText,
    async savePng(suggestedName, base64) {
      if (!client) throw new Error('Host API is not connected');
      const result = await client.call<{ cancelled: boolean }>('host.file.save', {
        suggestedName,
        content: base64,
        encoding: 'base64'
      });
      return !result.cancelled;
    },
    dispose() {
      removeThemeListener?.();
      removeThemeListener = null;
      client?.close();
      client = null;
    }
  };
}

export const host = createPluginHost(
  (appId) => connectPlugin(appId) as Promise<PluginClient>
);
