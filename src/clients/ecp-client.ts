/**
 * ECP Client — Text protocol over TCP (port 1702)
 * TODO: Implement in plan 03
 */

export class EcpClient {
  private host: string;
  private port: number;

  constructor(host: string, port: number = 1702) {
    this.host = host;
    this.port = port;
  }

  async connect(): Promise<void> {
    // TODO: Implement TCP connection
    throw new Error("Not implemented in scaffolding phase");
  }

  async sendCommand(command: string): Promise<string> {
    // TODO: Implement command/response
    throw new Error("Not implemented in scaffolding phase");
  }

  async disconnect(): Promise<void> {
    // TODO: Implement disconnect
  }
}
