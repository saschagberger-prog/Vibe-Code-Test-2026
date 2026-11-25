import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const { createChatServer, DEFAULT_MODEL } = await import('../chat/server.js');

type ChatArgs = { model: string; messages: Array<{ role: string; content: string }> };

const TEST_KEY = 'test-key-nicht-im-browser-123';

function stubClient(calls: ChatArgs[]) {
  return {
    chat: {
      complete: async (args: ChatArgs) => {
        calls.push(args);
        return { choices: [{ message: { content: 'Stub-Antwort' } }] };
      },
    },
  };
}

let server: Server;
let base: string;
let calls: ChatArgs[];

beforeAll(async () => {
  calls = [];
  server = createChatServer({ apiKey: TEST_KEY, client: stubClient(calls) });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('chat-server', () => {
  it('GET / liefert die Chat-Oberfläche – ohne API-Key im HTML', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html).toContain('Mistral Chat');
    expect(html).not.toContain(TEST_KEY);
    expect(html).not.toContain('MISTRAL_API_KEY=');
  });

  it('GET /health meldet Modell und hasKey', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, model: DEFAULT_MODEL, hasKey: true });
    expect(DEFAULT_MODEL).toBe('mistral-small-latest');
  });

  it('POST /api/chat ruft das SDK mit mistral-small-latest auf und liefert { reply }', async () => {
    const messages = [
      { role: 'user', content: 'Hallo' },
      { role: 'assistant', content: 'Hi!' },
      { role: 'user', content: 'Wie geht es dir?' },
    ];
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: 'Stub-Antwort' });
    expect(calls).toHaveLength(1);
    expect(calls[0].model).toBe('mistral-small-latest');
    expect(calls[0].messages).toEqual(messages);
  });

  it('POST /api/chat mit ungültigem Body -> 400', async () => {
    for (const body of [{}, { messages: [] }, { messages: [{ role: 'user', content: '' }] }, { messages: [{ role: 'robot', content: 'x' }] }]) {
      const res = await fetch(`${base}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(400);
    }
  });

  it('POST /api/chat ohne API-Key -> 500 mit Hinweis auf MISTRAL_API_KEY', async () => {
    const noKey = createChatServer({ apiKey: '', client: undefined });
    await new Promise<void>((resolve) => noKey.listen(0, '127.0.0.1', resolve));
    const { port } = noKey.address() as AddressInfo;
    try {
      const health = await fetch(`http://127.0.0.1:${port}/health`);
      const healthBody = (await health.json()) as { hasKey: boolean };
      expect(healthBody.hasKey).toBe(false);
      const res = await fetch(`http://127.0.0.1:${port}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Hallo' }] }),
      });
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('MISTRAL_API_KEY');
    } finally {
      await new Promise((resolve) => noKey.close(resolve));
    }
  });

  it('unbekannte Route -> 404', async () => {
    const res = await fetch(`${base}/nope`);
    expect(res.status).toBe(404);
  });
});
