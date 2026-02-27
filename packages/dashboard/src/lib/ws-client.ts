/**
 * WebSocket client for receiving live simulator JPEG frames.
 * Handles reconnection and frame buffering.
 */
export class WSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private onFrame: (blob: Blob) => void;
  private onStatusChange: (connected: boolean) => void;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;

  constructor(
    url: string,
    onFrame: (blob: Blob) => void,
    onStatusChange: (connected: boolean) => void
  ) {
    this.url = url;
    this.onFrame = onFrame;
    this.onStatusChange = onStatusChange;
  }

  connect(): void {
    if (this.ws) return;

    try {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this._connected = true;
        this.onStatusChange(true);
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          const blob = new Blob([event.data], { type: 'image/jpeg' });
          this.onFrame(blob);
        }
      };

      this.ws.onclose = () => {
        this._connected = false;
        this.ws = null;
        this.onStatusChange(false);
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._connected = false;
  }

  get connected(): boolean {
    return this._connected;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }
}
