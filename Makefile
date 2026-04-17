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

# ─── Clean ────────────────────────────────────

.PHONY: clean

clean: ## Remove all generated artifacts
	$(MAKE) -C apis clean
	pnpm -r clean
