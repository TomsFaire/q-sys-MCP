/**
 * Connection Manager — Multi-core registry and lifecycle
 * TODO: Implement in plan 04
 */

import { CoreAlias, CoreConfig, ConnectionState } from "./types.js";
import { QrcClient } from "./clients/qrc-client.js";
import { EcpClient } from "./clients/ecp-client.js";

export class ConnectionManager {
  private cores: Map<CoreAlias, CoreConfig> = new Map();
  private qrcClients: Map<CoreAlias, QrcClient> = new Map();
  private ecpClients: Map<CoreAlias, EcpClient> = new Map();
  private connectionStates: Map<CoreAlias, ConnectionState> = new Map();

  constructor() {
    // TODO: Parse QSYS_CORES environment variable
  }

  async getClients(alias: CoreAlias): Promise<{ qrc: QrcClient; ecp: EcpClient }> {
    // TODO: Implement client retrieval with lazy/eager connect logic
    throw new Error("Not implemented in scaffolding phase");
  }

  listCores(): Array<{ alias: CoreAlias; state: ConnectionState }> {
    // TODO: Implement listing
    return [];
  }
}

export const connectionManager = new ConnectionManager();
