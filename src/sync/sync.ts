import type { AppState, Task, TaskList } from '../model/types';
import { LAST_SYNC_KEY } from '../model/types';
import { changesSince, mergeCollections } from '../../shared/merge.mjs';

interface Persist {
  putList: (l: TaskList) => Promise<void>;
  putTask: (t: Task) => Promise<void>;
  setMeta: (k: string, v: string) => Promise<void>;
}

export interface SyncResult {
  lists: TaskList[];
  tasks: Task[];
  serverTime: string;
}

export async function runSync(state: AppState, persist: Persist): Promise<SyncResult> {
  const base = state.syncUrl.replace(/\/+$/, '');
  const since = state.lastSyncAt;

  const localLists = changesSince(state.lists, since) as TaskList[];
  const localTasks = changesSince(state.tasks, since) as Task[];

  const headers = { 'Content-Type': 'application/json' };

  if (localLists.length || localTasks.length) {
    const res = await fetch(`${base}/api/state`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ lists: localLists, tasks: localTasks }),
    });
    if (!res.ok) throw new Error(`Sync (Push) fehlgeschlagen: HTTP ${res.status}`);
  }

  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  const res = await fetch(`${base}/api/state${query}`);
  if (!res.ok) throw new Error(`Sync (Pull) fehlgeschlagen: HTTP ${res.status}`);
  const payload = (await res.json()) as {
    serverTime: string;
    lists: TaskList[];
    tasks: Task[];
  };

  const mergedLists = mergeCollections(state.lists, payload.lists);
  const mergedTasks = mergeCollections(state.tasks, payload.tasks);

  for (const l of mergedLists.remoteChanges) await persist.putList(l as TaskList);
  for (const t of mergedTasks.remoteChanges) await persist.putTask(t as Task);
  await persist.setMeta(LAST_SYNC_KEY, payload.serverTime);

  return {
    lists: mergedLists.merged as TaskList[],
    tasks: mergedTasks.merged as Task[],
    serverTime: payload.serverTime,
  };
}
