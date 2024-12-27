import { WebSocket as BackendWebSocket } from "ws";
import {
  type WSMessageFromClient,
  type WsMessageToClient,
} from "~/server/web-socket-connection";

const FIRST_RECONNECT_TIMEOUT_IN_MS = 100;

export class WSClient {
  private url;
  private ws: WebSocket | BackendWebSocket;
  private reconnectAttempts = 0;
  private reconnectTimeout = FIRST_RECONNECT_TIMEOUT_IN_MS;
  private isBrowser: boolean;
  private isClosed = false;

  constructor(
    private onMessage: (message: WsMessageToClient) => void,
    private onConnectedChange: (connected: boolean) => void,
    private getToken: () => string,
    url?: string,
  ) {
    if (url === undefined) {
      this.isBrowser = true;
      this.url = window.location.origin;
    } else {
      this.isBrowser = false;
      this.url = url;
    }

    const { ws, send } = this.init();
    // the assignment is necessary to make the types work
    this.ws = ws;
    this.send = send;

    this.ws.onopen = () => {
      console.log("WS connected");
      this.reconnectAttempts = 0;
      this.reconnectTimeout = FIRST_RECONNECT_TIMEOUT_IN_MS;
      this.onConnectedChange(true);
    };

    this.ws.onclose = () => {
      console.log("WS disconnected");
      this.onConnectedChange(false);
      this.tryReconnect();
    };
  }

  public send: (message: WSMessageFromClient) => void;

  /**
   * Closes the WebSocket connection and prevents further attempts to reconnect.
   * Should only be used for cleanup.
   */
  public close() {
    this.isClosed = true;
    this.getToken = () => {
      throw new Error("WSClient is closed");
    };
    this.onConnectedChange = () => {
      throw new Error("WSClient is closed");
    };
    this.onMessage = () => {
      throw new Error("WSClient is closed");
    };
    this.ws.close();
  }

  private init() {
    const result = this.isBrowser ? this.initBrowser() : this.initServer();
    this.ws = result.ws;
    this.send = result.send;
    return result;
  }

  private initBrowser() {
    const urlWithToken = new URL(this.url);
    urlWithToken.username = this.getToken();
    const ws = new WebSocket(urlWithToken.toString());
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

  private initServer() {
    const ws = new BackendWebSocket(this.url, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
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
      this.init();
      this.reconnectAttempts++;
      this.reconnectTimeout *= 2; // Exponential backoff
    }, this.reconnectTimeout);
  }
}
