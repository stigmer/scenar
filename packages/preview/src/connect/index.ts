// @scenar/preview/connect — Connect-RPC MSW handler utilities.
//
// Provides typed, protocol-aware MSW handler builders for Connect-RPC
// services. Works with any @bufbuild/protobuf service descriptor.

export {
  connectHandler,
  connectHandlers,
} from "./connect-handler.js";

export type {
  ConnectFixtureHandler,
  ConnectHandlerOptions,
} from "./connect-handler.js";
