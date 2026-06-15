# @scenar/stubs

Generated TypeScript stubs (protobuf-es v2) for the Scenar APIs. This package is the typed wire contract — message schemas and Connect service definitions — shared by Scenar clients and tooling.

These files are generated from the protobuf source, not hand-written. Do not edit them directly; change the `.proto` definitions and regenerate.

## Install

```bash
pnpm add @scenar/stubs @bufbuild/protobuf
```

## Usage

Import from the generated subpath that matches the proto package. Paths mirror the proto directory layout, with the `_pb.js` suffix:

```ts
import { ScenarioQueryController } from "@scenar/stubs/ai/scenar/scenario/v1/query_pb";
import { DeployCommandController } from "@scenar/stubs/ai/scenar/deploy/v1/command_pb";
```

## Regenerate

From the repository root:

```bash
make protos
```

## License

Apache-2.0
