# Mistral Chat (minimale Web-App)

Minimale Chat-Web-App in diesem Projekt: ein kleiner Node-Server (`server.js`) ruft die
Mistral-API über das offizielle TypeScript-SDK [`@mistralai/mistralai`](https://www.npmjs.com/package/@mistralai/mistralai)
auf (Modell: `mistral-small-latest`), die statische Oberfläche (`index.html`) ist reines
HTML/JS und redet nur mit dem lokalen Endpunkt `POST /api/chat`.

**Der API-Key verlässt den Server nicht:** `MISTRAL_API_KEY` wird nur serverseitig aus der
Umgebungsvariable gelesen und an keine Seite/Anfrage im Browser übergeben.

## Installation

```bash
npm install        # installiert u. a. @mistralai/mistralai (siehe package.json)
```

## API-Key setzen (serverseitig, nie committen)

```bash
# Linux / macOS
export MISTRAL_API_KEY="dein-schluessel"

# Windows (cmd)
set MISTRAL_API_KEY=dein-schluessel

# Windows (PowerShell)
$env:MISTRAL_API_KEY="dein-schluessel"
```

Key holen: [console.mistral.ai](https://console.mistral.ai) → API Keys.
`.env` ist in `.gitignore` – Keys gehören in die Umgebung, nicht ins Repo.

## Lokal starten

```bash
npm run chat       # http://127.0.0.1:4174  (nur Loopback, wie der Sync-Server)
```

Danach im Browser `http://127.0.0.1:4174` öffnen und loschatten.

Optionale Umgebungsvariablen:

```bash
PORT=8080 npm run chat                 # anderer Port
HOST=0.0.0.0 npm run chat              # LAN-Zugriff (nur trusted network!)
MISTRAL_MODEL=mistral-medium-latest npm run chat   # anderes Modell (Default: mistral-small-latest)
```

## API des Servers

- `GET /` → Chat-Oberfläche (`index.html`)
- `GET /health` → `{ ok, model, hasKey }`
- `POST /api/chat` mit `{ "messages": [{ "role": "user", "content": "Hallo" }] }` → `{ "reply": "…" }`

## Tests

```bash
npx vitest run tests/chat-server.test.ts   # Server-Tests mit Stub-Client (kein echter API-Call)
```
