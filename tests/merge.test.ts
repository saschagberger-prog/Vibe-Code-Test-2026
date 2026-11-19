import { describe, expect, it } from 'vitest';
import { changesSince, effectiveStamp, mergeCollections, mergeIncoming, mergePair, newId } from '../shared/merge.mjs';

const ent = (id: string, updatedAt: string, deletedAt: string | null = null) => ({
  id,
  updatedAt,
  deletedAt,
});

describe('mergePair', () => {
  it('ältere Version verliert gegen neuere', () => {
    const a = ent('1', '2026-01-01T00:00:00Z');
    const b = ent('1', '2026-01-02T00:00:00Z');
    expect(mergePair(a, b).updatedAt).toBe(b.updatedAt);
    expect(mergePair(b, a).updatedAt).toBe(b.updatedAt);
  });

  it('Tombstone gewinnt nur bei neuerem Zeitstempel', () => {
    const alive = ent('1', '2026-01-03T00:00:00Z');
    const tomb = { ...ent('1', '2026-01-02T00:00:00Z'), deletedAt: '2026-01-02T00:00:00Z' };
    expect(mergePair(alive, tomb).deletedAt).toBeNull();
    const tombNewer = { ...ent('1', '2026-01-04T00:00:00Z'), deletedAt: '2026-01-04T00:00:00Z' };
    expect(mergePair(alive, tombNewer).deletedAt).toBe('2026-01-04T00:00:00Z');
  });

  it('Gleichstand ist deterministisch über die id', () => {
    const a = ent('a', '2026-01-01T00:00:00Z');
    const b = ent('b', '2026-01-01T00:00:00Z');
    expect(mergePair(a, b)).toBe(b);
    expect(mergePair(b, a)).toBe(b);
  });

  it('fehlende Seite wird durchgereicht', () => {
    const a = ent('1', '2026-01-01T00:00:00Z');
    expect(mergePair(a, null)).toBe(a);
    expect(mergePair(null, a)).toBe(a);
  });
});

describe('mergeCollections', () => {
  it('vereint lokal-only, remote-only und Konflikte korrekt', () => {
    const local = [ent('a', '2026-01-02T00:00:00Z'), ent('b', '2026-01-01T00:00:00Z')];
    const remote = [ent('b', '2026-01-03T00:00:00Z'), ent('c', '2026-01-01T00:00:00Z')];
    const { merged, localChanges, remoteChanges } = mergeCollections(local, remote);
    expect(merged.map((e) => e.id).sort()).toEqual(['a', 'b', 'c']);
    expect(merged.find((e) => e.id === 'b')!.updatedAt).toBe('2026-01-03T00:00:00Z');
    expect(localChanges.map((e) => e.id)).toEqual(['a']);
    expect(remoteChanges.map((e) => e.id).sort()).toEqual(['b', 'c']);
  });
});

describe('changesSince', () => {
  it('filtert nach effektivem Zeitstempel inkl. Tombstones', () => {
    const list = [
      ent('a', '2026-01-01T00:00:00Z'),
      { ...ent('b', '2026-01-01T00:00:00Z'), deletedAt: '2026-01-05T00:00:00Z' },
      ent('c', '2026-01-06T00:00:00Z'),
    ];
    expect(changesSince(list, '2026-01-04T00:00:00Z').map((e) => e.id).sort()).toEqual(['b', 'c']);
    expect(changesSince(list, null)).toHaveLength(3);
  });
});

describe('mergeIncoming (Server)', () => {
  it('merged eingehende Änderungen LWW in den Server-Bestand', () => {
    const server = [ent('x', '2026-01-01T00:00:00Z')];
    const incoming = [ent('x', '2026-01-02T00:00:00Z'), ent('y', '2026-01-02T00:00:00Z')];
    const { stored, accepted } = mergeIncoming(server, incoming);
    expect(accepted).toBe(2);
    expect(stored.find((e) => e.id === 'x')!.updatedAt).toBe('2026-01-02T00:00:00Z');
    expect(stored.find((e) => e.id === 'y')).toBeTruthy();
  });
});

describe('effectiveStamp / newId', () => {
  it('Tombstone-Zeitstempel zählt', () => {
    expect(effectiveStamp({ updatedAt: 'u', deletedAt: 'd' })).toBe('d');
    expect(effectiveStamp({ updatedAt: 'u', deletedAt: null })).toBe('u');
  });
  it('newId ist eindeutig', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newId()));
    expect(ids.size).toBe(500);
  });
});
