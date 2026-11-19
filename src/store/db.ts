import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Task, TaskList } from '../model/types';

interface TodoDB extends DBSchema {
  lists: { key: string; value: TaskList };
  tasks: { key: string; value: Task };
  meta: { key: string; value: string };
}

let dbPromise: Promise<IDBPDatabase<TodoDB>> | null = null;

function getDb(): Promise<IDBPDatabase<TodoDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TodoDB>('vibe-todo', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('lists')) db.createObjectStore('lists', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('tasks')) db.createObjectStore('tasks', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      },
    });
  }
  return dbPromise;
}

export async function loadAll(): Promise<{ lists: TaskList[]; tasks: Task[]; meta: Record<string, string> }> {
  const db = await getDb();
  const [lists, tasks, metaKeys] = await Promise.all([
    db.getAll('lists'),
    db.getAll('tasks'),
    db.getAllKeys('meta'),
  ]);
  const meta: Record<string, string> = {};
  for (const k of metaKeys) {
    const v = await db.get('meta', k as string);
    if (typeof v === 'string') meta[k as string] = v;
  }
  return { lists, tasks, meta };
}

export async function putList(list: TaskList): Promise<void> {
  const db = await getDb();
  await db.put('lists', list);
}

export async function putTask(task: Task): Promise<void> {
  const db = await getDb();
  await db.put('tasks', task);
}

export async function deleteListRecord(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('lists', id);
}

export async function deleteTaskRecord(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('tasks', id);
}

export async function getMeta(key: string): Promise<string | undefined> {
  const db = await getDb();
  const v = await db.get('meta', key);
  return typeof v === 'string' ? v : undefined;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.put('meta', value, key);
}
