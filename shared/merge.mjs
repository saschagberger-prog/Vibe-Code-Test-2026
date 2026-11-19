/**
 * Gemeinsame Sync-Merge-Logik (Last-Write-Wins pro Entität).
 * Wird vom Client (TypeScript via Vite) und vom Sync-Server (plain Node) importiert.
 *
 * Eine Entität ist ein Objekt mit { id, updatedAt, deletedAt }.
 * - "Lebendig" = deletedAt == null
 * - Bei Konflikt gewinnt die Entität mit dem neueren updatedAt;
 *   ein Tombstone (deletedAt gesetzt) gewinnt nur, wenn sein updatedAt ebenfalls neuer ist.
 * - Gleichstand wird deterministisch über die id aufgelöst.
 */

/** @param {any} e */
export function effectiveStamp(e) {
  return e.deletedAt || e.updatedAt || '';
}

/**
 * Zwei Versionen derselben Entität zusammenführen.
 * @param {any} a
 * @param {any} b
 * @returns {any} die gewinnende Version (nie null, solange mindestens eine existiert)
 */
export function mergePair(a, b) {
  if (!a) return b;
  if (!b) return a;
  const sa = effectiveStamp(a);
  const sb = effectiveStamp(b);
  if (sa !== sb) return sa > sb ? a : b;
  return String(a.id) >= String(b.id) ? a : b;
}

/**
 * Lokale und Remote-Sammlungen zu einer gemergten Sicht vereinen.
 * @param {any[]} local
 * @param {any[]} remote
 * @returns {{ merged: any[], localChanges: any[], remoteChanges: any[] }}
 *   localChanges: lokal neuere Versionen (zum Push), remoteChanges: remote neuere Versionen (zum Anwenden)
 */
export function mergeCollections(local, remote) {
  const localMap = new Map(local.map((e) => [e.id, e]));
  const remoteMap = new Map(remote.map((e) => [e.id, e]));
  const merged = [];
  const localChanges = [];
  const remoteChanges = [];
  const ids = new Set([...localMap.keys(), ...remoteMap.keys()]);
  for (const id of ids) {
    const l = localMap.get(id) || null;
    const r = remoteMap.get(id) || null;
    const m = mergePair(l, r);
    merged.push(m);
    if (l && !r) localChanges.push(l);
    else if (l && r) {
      if (effectiveStamp(l) > effectiveStamp(r)) localChanges.push(l);
      else if (effectiveStamp(r) > effectiveStamp(l)) remoteChanges.push(r);
    } else if (r && !l) remoteChanges.push(r);
  }
  return { merged, localChanges, remoteChanges };
}

/**
 * Alle Entitäten, die seit einem Zeitstempel verändert wurden (inkl. Tombstones).
 * @param {any[]} entities
 * @param {string|null} since ISO-String oder null
 * @returns {any[]}
 */
export function changesSince(entities, since) {
  if (!since) return entities.slice();
  return entities.filter((e) => effectiveStamp(e) > since);
}

/**
 * Serverseitig: eingehende Änderungen in den Server-Bestand mergen.
 * @param {any[]} serverEntities
 * @param {any[]} incoming
 * @returns {{ stored: any[], accepted: number }}
 */
export function mergeIncoming(serverEntities, incoming) {
  const { merged } = mergeCollections(serverEntities, incoming);
  const accepted = incoming.length;
  return { stored: merged, accepted };
}

/** Eindeutige id erzeugen (zeitbasiert + Zufall). @returns {string} */
export function newId() {
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6)
  );
}
