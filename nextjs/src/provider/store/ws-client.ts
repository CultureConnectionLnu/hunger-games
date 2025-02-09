import { WebSocket as BackendWebSocket } from "ws";
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
  private isBrowser: boolean;
  private isClosed = false;

  constructor(
    private onMessage: (message: WsMessageToClient) => void,
    private onConnectedChange: (connected: boolean) => void,
    private getToken: () => Promise<string>,
    url?: string,
  ) {
    if (url === undefined) {
      this.isBrowser = true;
      this.url = window.location.origin;
    } else {
      this.isBrowser = false;
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
    const result = await (this.isBrowser
      ? this.initBrowser()
      : this.initServer());

    if (!result) {
      return;
    }

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

  private async initBrowser() {
    const token = await this.getToken();
    if (!token) {
      this.send = () => {
        throw new Error("WSClient is not logged in");
      };
      return;
    }
    const ws = new WebSocket(this.url, token);
    // only a guess that this works:
    // https://stackoverflow.com/questions/4361173/http-headers-in-websockets-client-api

    ws.onmessage = (event) => {
      const message = this.parseMessage(event.data as string);
      this.onMessage(message);
    };

    ws.onerror = (event) => {
      console.error("WS error", event);
    };

    return {
      ws,
      send: (message: WSMessageFromClient) =>
        ws.send(this.serializeMessage(message)),
    };
  }

  private async initServer() {
    const ws = new BackendWebSocket(this.url, {
      headers: {
        Authorization: `Bearer ${await this.getToken()}`,
      },
    });

    ws.onmessage = (event) => {
      const message = this.parseMessage(event.data as string);
      this.onMessage(message);
    };

    ws.onerror = (event) => {
      console.error("WS error", event);
    };

    return {
      ws,
      send: (message: WSMessageFromClient) =>
        ws.send(this.serializeMessage(message)),
    };
  }

  private parseMessage(messageString: string) {
    return JSON.parse(messageString) as WsMessageToClient;
  }

  private serializeMessage(message: WSMessageFromClient) {
    return JSON.stringify(message);
  }

  private tryReconnect() {
    if (this.isClosed) {
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
