BUF ?= buf

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_-]+:.*?## / {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ─── Core ─────────────────────────────────────

.PHONY: build protos lint fmt update

build: lint fmt ts-stubs go-stubs python-stubs ## Lint, format, and generate all stubs

protos: build ## Alias for build

lint: ## Run buf lint
	$(BUF) lint

fmt: ## Format proto files
	$(BUF) format -w

update: ## Update buf dependencies
	$(BUF) dep update

# ─── Publishing ───────────────────────────────

.PHONY: push release

push: ## Push protos to Buf Schema Registry
	@echo "Pushing protos to Buf Schema Registry..."
	@$(BUF) push
	@echo "Protos published to buf.build/scenar/apis"

release: lint fmt push ## Lint, format, and push to Buf

# ─── TypeScript stubs ─────────────────────────

TS_STUBS_DIR := stubs/ts

.PHONY: ts-stubs ts-stubs-clean

ts-stubs-clean:
	@rm -rf $(TS_STUBS_DIR)/ai $(TS_STUBS_DIR)/buf

ts-stubs: ts-stubs-clean ## Generate TypeScript stubs
	@mkdir -p $(TS_STUBS_DIR)
	@echo "Generating TypeScript stubs..."
	@$(BUF) generate --template buf.gen.ts.yaml
	@echo "TypeScript stubs generated"

# ─── Go stubs ─────────────────────────────────

GO_STUBS_DIR := stubs/go

.PHONY: go-stubs go-stubs-clean

go-stubs-clean:
	@rm -rf $(GO_STUBS_DIR)

go-stubs: go-stubs-clean ## Generate Go stubs
	@mkdir -p $(GO_STUBS_DIR)
	@echo "Generating Go stubs..."
	@$(BUF) generate --template buf.gen.go.yaml
	@# Fix nested directory structure from go_package_prefix
	@if [ -d "$(GO_STUBS_DIR)/github.com" ]; then \
		mv $(GO_STUBS_DIR)/github.com/scenar-ai/scenar/apis/stubs/go/* $(GO_STUBS_DIR)/ 2>/dev/null || true; \
		rm -rf $(GO_STUBS_DIR)/github.com; \
	fi
	@echo "Go stubs generated"

# ─── Python stubs ─────────────────────────────

PYTHON_STUBS_DIR := stubs/python
PYTHON_STUBS_PKG := $(PYTHON_STUBS_DIR)/scenar

.PHONY: python-stubs python-stubs-clean

python-stubs-clean:
	@rm -rf $(PYTHON_STUBS_PKG)/ai $(PYTHON_STUBS_PKG)/buf

python-stubs: python-stubs-clean ## Generate Python stubs
	@mkdir -p $(PYTHON_STUBS_PKG)
	@touch $(PYTHON_STUBS_DIR)/__init__.py
	@touch $(PYTHON_STUBS_PKG)/__init__.py
	@echo "Generating Python stubs..."
	@$(BUF) generate --template buf.gen.python.yaml
	@echo "Python stubs generated"

# ─── Clean ────────────────────────────────────

.PHONY: clean

clean: ts-stubs-clean go-stubs-clean python-stubs-clean ## Remove all generated stubs
