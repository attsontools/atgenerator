import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_PLUGIN_PNG_BASE64_BYTES,
  createQrMatrix,
  qrGeometry,
  renderQrPng
} from '../src/qr';

describe('QR encoding', () => {
  it('supports every existing error correction level', () => {
    for (const level of ['L', 'M', 'Q', 'H'] as const) {
      const matrix = createQrMatrix('https://example.com', level);
      assert.ok(matrix.moduleCount >= 21);
      assert.equal(typeof matrix.isDark(0, 0), 'boolean');
    }
  });

  it('preserves the current quiet-zone compatibility rule', () => {
    assert.deepEqual(qrGeometry(21, 8, 0), {
      moduleCount: 21,
      modulePixels: 8,
      quietModules: 0,
      imagePixels: 168
    });
    assert.deepEqual(qrGeometry(21, 8, 1), {
      moduleCount: 21,
      modulePixels: 8,
      quietModules: 4,
      imagePixels: 232
    });
    assert.deepEqual(qrGeometry(21, 8, 20), qrGeometry(21, 8, 1));
  });

  it('draws a PNG with the requested module size and compatible margin', () => {
    const draws: Array<[number, number, number, number, string]> = [];
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        fillStyle: '',
        fillRect(x: number, y: number, width: number, height: number) {
          draws.push([x, y, width, height, this.fillStyle]);
        }
      }),
      toDataURL: () => 'data:image/png;base64,iVBORw0KGgo='
    };
    const result = renderQrPng('A', {
      ecLevel: 'M',
      modulePixels: 3,
      quietZone: 7
    }, { createCanvas: () => canvas });

    assert.equal(canvas.width, result.imagePixels);
    assert.equal(canvas.height, result.imagePixels);
    assert.equal(result.quietModules, 4);
    assert.equal(result.base64, 'iVBORw0KGgo=');
    assert.deepEqual(draws[0], [0, 0, result.imagePixels, result.imagePixels, '#ffffff']);
    assert.equal(draws.some((draw) => draw[4] === '#000000'), true);
  });

  it('rejects empty, oversized, invalid, and host-message-sized output', () => {
    assert.throws(() => createQrMatrix('', 'M'), /请输入要编码的内容/);
    assert.throws(() => qrGeometry(21, 0, 4), /模块像素/);
    assert.throws(() => qrGeometry(21, 41, 4), /模块像素/);
    assert.throws(() => qrGeometry(21, 8, 21), /留白/);

    const oversized = 'A'.repeat(MAX_PLUGIN_PNG_BASE64_BYTES + 1);
    assert.throws(() => renderQrPng('A', {
      ecLevel: 'M', modulePixels: 1, quietZone: 0
    }, {
      createCanvas: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ fillStyle: '', fillRect() {} }),
        toDataURL: () => `data:image/png;base64,${oversized}`
      })
    }), /PNG 文件过大/);
  });
});
