import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const { createSyncServer } = await import('../server/sync-server.js');

let server: Server;
let base: string;
let dir: string;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'vibe-todo-sync-'));
  server = createSyncServer({ dataFile: path.join(dir, 'data.json') });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  rmSync(dir, { recursive: true, force: true });
});

const task = (id: string, updatedAt: string, extra: Record<string, unknown> = {}) => ({
  id,
  listId: 'l1',
  title: `Aufgabe ${id}`,
  notes: '',
  dueDate: null,
  reminderAt: null,
  important: false,
  myDay: false,
  steps: [],
  completed: false,
  completedAt: null,
  order: 1,
  createdAt: updatedAt,
  updatedAt,
  deletedAt: null,
  ...extra,
});

describe('sync-server', () => {
  it('GET /health', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('POST und GET /api/state (Push + Pull)', async () => {
    const t1 = task('a', '2026-01-01T00:00:00.000Z');
    const push = await fetch(`${base}/api/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lists: [], tasks: [t1] }),
    });
    expect(push.status).toBe(200);
    const pushed = (await push.json()) as { serverTime: string; accepted: number };
    expect(pushed.accepted).toBe(1);

    const pull = await fetch(`${base}/api/state`);
    const all = (await pull.json()) as { tasks: unknown[] };
    expect(all.tasks).toHaveLength(1);

    const since = await fetch(`${base}/api/state?since=${encodeURIComponent(pushed.serverTime)}`);
    const nothing = (await since.json()) as { tasks: unknown[] };
    expect(nothing.tasks).toHaveLength(0);
  });

  it('LWW-Merge: neuere Remote-Version gewinnt', async () => {
    const newer = task('a', '2026-02-01T00:00:00.000Z', { title: 'aktualisiert' });
    await fetch(`${base}/api/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lists: [], tasks: [newer] }),
    });
    const older = task('a', '2026-01-15T00:00:00.000Z', { title: 'alt' });
    await fetch(`${base}/api/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lists: [], tasks: [older] }),
    });
    const pull = await fetch(`${base}/api/state`);
    const all = (await pull.json()) as { tasks: Array<{ id: string; title: string }> };
    const a = all.tasks.find((t) => t.id === 'a');
    expect(a!.title).toBe('aktualisiert');
  });

  it('Tombstone löscht serverseitig', async () => {
    const tomb = task('a', '2026-03-01T00:00:00.000Z', { deletedAt: '2026-03-01T00:00:00.000Z' });
    await fetch(`${base}/api/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lists: [], tasks: [tomb] }),
    });
    const pull = await fetch(`${base}/api/state`);
    const all = (await pull.json()) as { tasks: Array<{ id: string; deletedAt: string | null }> };
    expect(all.tasks.find((t) => t.id === 'a')!.deletedAt).toBeTruthy();
  });

  it('CORS-Header gesetzt, OPTIONS beantwortet', async () => {
    const res = await fetch(`${base}/health`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('unbekannte Route -> 404', async () => {
    const res = await fetch(`${base}/nope`);
    expect(res.status).toBe(404);
  });
});
