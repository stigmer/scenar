// @scenar/preview/connect — Connect-RPC MSW handler utilities.
//
// Provides typed, protocol-aware MSW handler builders for Connect-RPC
// services. Works with any @bufbuild/protobuf service descriptor.
//
// Two variants:
//   connectFixture  — synchronous, requires msw as a direct dependency
//   connectHandler  — async, lazy-imports msw (works when msw is optional)

export { connectFixture } from "./connect-fixture.js";

export {
  connectHandler,
  connectHandlers,
} from "./connect-handler.js";

export type {
  ConnectFixtureHandler,
  ConnectHandlerOptions,
} from "./connect-handler.js";
