import type { WebSocket as BackendWebSocket } from "ws";
import {
  type WSMessageFromClient,
  type WsMessageToClient,
} from "~/server/ws/web-socket-connection";

const FIRST_RECONNECT_TIMEOUT_IN_MS = 100;

export class WSClient {
  private url;
  private ws?: WebSocket | BackendWebSocket;
  private reconnectAttempts = 0;
  private reconnectTimeout = FIRST_RECONNECT_TIMEOUT_IN_MS;
  private isClosed = false;

  constructor(
    private onMessage: (message: WsMessageToClient) => void,
    private onConnectedChange: (connected: boolean) => void,
    private isLoggedIn: () => boolean,
    url?: string,
    private wsFactory: (url: string) => NonNullable<WSClient["ws"]> = (url) =>
      new WebSocket(url),
  ) {
    if (url === undefined) {
      const wsUrl = new URL(window.location.origin);
      wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
      wsUrl.pathname = "/ws";
      this.url = wsUrl.toString();
    } else {
      this.url = url;
    }

    // explicitly don't await, as a constructor is not a promise
    void this.init();
  }

  public send: (message: WSMessageFromClient) => void = () => {
    throw new Error("WSClient is not connected yet");
  };

  /**
   * Closes the WebSocket connection and prevents further attempts to reconnect.
   * Should only be used for cleanup.
   */
  public close() {
    this.isClosed = true;
    this.send = () => {
      throw new Error("WSClient is closed");
    };
    this.ws?.close();
  }

  private async init() {
    if (this.isLoggedIn() === false) {
      this.send = () => {
        throw new Error("WSClient is not logged in");
      };
      return;
    }

    const ws = this.wsFactory(this.url);
    const result =
      ws instanceof WebSocket ? this.initBrowser(ws) : this.initServer(ws);

    this.ws = result.ws;
    this.send = result.send;

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.reconnectTimeout = FIRST_RECONNECT_TIMEOUT_IN_MS;
      this.onConnectedChange(true);
    };

    this.ws.onclose = () => {
      this.onConnectedChange(false);
      this.tryReconnect();
    };
    return result;
  }

  private initBrowser(ws: WebSocket) {
    ws.onmessage = (event) => this.wsOnMessageHandler(event.data as string);
    ws.onerror = (event) => this.wsOnErrorHandler(event);

    return {
      ws,
      send: (message: WSMessageFromClient) =>
        ws.send(this.serializeMessage(message)),
    };
  }

  /**
   * Exists for integration tests.
   */
  private initServer(ws: BackendWebSocket) {
    ws.onmessage = (event) => this.wsOnMessageHandler(event.data as string);
    ws.onerror = (event) => this.wsOnErrorHandler(event);

    return {
      ws,
      send: (message: WSMessageFromClient) =>
        ws.send(this.serializeMessage(message)),
    };
  }

  private wsOnMessageHandler(data: string) {
    const message = this.parseMessage(data);
    if (message.type === "ping") {
      this.send({ type: "pong", id: message.id });
      return;
    }
    this.onMessage(message);
  }

  private wsOnErrorHandler(event: unknown) {
    console.error("WS error", event);
  }

  private parseMessage(messageString: string) {
    return JSON.parse(messageString) as WsMessageToClient;
  }

  private serializeMessage(message: WSMessageFromClient) {
    return JSON.stringify(message);
  }

  private tryReconnect() {
    if (this.isClosed || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    setTimeout(() => {
      console.log(`Attempting to reconnect... (${this.reconnectAttempts + 1})`);
      this.reconnectAttempts++;
      this.reconnectTimeout *= 2; // Exponential backoff

      // explicitly don't await, as a timeout is not a promise
      void this.init();
    }, this.reconnectTimeout);
  }
}
