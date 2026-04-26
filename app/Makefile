.PHONY: dev build start lint stop

dev:
	PATH="$$HOME/.local/node/bin:$$PATH" npm run dev

stop:
	pkill -f "next dev" || true

build:
	PATH="$$HOME/.local/node/bin:$$PATH" npm run build

start:
	PATH="$$HOME/.local/node/bin:$$PATH" npm start

lint:
	PATH="$$HOME/.local/node/bin:$$PATH" npm run lint

install:
	PATH="$$HOME/.local/node/bin:$$PATH" npm install

import-players:
	export $$(grep -v '^#' .env.local | xargs) && \
	PATH="$$HOME/.local/node/bin:$$PATH" npx tsx scripts/import-players.ts