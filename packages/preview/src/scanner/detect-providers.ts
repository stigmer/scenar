import type { Project } from "ts-morph";
import { SyntaxKind, Node } from "ts-morph";

/**
 * Inspect the app entry point and detect React context providers
 * used in the component tree.
 *
 * Returns an array of provider component names (e.g.
 * ["QueryClientProvider", "ThemeProvider"]).
 *
 * Heuristic: looks for JSX elements whose name ends in "Provider"
 * or matches known provider patterns.
 */
export function detectProviders(
  project: Project,
  entryPointPath: string,
): string[] {
  const sourceFile = project.getSourceFile(entryPointPath);
  if (!sourceFile) return [];

  const providers: string[] = [];
  const seen = new Set<string>();

  sourceFile.forEachDescendant((node) => {
    if (
      node.getKind() === SyntaxKind.JsxOpeningElement ||
      node.getKind() === SyntaxKind.JsxSelfClosingElement
    ) {
      let tagName: string | undefined;

      if (Node.isJsxOpeningElement(node)) {
        tagName = node.getTagNameNode().getText();
      } else if (Node.isJsxSelfClosingElement(node)) {
        tagName = node.getTagNameNode().getText();
      }

      if (!tagName) return;

      if (isProviderLike(tagName) && !seen.has(tagName)) {
        seen.add(tagName);
        providers.push(tagName);
      }
    }
  });

  return providers;
}

const KNOWN_PROVIDERS = new Set([
  "QueryClientProvider",
  "ThemeProvider",
  "AuthProvider",
  "SessionProvider",
  "StoreProvider",
  "ReduxProvider",
  "RecoilRoot",
  "ChakraProvider",
  "MantineProvider",
  "NextIntlClientProvider",
  "ClerkProvider",
  "SupabaseProvider",
  "TRPCProvider",
  "ApolloProvider",
  "UrqlProvider",
  "SWRConfig",
  "I18nextProvider",
  "BrowserRouter",
  "MemoryRouter",
  "RouterProvider",
]);

function isProviderLike(name: string): boolean {
  if (KNOWN_PROVIDERS.has(name)) return true;
  if (name.endsWith("Provider")) return true;
  if (name.endsWith("Root")) return true;
  if (name === "SWRConfig") return true;
  return false;
}
