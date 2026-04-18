#!/usr/bin/env node

/**
 * Builds and publishes all Scenar packages to npm.
 *
 * Reads each package's fields to produce a dist/package.json with the
 * correct entry points for npm consumers, then publishes from the dist/
 * directory. The workspace package.json is never modified.
 *
 * Publish order respects the dependency graph:
 *   @scenar/core + @scenar/preview → @scenar/sdk + @scenar/react → @scenar/cli
 *
 * Usage:
 *   node scripts/publish-libs.mjs --version 0.1.0              # build + publish
 *   node scripts/publish-libs.mjs --version 0.1.0 --dry-run    # dry-run
 *   node scripts/publish-libs.mjs --version 0.1.0 --skip-build # publish pre-built dist/
 *   NPM_TOKEN=npm_xxx node scripts/publish-libs.mjs --version 0.1.0  # CI with token
 *
 * --version is required. Pre-release versions (e.g. 0.1.0-rc.1) publish
 * under the "next" tag; stable versions publish under "latest".
 */

import { execSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  cpSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const PACKAGES = [
  "packages/core",
  "packages/preview",
  "packages/sdk",
  "packages/react",
  "packages/cli",
];

function run(cmd, cwd = root) {
  console.log(`  $ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const version = args.includes("--version")
    ? args[args.indexOf("--version") + 1]
    : undefined;

  if (!version) {
    console.error("error: --version is required (e.g. --version 0.1.0)");
    process.exit(1);
  }

  return {
    version,
    dryRun: args.includes("--dry-run"),
    skipBuild: args.includes("--skip-build"),
  };
}

function isPrerelease(version) {
  return version.includes("-");
}

function generateDistPackageJson(pkgDir, version) {
  const srcPkg = JSON.parse(
    readFileSync(resolve(pkgDir, "package.json"), "utf8"),
  );

  const distPkg = {
    name: srcPkg.name,
    version,
    description: srcPkg.description,
    license: srcPkg.license,
    type: srcPkg.type,
    sideEffects: srcPkg.sideEffects,
    repository: srcPkg.repository,
    keywords: srcPkg.keywords,
  };

  if (srcPkg.engines) distPkg.engines = srcPkg.engines;
  if (srcPkg.bin) distPkg.bin = rewritePaths(srcPkg.bin);

  if (srcPkg.main) distPkg.main = rewritePath(srcPkg.main);
  if (srcPkg.types) distPkg.types = rewritePath(srcPkg.types);

  if (srcPkg.exports) {
    distPkg.exports = rewriteExports(srcPkg.exports);
  }

  if (srcPkg.dependencies) {
    distPkg.dependencies = pinWorkspaceDeps(srcPkg.dependencies, version);
  }
  if (srcPkg.peerDependencies) {
    distPkg.peerDependencies = srcPkg.peerDependencies;
  }
  if (srcPkg.peerDependenciesMeta) {
    distPkg.peerDependenciesMeta = srcPkg.peerDependenciesMeta;
  }

  const distPath = resolve(pkgDir, "dist", "package.json");
  writeFileSync(distPath, JSON.stringify(distPkg, null, 2) + "\n");
  return distPath;
}

/**
 * Rewrite ./dist/... paths to ./ since we publish from dist/.
 */
function rewritePath(p) {
  if (typeof p !== "string") return p;
  return p.replace(/^\.\/dist\//, "./");
}

function rewritePaths(obj) {
  if (typeof obj === "string") return rewritePath(obj);
  if (typeof obj === "object" && obj !== null) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = rewritePaths(value);
    }
    return result;
  }
  return obj;
}

function rewriteExports(exports) {
  if (typeof exports === "string") {
    return rewritePath(exports);
  }
  if (typeof exports === "object" && exports !== null) {
    const result = {};
    for (const [key, value] of Object.entries(exports)) {
      result[key] = rewriteExports(value);
    }
    return result;
  }
  return exports;
}

/**
 * Replace workspace:* protocol with the lockstep version for @scenar/* deps.
 */
function pinWorkspaceDeps(deps, version) {
  const pinned = { ...deps };
  for (const [name, range] of Object.entries(pinned)) {
    if (name.startsWith("@scenar/") && range === "workspace:*") {
      pinned[name] = version;
    }
  }
  return pinned;
}

/**
 * Copy src/ into dist/src/ so declaration maps resolve to readable TypeScript.
 */
function copySrcForDeclarationMaps(pkgDir) {
  const srcDir = resolve(pkgDir, "src");
  const destDir = resolve(pkgDir, "dist", "src");
  if (!existsSync(srcDir)) return;
  cpSync(srcDir, destDir, { recursive: true });
}

/**
 * If NPM_TOKEN is set, write a project-level .npmrc for registry auth.
 * Returns true if a file was written (caller must clean up).
 */
function setupNpmrc() {
  const token = process.env.NPM_TOKEN;
  if (!token) return false;

  const npmrcPath = resolve(root, ".npmrc");
  if (existsSync(npmrcPath)) {
    console.error(
      "  ERROR: .npmrc already exists at repo root. Remove it or unset NPM_TOKEN.",
    );
    process.exit(1);
  }

  writeFileSync(
    npmrcPath,
    `//registry.npmjs.org/:_authToken=\${NPM_TOKEN}\n`,
  );
  console.log("  Created temporary .npmrc (will be removed after publish)\n");
  return true;
}

function teardownNpmrc(created) {
  if (!created) return;
  const npmrcPath = resolve(root, ".npmrc");
  try {
    unlinkSync(npmrcPath);
    console.log("\n  Removed temporary .npmrc");
  } catch {
    console.warn(
      `  WARNING: failed to remove ${npmrcPath} — delete it manually`,
    );
  }
}

async function main() {
  const { version, dryRun, skipBuild } = parseArgs();
  const tag = isPrerelease(version) ? "next" : "latest";

  console.log(`\n  version: ${version}`);
  console.log(`  tag:     ${tag}`);
  console.log(`  dry-run: ${dryRun}\n`);

  if (!skipBuild) {
    console.log("=== Building all packages ===\n");
    run("pnpm -r clean");
    run("pnpm -r build");
  } else {
    console.log("=== Skipping build (--skip-build) ===\n");
  }

  const npmrcCreated = setupNpmrc();

  try {
    console.log("=== Publishing packages ===\n");

    for (const relPath of PACKAGES) {
      const pkgDir = resolve(root, relPath);
      const srcPkg = JSON.parse(
        readFileSync(resolve(pkgDir, "package.json"), "utf8"),
      );
      const distDir = resolve(pkgDir, "dist");

      console.log(`--- ${srcPkg.name}@${version} ---`);

      if (!existsSync(distDir)) {
        console.error(
          `  ERROR: dist/ does not exist in ${relPath}. Run without --skip-build first.`,
        );
        process.exit(1);
      }

      const distPkgPath = generateDistPackageJson(pkgDir, version);
      console.log(`  Generated ${distPkgPath}`);

      copySrcForDeclarationMaps(pkgDir);

      const readmeSrc = resolve(pkgDir, "README.md");
      if (existsSync(readmeSrc)) {
        cpSync(readmeSrc, resolve(distDir, "README.md"));
      }

      const licenseSrc = resolve(root, "LICENSE");
      if (existsSync(licenseSrc)) {
        cpSync(licenseSrc, resolve(distDir, "LICENSE"));
      }

      let publishCmd = `npm publish ${distDir} --access public --tag ${tag}`;
      if (dryRun) publishCmd += " --dry-run";

      run(publishCmd);
      console.log("");
    }

    console.log("=== Done ===\n");
  } finally {
    teardownNpmrc(npmrcCreated);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
