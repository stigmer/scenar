import { createClient, type Client } from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { DeployCommandController } from "@scenar/stubs/ai/scenar/deploy/v1/command_pb.js";
import { ScenarioCommandController } from "@scenar/stubs/ai/scenar/scenario/v1/command_pb.js";

/** The backend controllers `scenar deploy` drives. */
export interface BackendClients {
  readonly deploy: Client<typeof DeployCommandController>;
  readonly scenario: Client<typeof ScenarioCommandController>;
}

/**
 * Build typed Connect clients over a single gRPC transport, mirroring the
 * canonical CLI pattern (createClient(service, transport)). The transport uses
 * Node's http2 module; an http:// baseUrl speaks gRPC over cleartext HTTP/2
 * (h2c), which is what the local scenar-service expects.
 *
 * Auth: none is sent for local `test` security mode (the backend injects a
 * synthetic authorized caller). A production scoped-API-key path would attach a
 * bearer interceptor here — the clean seam is the transport's interceptors.
 */
export function createBackendClients(baseUrl: string): BackendClients {
  const transport = createGrpcTransport({ baseUrl });
  return {
    deploy: createClient(DeployCommandController, transport),
    scenario: createClient(ScenarioCommandController, transport),
  };
}
