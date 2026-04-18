bump ?= patch

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_-]+:.*?## / {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ─── Build ────────────────────────────────────

.PHONY: protos lint

protos: ## Generate protocol buffer stubs (TypeScript, Go, Python)
	$(MAKE) -C apis build

lint: ## Run buf lint on proto definitions
	$(MAKE) -C apis lint

# ─── TypeScript ────────────────────────────────

.PHONY: ts ts-build ts-test ts-lint ts-typecheck

ts: ts-build ts-test ts-lint ## Build, test, and lint all TypeScript packages

ts-build: ## Build all TypeScript packages
	pnpm -r build

ts-test: ## Run all TypeScript tests
	pnpm -r test

ts-lint: ## Lint all TypeScript packages
	pnpm -r lint

ts-typecheck: ## Type-check all TypeScript packages
	pnpm -r typecheck

# ─── Format ───────────────────────────────────

.PHONY: fmt

fmt: ## Format proto files and TypeScript source
	$(MAKE) -C apis fmt
	pnpm prettier --write "packages/*/src/**/*.{ts,tsx}"

# ─── Check (local CI gate) ───────────────────

.PHONY: check
check: ts-build ts-test ts-typecheck ts-lint ## Run full CI gate locally

# ─── Release ──────────────────────────────────

.PHONY: release
release: ## Tag and push a release (usage: make release [bump=patch|minor|major])
	@LATEST_TAG=$$(git tag -l "v*" | sort -V | tail -n1); \
	[ -z "$$LATEST_TAG" ] && LATEST_TAG="v0.0.0"; \
	VERSION=$$(echo $$LATEST_TAG | sed 's/^v//'); \
	MAJOR=$$(echo $$VERSION | cut -d. -f1); \
	MINOR=$$(echo $$VERSION | cut -d. -f2); \
	PATCH=$$(echo $$VERSION | cut -d. -f3); \
	case $(bump) in \
		major) MAJOR=$$((MAJOR + 1)); MINOR=0; PATCH=0 ;; \
		minor) MINOR=$$((MINOR + 1)); PATCH=0 ;; \
		patch) PATCH=$$((PATCH + 1)) ;; \
		*) echo "error: invalid bump '$(bump)' (use patch|minor|major)" && exit 1 ;; \
	esac; \
	NEW_TAG="v$$MAJOR.$$MINOR.$$PATCH"; \
	if git rev-parse "$$NEW_TAG" >/dev/null 2>&1; then \
		echo "error: tag $$NEW_TAG already exists" && exit 1; \
	fi; \
	echo "$$LATEST_TAG -> $$NEW_TAG"; \
	git tag -a "$$NEW_TAG" -m "Release $$NEW_TAG"; \
	echo "  pushing $$NEW_TAG"; \
	git push origin "$$NEW_TAG"
	@echo ""
	@echo "Tag pushed. CI will handle:"
	@echo "  - @scenar/* npm packages  (release.npm.yaml)"

# ─── Clean ────────────────────────────────────

.PHONY: clean

clean: ## Remove all generated artifacts
	$(MAKE) -C apis clean
	pnpm -r clean
