#!/usr/bin/env node
/**
 * Minimaler Chat-Server für die Mistral-API (offizielles TypeScript-SDK @mistralai/mistralai).
 *
 * Der API-Key bleibt auf dem Server: MISTRAL_API_KEY wird nur hier aus der Umgebung gelesen
 * und niemals an den Browser ausgeliefert.
 *
 * Endpunkte:
 *   GET  /            -> chat/index.html (statische Chat-Oberfläche)
 *   GET  /health      -> { ok: true, model, hasKey }
 *   POST /api/chat    -> Body { messages: [{ role, content }, ...] } -> { reply }
 *
 * Start: MISTRAL_API_KEY=... npm run chat   (Default: nur Loopback 127.0.0.1:4174)
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Mistral } from '@mistralai/mistralai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_MODEL = 'mistral-small-latest';
const ALLOWED_ROLES = new Set(['system', 'user', 'assistant']);
const MAX_MESSAGES = 100;
const MAX_BODY_BYTES = 256 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > MAX_BODY_BYTES) {
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

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function isValidMessages(messages) {
  return (
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.length <= MAX_MESSAGES &&
    messages.every(
      (m) =>
        m &&
        typeof m === 'object' &&
        ALLOWED_ROLES.has(m.role) &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0
    )
  );
}

function contentToText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((chunk) => chunk && chunk.type === 'text')
      .map((chunk) => chunk.text)
      .join('');
  }
  return '';
}

export function createChatServer({ apiKey, client, model, publicDir } = {}) {
  const resolvedModel = model || process.env.MISTRAL_MODEL || DEFAULT_MODEL;
  const key = apiKey !== undefined ? apiKey : process.env.MISTRAL_API_KEY;
  const mistral = client || (key ? new Mistral({ apiKey: key }) : null);
  const staticDir = publicDir || __dirname;

  async function handleChat(messages) {
    if (!mistral) {
      const err = new Error('MISTRAL_API_KEY ist nicht gesetzt (nur serverseitig als Umgebungsvariable)');
      err.status = 500;
      throw err;
    }
    const response = await mistral.chat.complete({ model: resolvedModel, messages });
    const reply = contentToText(response?.choices?.[0]?.message?.content);
    if (!reply) {
      const err = new Error('Leere Antwort von der Mistral-API');
      err.status = 502;
      throw err;
    }
    return reply;
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

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      try {
        const html = fs.readFileSync(path.join(staticDir, 'index.html'));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } catch {
        sendJson(res, 500, { error: 'index.html nicht gefunden' });
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true, model: resolvedModel, hasKey: Boolean(key) });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/chat') {
      try {
        const body = await readBody(req);
        if (!isValidMessages(body.messages)) {
          sendJson(res, 400, {
            error: 'Ungültige Anfrage: messages muss ein nicht-leeres Array aus { role: system|user|assistant, content: string } sein',
          });
          return;
        }
        const reply = await handleChat(body.messages);
        sendJson(res, 200, { reply });
      } catch (err) {
        sendJson(res, err.status || 502, {
          error: String(err && err.message ? err.message : err),
        });
      }
      return;
    }

    sendJson(res, 404, { error: 'not found' });
  });

  server.model = resolvedModel;
  server.handleChat = handleChat;
  return server;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  if (!process.env.MISTRAL_API_KEY) {
    console.warn('Hinweis: MISTRAL_API_KEY ist nicht gesetzt – /api/chat antwortet mit 500, bis der Key als Umgebungsvariable gesetzt ist.');
  }
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 4174);
  const server = createChatServer();
  server.listen(port, host, () => {
    console.log(`Mistral-Chat läuft auf http://${host}:${port} (Modell: ${server.model})`);
    console.log('Nur lokal erreichbar – der API-Key bleibt auf dem Server (MISTRAL_API_KEY).');
  });
}
