/**
 * MSW lifecycle bridge — abstracts browser vs Node MSW setup.
 *
 * In the browser, MSW uses a Service Worker (`setupWorker`).
 * In Node (e.g. Remotion video export), MSW uses request interceptors (`setupServer`).
 *
 * This module lazily imports MSW so it remains an optional peer dependency.
 * If MSW is not installed, fixture setup is silently skipped.
 */

/** Any MSW request handler — kept generic to avoid hard dependency on MSW types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FixtureHandler = any;

interface MswLifecycle {
  start(): Promise<void>;
  stop(): Promise<void>;
}

const isBrowser =
  typeof window !== "undefined" && typeof window.document !== "undefined";

/**
 * Create an MSW lifecycle manager for the given fixture handlers.
 * Returns `null` if MSW is not installed or no handlers are provided.
 */
export async function createMswLifecycle(
  handlers: readonly FixtureHandler[],
): Promise<MswLifecycle | null> {
  if (handlers.length === 0) return null;

  try {
    if (isBrowser) {
      return await createBrowserLifecycle(handlers);
    }
    return await createNodeLifecycle(handlers);
  } catch {
    // MSW not installed — degrade gracefully
    if (process.env["NODE_ENV"] !== "production") {
      console.warn(
        "[scenar/preview] msw is not installed. " +
        "Fixture handlers will be ignored. " +
        "Install msw to enable network mocking: npm install msw",
      );
    }
    return null;
  }
}

async function createBrowserLifecycle(
  handlers: readonly FixtureHandler[],
): Promise<MswLifecycle> {
  const { setupWorker } = await import("msw/browser");
  const worker = setupWorker(...handlers);

  return {
    async start() {
      await worker.start({ onUnhandledRequest: "bypass", quiet: true });
    },
    async stop() {
      worker.stop();
    },
  };
}

async function createNodeLifecycle(
  handlers: readonly FixtureHandler[],
): Promise<MswLifecycle> {
  const { setupServer } = await import("msw/node");
  const server = setupServer(...handlers);

  return {
    async start() {
      server.listen({ onUnhandledRequest: "bypass" });
    },
    async stop() {
      server.close();
    },
  };
}
