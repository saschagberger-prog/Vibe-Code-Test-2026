#!/usr/bin/env node
/**
 * Minimaler Sync-Server für Vibe To Do (keine externen Abhängigkeiten).
 *
 * Endpunkte:
 *   GET  /health                 -> { ok: true }
 *   GET  /api/state?since=<ISO>  -> { serverTime, lists, tasks } (Änderungen seit `since`)
 *   POST /api/state              -> Body { lists: [], tasks: [] } (LWW-Merge, antwortet { serverTime, accepted })
 *
 * Ablage: JSON-Datei (server/data.json). Default: nur Loopback (127.0.0.1).
 * Für LAN-Nutzung auf dem eigenen Rechner: HOST=0.0.0.0 PORT=4173 npm run sync-server
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { changesSince, mergeIncoming, effectiveStamp } from '../shared/merge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadStore(dataFile) {
  try {
    const raw = fs.readFileSync(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      lists: Array.isArray(parsed.lists) ? parsed.lists : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    };
  } catch {
    return { lists: [], tasks: [] };
  }
}

export function createSyncServer({ dataFile } = {}) {
  const file = dataFile || path.join(__dirname, 'data.json');
  const store = loadStore(file);
  let saveTimer = null;

  function save() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(store, null, 2));
    }, 200);
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => {
        data += chunk;
        if (data.length > 50 * 1024 * 1024) {
          reject(new Error('Body zu groß'));
          req.destroy();
        }
      });
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (err) {
          reject(err);
        }
      });
      req.on('error', reject);
    });
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/state') {
      const since = url.searchParams.get('since');
      const serverTime = new Date().toISOString();
      const payload = {
        serverTime,
        lists: changesSince(store.lists, since),
        tasks: changesSince(store.tasks, since),
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/state') {
      try {
        const body = await readBody(req);
        const serverTime = new Date().toISOString();
        const inLists = Array.isArray(body.lists) ? body.lists : [];
        const inTasks = Array.isArray(body.tasks) ? body.tasks : [];
        const mergedLists = mergeIncoming(store.lists, inLists);
        const mergedTasks = mergeIncoming(store.tasks, inTasks);
        store.lists = mergedLists.stored;
        store.tasks = mergedTasks.stored;
        save();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ serverTime, accepted: mergedLists.accepted + mergedTasks.accepted }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(err && err.message ? err.message : err) }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  server.store = store;
  server.dataFile = file;
  return server;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 4173);
  const server = createSyncServer();
  server.listen(port, host, () => {
    console.log(`Vibe To Do Sync-Server läuft auf http://${host}:${port}`);
    console.log(`Daten-Datei: ${server.dataFile}`);
    console.log('Nur lokal erreichbar – für LAN: HOST=0.0.0.0 npm run sync-server');
  });
}
