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

# ─── Clean ────────────────────────────────────

.PHONY: clean

clean: ## Remove all generated artifacts
	$(MAKE) -C apis clean
