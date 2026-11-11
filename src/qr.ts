import qrcode from 'qrcode-generator';

export type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrOptions {
  ecLevel: QrErrorCorrectionLevel;
  modulePixels: number;
  quietZone: number;
}

export interface QrMatrix {
  moduleCount: number;
  isDark(row: number, column: number): boolean;
}

export interface QrGeometry {
  moduleCount: number;
  modulePixels: number;
  quietModules: number;
  imagePixels: number;
}

interface CanvasContextLike {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, width: number, height: number): void;
}

interface CanvasLike {
  width: number;
  height: number;
  getContext(kind: '2d'): CanvasContextLike | null;
  toDataURL(type: 'image/png'): string;
}

export interface QrRenderDependencies {
  createCanvas(): CanvasLike;
}

export interface RenderedQrPng extends QrGeometry {
  dataUrl: string;
  base64: string;
}

export const MAX_PLUGIN_PNG_BASE64_BYTES = 900 * 1024;

qrcode.stringToBytes = (value) => Array.from(new TextEncoder().encode(value));

export function createQrMatrix(
  text: string,
  ecLevel: QrErrorCorrectionLevel
): QrMatrix {
  if (!text.trim()) throw new Error('请输入要编码的内容');
  try {
    const code = qrcode(0, ecLevel);
    code.addData(text, 'Byte');
    code.make();
    return {
      moduleCount: code.getModuleCount(),
      isDark: (row, column) => code.isDark(row, column)
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`二维码内容超出容量或无法编码：${detail}`);
  }
}

export function qrGeometry(
  moduleCount: number,
  modulePixels: number,
  quietZone: number
): QrGeometry {
  if (!Number.isInteger(moduleCount) || moduleCount < 1) {
    throw new Error('二维码矩阵尺寸无效');
  }
  if (!Number.isInteger(modulePixels) || modulePixels < 1 || modulePixels > 40) {
    throw new Error('模块像素必须是 1 到 40 的整数');
  }
  if (!Number.isInteger(quietZone) || quietZone < 0 || quietZone > 20) {
    throw new Error('留白必须是 0 到 20 的整数');
  }
  const quietModules = quietZone > 0 ? 4 : 0;
  return {
    moduleCount,
    modulePixels,
    quietModules,
    imagePixels: (moduleCount + quietModules * 2) * modulePixels
  };
}

export function renderQrPng(
  text: string,
  options: QrOptions,
  dependencies: QrRenderDependencies = browserQrDependencies()
): RenderedQrPng {
  const matrix = createQrMatrix(text, options.ecLevel);
  const geometry = qrGeometry(matrix.moduleCount, options.modulePixels, options.quietZone);
  const canvas = dependencies.createCanvas();
  canvas.width = geometry.imagePixels;
  canvas.height = geometry.imagePixels;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前环境无法创建二维码画布');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, geometry.imagePixels, geometry.imagePixels);
  context.fillStyle = '#000000';
  const offset = geometry.quietModules * geometry.modulePixels;
  for (let row = 0; row < matrix.moduleCount; row += 1) {
    for (let column = 0; column < matrix.moduleCount; column += 1) {
      if (!matrix.isDark(row, column)) continue;
      context.fillRect(
        offset + column * geometry.modulePixels,
        offset + row * geometry.modulePixels,
        geometry.modulePixels,
        geometry.modulePixels
      );
    }
  }

  const dataUrl = canvas.toDataURL('image/png');
  const prefix = 'data:image/png;base64,';
  if (!dataUrl.startsWith(prefix)) throw new Error('二维码 PNG 导出失败');
  const base64 = dataUrl.slice(prefix.length);
  if (new TextEncoder().encode(base64).byteLength > MAX_PLUGIN_PNG_BASE64_BYTES) {
    throw new Error('PNG 文件过大，无法通过平台保存，请减小模块像素或输入内容');
  }
  return { ...geometry, dataUrl, base64 };
}

function browserQrDependencies(): QrRenderDependencies {
  return {
    createCanvas() {
      return document.createElement('canvas');
    }
  };
}
