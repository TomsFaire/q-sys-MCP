/**
 * ECP Client — Text protocol over TCP (port 1702)
 *
 * Implements the simple line-based ECP protocol:
 * - Commands are sent as plain text with CRLF (\r\n)
 * - Responses are read as lines until complete
 * - Connection includes exponential backoff reconnect logic
 *
 * Reconnect Strategy:
 * - Uses exponential backoff on connection failures (max 5 seconds)
 * - Automatically attempts reconnect on socket errors
 * - Connection state is tracked to prevent concurrent connection attempts
 * - Future: Can be extended to use Connection Manager's centralized backoff
 */

import { Socket } from "node:net";
import { EcpControlResult } from "../types.js";

export class EcpClient {
  private host: string;
  private port: number;
  private socket: Socket | null = null;
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectDelay = 5000; // milliseconds
  private readonly baseReconnectDelay = 100; // milliseconds
  private lineBuffer: string[] = [];
  private lineBufferResolve: ((line: string) => void) | null = null;

  constructor(host: string, port: number = 1702) {
    this.host = host;
    this.port = port;
  }

  /**
   * Connect to the ECP server with exponential backoff retry
   */
  async connect(): Promise<void> {
    if (this.connected && this.socket) {
      return; // Already connected
    }

    return this.connectWithRetry();
  }

  /**
   * Internal connect with exponential backoff
   */
  private async connectWithRetry(): Promise<void> {
    while (!this.connected) {
      try {
        await this.performConnect();
        this.reconnectAttempts = 0;
        return;
      } catch (error) {
        const delay = Math.min(
          this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
          this.maxReconnectDelay
        );
        this.reconnectAttempts++;

        // Re-throw if max retries exceeded (3 attempts = ~700ms total wait)
        if (this.reconnectAttempts > 2) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Perform the actual TCP socket connection
   */
  private performConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new Socket();

        this.socket.on("connect", () => {
          this.connected = true;
          resolve();
        });

        this.socket.on("error", (error) => {
          this.connected = false;
          reject(error);
        });

        this.socket.on("end", () => {
          this.connected = false;
          this.socket = null;
        });

        this.socket.on("data", (data: Buffer) => {
          const text = data.toString("utf-8");
          const lines = text.split(/\r?\n/);

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.length > 0) {
              // Non-empty line - resolve waiting promise or buffer
              if (this.lineBufferResolve) {
                const resolver = this.lineBufferResolve;
                this.lineBufferResolve = null;
                resolver(line);
              } else {
                this.lineBuffer.push(line);
              }
            }
          }
        });

        this.socket.connect(this.port, this.host);

        // Timeout if connection takes too long
        const timeout = setTimeout(() => {
          if (!this.connected && this.socket) {
            this.socket.destroy();
            reject(new Error(`Connection timeout to ${this.host}:${this.port}`));
          }
        }, 5000);

        this.socket.once("connect", () => clearTimeout(timeout));
        this.socket.once("error", () => clearTimeout(timeout));
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the ECP server
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
    this.lineBuffer = [];
    this.lineBufferResolve = null;
  }

  /**
   * Send a command and read a single line response
   */
  private async sendCommand(command: string): Promise<string> {
    if (!this.connected || !this.socket) {
      await this.connect();
    }

    if (!this.socket) {
      throw new Error("Failed to establish connection");
    }

    // Send command with CRLF
    return new Promise((resolve, reject) => {
      this.socket!.write(`${command}\r\n`, "utf-8", async (error) => {
        if (error) {
          reject(error);
          return;
        }

        try {
          const response = await this.readLine();
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Read the next line from the socket
   */
  private readLine(): Promise<string> {
    if (this.lineBuffer.length > 0) {
      return Promise.resolve(this.lineBuffer.shift()!);
    }

    return new Promise<string>((resolve, reject) => {
      // Timeout if no response within reasonable time
      const timeout = setTimeout(() => {
        this.lineBufferResolve = null;
        reject(new Error("ECP command timeout"));
      }, 5000);

      // Set up the resolver to clear timeout and resolve
      const originalResolve = resolve;
      this.lineBufferResolve = (line: string) => {
        clearTimeout(timeout);
        originalResolve(line);
      };
    });
  }

  /**
   * Get named control value, string, and position
   * Sends: cgc <controlName>
   * Response: <value>,<string>,<position>
   */
  async getControl(name: string): Promise<EcpControlResult> {
    const response = await this.sendCommand(`cgc ${name}`);

    // Check for error response
    if (response.startsWith("ERR")) {
      throw new Error(`Failed to get control '${name}': ${response}`);
    }

    // Parse response: value,string,position
    const parts = response.split(",");
    if (parts.length < 3) {
      throw new Error(
        `Invalid ECP response for cgc ${name}: ${response}`
      );
    }

    return {
      value: parseFloat(parts[0]),
      string: parts.slice(1, -1).join(","), // Handle commas in string
      position: parseFloat(parts[parts.length - 1]),
    };
  }

  /**
   * Set named control by value
   * Sends: csv <controlName> <value>
   * Response: ok or error
   */
  async setControlValue(name: string, value: number): Promise<void> {
    const response = await this.sendCommand(`csv ${name} ${value}`);

    if (response.startsWith("ERR")) {
      throw new Error(
        `Failed to set control '${name}' to ${value}: ${response}`
      );
    }
  }

  /**
   * Set named control by position (0.0-1.0)
   * Sends: csp <controlName> <position>
   * Response: ok or error
   */
  async setControlPosition(name: string, position: number): Promise<void> {
    if (position < 0 || position > 1) {
      throw new Error(
        `Position must be between 0.0 and 1.0, got ${position}`
      );
    }

    const response = await this.sendCommand(`csp ${name} ${position}`);

    if (response.startsWith("ERR")) {
      throw new Error(
        `Failed to set control '${name}' position to ${position}: ${response}`
      );
    }
  }

  /**
   * Get control string value
   * Sends: cgs <controlName>
   * Response: <string>
   */
  async getControlString(name: string): Promise<string> {
    const response = await this.sendCommand(`cgs ${name}`);

    if (response.startsWith("ERR")) {
      throw new Error(`Failed to get control string '${name}': ${response}`);
    }

    return response;
  }

  /**
   * Load snapshot by name
   * Sends: ssl <snapshotName>
   * Response: ok or error
   */
  async loadSnapshotByName(snapshotName: string): Promise<void> {
    const response = await this.sendCommand(`ssl ${snapshotName}`);

    if (response.startsWith("ERR")) {
      throw new Error(
        `Failed to load snapshot '${snapshotName}': ${response}`
      );
    }
  }

  /**
   * Load snapshot by bank and number
   * Sends: ssa <bank> <number>
   * Response: ok or error
   */
  async loadSnapshotByPosition(bank: number, number: number): Promise<void> {
    const response = await this.sendCommand(`ssa ${bank} ${number}`);

    if (response.startsWith("ERR")) {
      throw new Error(
        `Failed to load snapshot bank=${bank} number=${number}: ${response}`
      );
    }
  }

  /**
   * Unified snapshot load: accepts either name or {bank, number}
   */
  async loadSnapshot(
    nameOrPosition: string | { bank: number; number: number }
  ): Promise<void> {
    if (typeof nameOrPosition === "string") {
      return this.loadSnapshotByName(nameOrPosition);
    } else {
      return this.loadSnapshotByPosition(
        nameOrPosition.bank,
        nameOrPosition.number
      );
    }
  }
}
