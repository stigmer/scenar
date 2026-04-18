<div align="center">

# Scenar

**Declarative scenario playback engine.**

Describe your demo once. Play it on your website. Export it as a video. Same file, same result.

[![License](https://img.shields.io/github/license/scenar-ai/scenar)](LICENSE)
[![npm](https://img.shields.io/npm/v/@scenar/react)](https://www.npmjs.com/package/@scenar/react)
[![GitHub stars](https://img.shields.io/github/stars/scenar-ai/scenar?style=flat)](https://github.com/scenar-ai/scenar/stargazers)

</div>

## Quick Start

Install the packages:

```bash
npm install @scenar/react @scenar/sdk framer-motion
```

Create a scenario and render it:

```tsx
import { createScenario } from "@scenar/sdk";
import { ScenarioPlayer } from "@scenar/react";
import "@scenar/react/theme.css";

const scenario = createScenario({
  views: { intro: IntroSlide, demo: DemoView },
  steps: [
    { view: "intro", delayMs: 0, caption: "Welcome", props: { title: "Hello" } },
    { view: "demo", delayMs: 2000, caption: "See it in action", props: { active: true } },
  ],
});

function App() {
  return (
    <ScenarioPlayer steps={scenario.steps}>
      {(data) => {
        const View = scenario.views[data.view];
        return <View {...data.props} />;
      }}
    </ScenarioPlayer>
  );
}
```

You supply the React components (`IntroSlide`, `DemoView`). Scenar handles playback timing, cursor animation, viewport transitions, and narration.

## What You Get

- **One source, two outputs** -- The same scenario definition drives interactive web playback and frame-accurate video export.
- **Your components, your brand** -- You supply the React components. Scenar handles timing, cursor animation, viewport transitions, and narration.
- **Proto-backed contract** -- Scenarios are defined against a protobuf schema. Validate with the CLI. Load from YAML or from code.

## Preview Generation

Already have a React app? Scenar can scan it and set up the view registry for you.

```bash
scenar preview init --source ./my-app --output ./docs-site/.scenar
```

This discovers your components, detects your framework, and generates a `.scenar/` directory with everything wired up. Source and output can be different projects -- ideal for monorepos where your app and docs site live side by side.

```tsx
import { previewViews } from "./.scenar/preview";

const scenario = createScenario({
  views: previewViews,
  steps: [
    { view: "Dashboard", delayMs: 0, props: { filter: "active" } },
    { view: "OrderDetail", delayMs: 2000, props: { orderId: "ORD-123" } },
  ],
});
```

Re-run `scenar preview sync` any time your app changes. Your custom views and provider config are always preserved.

## Packages

| Package | What it does |
|---------|-------------|
| [`@scenar/core`](packages/core) | Types, timeline math, step actions -- no framework dependency |
| [`@scenar/sdk`](packages/sdk) | `createScenario()` builder + proto loader |
| [`@scenar/react`](packages/react) | `ScenarioPlayer`, cursor, viewport, narration, view shells |
| [`@scenar/preview`](packages/preview) | Scan a React project, generate a view registry automatically |
| [`@scenar/cli`](packages/cli) | Validate YAML, generate narration, manage previews |

## Scenario Shape

A scenario is a list of steps. Each step names a view (your React component), a delay, and optional interactions like cursor clicks, typing, or viewport zooms.

```yaml
viewport:
  width: 896
  height: 540
steps:
  - view: landing-page
    delay_ms: 0
    caption: "Start here"
    narration_text: "Let's walk through the setup."
  - view: settings-panel
    delay_ms: 1500
    caption: "Configure your keys"
    interactions:
      - at_percent: 0.3
        type: hover
        target: api-key-row
  - view: create-form
    delay_ms: 2500
    caption: "Name your key"
    interactions:
      - at_percent: 0.15
        type: type
        target: name-input
        type_config:
          text: "quickstart-key"
```

Load YAML scenarios at runtime with `loadScenarioFromProto()` from `@scenar/sdk`, or author them in code with `createScenario()`.

## CLI

```bash
# Scan your app and generate preview views
scenar preview init --source ./my-app --output ./.scenar

# Re-scan after adding components (preserves your customizations)
scenar preview sync --source ./my-app --output ./.scenar

# Validate a scenario file
scenar validate demo.yaml

# Generate narration audio from step text
scenar narrate demo.yaml --out ./narration
```

Install the CLI from npm:

```bash
npm install -g @scenar/cli
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

- [GitHub Issues](https://github.com/scenar-ai/scenar/issues) -- Bug reports and feature requests

## License

Apache License 2.0. See [LICENSE](LICENSE).
