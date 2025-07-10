declare module 'html5-qrcode' {
  export interface Html5QrcodeScannerConfig {
    fps?: number;
    qrbox?: {
      width: number;
      height: number;
    } | number;
    aspectRatio?: number;
    disableFlip?: boolean;
    verbose?: boolean;
    showTorchButtonIfSupported?: boolean;
    showZoomSliderIfSupported?: boolean;
    defaultZoomValueIfSupported?: number;
    rememberLastUsedCamera?: boolean;
    videoConstraints?: MediaTrackConstraints;
  }

  export interface Html5QrcodeResult {
    decodedText: string;
    result: any;
  }

  export type QrcodeScanType = 0 | 1;
  export type QrcodeSuccessCallback = (decodedText: string, result: Html5QrcodeResult) => void;
  export type QrcodeErrorCallback = (errorMessage: string, error: any) => void;

  export class Html5QrcodeScanner {
    constructor(
      elementId: string,
      config: Html5QrcodeScannerConfig,
      verbose?: boolean
    );

    render(
      qrcodeSuccessCallback: QrcodeSuccessCallback,
      qrcodeErrorCallback?: QrcodeErrorCallback
    ): Promise<void>;

    clear(): Promise<void>;
  }

  export class Html5Qrcode {
    constructor(elementId: string, verbose?: boolean);

    start(
      cameraIdOrConfig: string | MediaTrackConstraints,
      configuration: Html5QrcodeScannerConfig,
      qrcodeSuccessCallback: QrcodeSuccessCallback,
      qrcodeErrorCallback?: QrcodeErrorCallback
    ): Promise<void>;

    stop(): Promise<void>;
    clear(): void;

    static getCameras(): Promise<any[]>;
  }
} 