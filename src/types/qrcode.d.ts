declare module 'qrcode' {
  export interface QRCodeRenderersOptions {
    margin?: number;
    scale?: number;
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
    type?: 'image/png' | 'image/jpeg' | 'image/webp';
    quality?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    version?: number;
    maskPattern?: number;
  }

  export interface QRCodeCanvasOptions extends QRCodeRenderersOptions {
    canvas?: HTMLCanvasElement;
  }

  export interface QRCodeStringOptions extends QRCodeRenderersOptions {
    type?: 'svg' | 'terminal' | 'utf8';
  }

  // Canvas methods
  export function toCanvas(
    canvas: HTMLCanvasElement,
    text: string,
    options?: QRCodeCanvasOptions
  ): Promise<void>;

  export function toCanvas(
    text: string,
    options?: QRCodeCanvasOptions
  ): Promise<HTMLCanvasElement>;

  // Data URL methods
  export function toDataURL(
    text: string,
    options?: QRCodeRenderersOptions
  ): Promise<string>;

  // String methods
  export function toString(
    text: string,
    options?: QRCodeStringOptions
  ): Promise<string>;

  // Buffer methods (Node.js)
  export function toBuffer(
    text: string,
    options?: QRCodeRenderersOptions
  ): Promise<Buffer>;

  // File methods (Node.js)
  export function toFile(
    path: string,
    text: string,
    options?: QRCodeRenderersOptions
  ): Promise<void>;

  // SVG methods
  export function toSVG(
    text: string,
    options?: QRCodeStringOptions
  ): Promise<string>;

  // Default export
  const qrcode: {
    toCanvas: typeof toCanvas;
    toDataURL: typeof toDataURL;
    toString: typeof toString;
    toBuffer: typeof toBuffer;
    toFile: typeof toFile;
    toSVG: typeof toSVG;
  };

  export default qrcode;
} 