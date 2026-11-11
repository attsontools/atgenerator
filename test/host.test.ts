import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createPluginHost } from '../src/host/plugin';
import { createStandaloneHost } from '../src/host/standalone';
import { copyText, type CopyDependencies } from '../src/host/types';

describe('clipboard adapter', () => {
  it('prefers Clipboard API and falls back only when unavailable', async () => {
    const calls: string[] = [];
    const dependencies: CopyDependencies = {
      writeClipboard: async (value) => calls.push(`clipboard:${value}`),
      fallbackCopy: (value) => {
        calls.push(`fallback:${value}`);
        return true;
      }
    };
    await copyText('result', dependencies);
    assert.deepEqual(calls, ['clipboard:result']);

    await copyText('fallback', {
      fallbackCopy(value) {
        calls.push(value);
        return true;
      }
    });
    assert.equal(calls.at(-1), 'fallback');
  });

  it('reports a rejected clipboard fallback', async () => {
    await assert.rejects(
      () => copyText('result', { fallbackCopy: () => false }),
      /Clipboard write was rejected/
    );
  });
});

describe('plugin host adapter', () => {
  it('handshakes for Generator and saves PNG through the approved Host API', async () => {
    const calls: Array<[string, unknown]> = [];
    let themeListener: ((theme: 'dark' | 'light') => void) | undefined;
    const host = createPluginHost(async (appId) => {
      assert.equal(appId, 'com.attson.generator');
      return {
        handshake: async () => ({ theme: 'dark' as const }),
        onThemeChange(listener) {
          themeListener = listener;
          return () => { themeListener = undefined; };
        },
        async call(method, params) {
          calls.push([method, params]);
          return { cancelled: false };
        },
        close() {}
      };
    });

    const themes: string[] = [];
    assert.equal(await host.initialize((theme) => themes.push(theme)), 'dark');
    themeListener?.('light');
    assert.deepEqual(themes, ['light']);
    assert.equal(await host.savePng('qrcode.png', 'iVBORw0KGgo='), true);
    assert.deepEqual(calls, [[
      'host.file.save',
      { suggestedName: 'qrcode.png', content: 'iVBORw0KGgo=', encoding: 'base64' }
    ]]);
    host.dispose();
  });
});

describe('standalone host adapter', () => {
  it('uses the system save dialog and writes the selected PNG path', async () => {
    const calls: Array<[string, unknown]> = [];
    const host = createStandaloneHost({
      readTheme: () => null,
      writeTheme() {},
      saveDialog: async () => '/tmp/qrcode.png',
      invoke: async (command, payload) => calls.push([command, payload])
    });

    assert.equal(await host.savePng('qrcode.png', 'iVBORw0KGgo='), true);
    assert.deepEqual(calls, [[
      'write_binary_file',
      { path: '/tmp/qrcode.png', base64: 'iVBORw0KGgo=' }
    ]]);
  });

  it('treats a cancelled system dialog as a non-error result', async () => {
    const host = createStandaloneHost({
      readTheme: () => null,
      writeTheme() {},
      saveDialog: async () => null,
      invoke: async () => assert.fail('invoke must not run after cancellation')
    });
    assert.equal(await host.savePng('qrcode.png', 'iVBORw0KGgo='), false);
  });
});
