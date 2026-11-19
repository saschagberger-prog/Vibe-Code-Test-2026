import { useSyncExternalStore } from 'react';
import type { AppState, Task, TaskList, View } from '../model/types';
import { DEFAULT_LIST_COLOR, DEFAULT_LIST_ICON, DEFAULT_LIST_ID, LAST_SYNC_KEY } from '../model/types';
import * as db from './db';
import { newId } from '../../shared/merge.mjs';
import { runSync } from '../sync/sync';

const THEME_KEY = 'vibe-todo-theme';
const SYNC_URL_KEY = 'vibe-todo-sync-url';
const SEEDED_KEY = 'seeded';

let state: AppState = {
  lists: [],
  tasks: [],
  view: { type: 'smart', id: 'myday' },
  query: '',
  detailTaskId: null,
  theme: 'light',
  syncUrl: '',
  lastSyncAt: null,
  syncStatus: 'idle',
  syncError: null,
  ready: false,
};

const listeners = new Set<() => void>();
let syncTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  for (const l of listeners) l();
}

function set(partial: Partial<AppState>) {
  state = { ...state, ...partial };
  emit();
}

function nowIso(): string {
  return new Date().toISOString();
}

function touch<T extends { updatedAt: string }>(e: T): T {
  return { ...e, updatedAt: nowIso() };
}

async function persistList(list: TaskList) {
  await db.putList(list);
}

async function persistTask(task: Task) {
  await db.putTask(task);
}

function scheduleSync() {
  if (!state.syncUrl) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void syncNow();
  }, 1500);
}

function applyTheme(theme: AppState['theme']) {
  const root = document.documentElement;
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', dark);
  root.dataset.theme = theme;
}

export const store = {
  getState: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  async init() {
    const { lists, tasks, meta } = await db.loadAll();
    const theme = (meta[THEME_KEY] as AppState['theme']) || 'light';
    const syncUrl = meta[SYNC_URL_KEY] || '';
    const lastSyncAt = meta[LAST_SYNC_KEY] || null;
    set({
      lists,
      tasks,
      theme,
      syncUrl,
      lastSyncAt,
      ready: true,
    });
    applyTheme(theme);
    if (!meta[SEEDED_KEY] || lists.length === 0) {
      await this.seed();
      await db.setMeta(SEEDED_KEY, '1');
    }
    if (syncUrl) {
      void syncNow();
      setInterval(() => void syncNow(), 60_000);
    }
    this.startReminderLoop();
  },

  async seed() {
    const t = nowIso();
    const list: TaskList = {
      id: DEFAULT_LIST_ID,
      name: 'Aufgaben',
      color: DEFAULT_LIST_COLOR,
      icon: DEFAULT_LIST_ICON,
      order: 0,
      createdAt: t,
      updatedAt: t,
      deletedAt: null,
    };
    const mk = (title: string, extra: Partial<Task>): Task => ({
      id: newId(),
      listId: DEFAULT_LIST_ID,
      title,
      notes: '',
      dueDate: null,
      reminderAt: null,
      important: false,
      myDay: false,
      steps: [],
      completed: false,
      completedAt: null,
      order: Date.now() + Math.random(),
      createdAt: t,
      updatedAt: t,
      deletedAt: null,
      ...extra,
    });
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const tasks: Task[] = [
      mk('Willkommen bei Vibe To Do 👋', {
        myDay: true,
        important: true,
        notes: 'Das ist ein Beispiel. Klicke auf eine Aufgabe für Details, Fälligkeit, Erinnerungen und Schritte.',
        steps: [
          { id: newId(), title: 'Erste Aufgabe erledigen', done: true },
          { id: newId(), title: 'Weitere Liste anlegen', done: false },
        ],
      }),
      mk('Einkaufen', { myDay: true, dueDate: today }),
      mk('Bericht vorbereiten', { dueDate: tomorrow, reminderAt: new Date(Date.now() + 3_600_000).toISOString() }),
    ];
    await persistList(list);
    for (const task of tasks) await persistTask(task);
    set({ lists: [list], tasks });
  },

  setView(view: View) {
    set({ view, detailTaskId: null });
  },
  setQuery(query: string) {
    set({ query });
  },
  openTask(id: string) {
    set({ detailTaskId: id });
  },
  closeTask() {
    set({ detailTaskId: null });
  },

  async setTheme(theme: AppState['theme']) {
    applyTheme(theme);
    set({ theme });
    await db.setMeta(THEME_KEY, theme);
  },

  async setSyncUrl(url: string) {
    const trimmed = url.trim().replace(/\/+$/, '');
    set({ syncUrl: trimmed });
    await db.setMeta(SYNC_URL_KEY, trimmed);
    if (trimmed) void syncNow();
  },

  async addList(name: string, color: string, icon: string) {
    const t = nowIso();
    const list: TaskList = {
      id: newId(),
      name: name.trim() || 'Neue Liste',
      color,
      icon,
      order: state.lists.length,
      createdAt: t,
      updatedAt: t,
      deletedAt: null,
    };
    await persistList(list);
    set({ lists: [...state.lists, list], view: { type: 'list', id: list.id }, detailTaskId: null });
    scheduleSync();
  },

  async updateList(id: string, patch: Partial<Pick<TaskList, 'name' | 'color' | 'icon'>>) {
    const list = state.lists.find((l) => l.id === id);
    if (!list) return;
    const next = touch({ ...list, ...patch });
    await persistList(next);
    set({ lists: state.lists.map((l) => (l.id === id ? next : l)) });
    scheduleSync();
  },

  async deleteList(id: string) {
    if (id === DEFAULT_LIST_ID) return;
    const t = nowIso();
    const list = state.lists.find((l) => l.id === id);
    if (!list) return;
    await persistList({ ...list, deletedAt: t, updatedAt: t });
    const moved = state.tasks
      .filter((task) => task.listId === id && !task.deletedAt)
      .map((task) => touch({ ...task, listId: DEFAULT_LIST_ID }));
    for (const task of moved) await persistTask(task);
    set({
      lists: state.lists.filter((l) => l.id !== id),
      tasks: state.tasks.map((task) => {
        const m = moved.find((x) => x.id === task.id);
        return m || task;
      }),
      view: { type: 'smart', id: 'all' },
      detailTaskId: null,
    });
    scheduleSync();
  },

  async addTask(listId: string, title: string, myDay = false) {
    const t = nowIso();
    const task: Task = {
      id: newId(),
      listId,
      title: title.trim(),
      notes: '',
      dueDate: null,
      reminderAt: null,
      important: false,
      myDay,
      steps: [],
      completed: false,
      completedAt: null,
      order: Date.now() + Math.random(),
      createdAt: t,
      updatedAt: t,
      deletedAt: null,
    };
    if (!task.title) return;
    await persistTask(task);
    set({ tasks: [...state.tasks, task] });
    scheduleSync();
  },

  async updateTask(id: string, patch: Partial<Task>) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    let next = touch({ ...task, ...patch });
    if (patch.completed !== undefined) {
      next = { ...next, completedAt: patch.completed ? nowIso() : null };
    }
    await persistTask(next);
    set({ tasks: state.tasks.map((t) => (t.id === id ? next : t)) });
    if (state.detailTaskId === id) set({ detailTaskId: next.deletedAt ? null : id });
    scheduleSync();
  },

  async toggleTask(id: string) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    await this.updateTask(id, { completed: !task.completed });
  },

  async deleteTask(id: string) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    const next = { ...task, deletedAt: nowIso(), updatedAt: nowIso() };
    await persistTask(next);
    set({
      tasks: state.tasks.filter((t) => t.id !== id),
      detailTaskId: state.detailTaskId === id ? null : state.detailTaskId,
    });
    scheduleSync();
  },

  async addStep(taskId: string, title: string) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task || !title.trim()) return;
    await this.updateTask(taskId, { steps: [...task.steps, { id: newId(), title: title.trim(), done: false }] });
  },

  async toggleStep(taskId: string, stepId: string) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    await this.updateTask(taskId, {
      steps: task.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s)),
    });
  },

  async updateStep(taskId: string, stepId: string, title: string) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    await this.updateTask(taskId, {
      steps: task.steps.map((s) => (s.id === stepId ? { ...s, title } : s)),
    });
  },

  async removeStep(taskId: string, stepId: string) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    await this.updateTask(taskId, { steps: task.steps.filter((s) => s.id !== stepId) });
  },

  startReminderLoop() {
    const notified = new Set<string>();
    const check = () => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const now = Date.now();
      for (const t of state.tasks) {
        if (!t.reminderAt || t.completed || t.deletedAt) continue;
        const at = new Date(t.reminderAt).getTime();
        if (at <= now && now - at < 10 * 60_000 && !notified.has(t.id)) {
          notified.add(t.id);
          new Notification('Erinnerung: ' + t.title, { body: t.notes || undefined });
        }
      }
    };
    check();
    setInterval(check, 60_000);
  },
};

export async function syncNow(): Promise<void> {
  if (!state.syncUrl || state.syncStatus === 'syncing') return;
  set({ syncStatus: 'syncing', syncError: null });
  try {
    const result = await runSync(state, {
      putList: persistList,
      putTask: persistTask,
      setMeta: (k, v) => db.setMeta(k, v),
    });
    set({
      lists: result.lists,
      tasks: result.tasks,
      lastSyncAt: result.serverTime,
      syncStatus: 'ok',
      syncError: null,
    });
  } catch (err) {
    set({ syncStatus: 'error', syncError: err instanceof Error ? err.message : String(err) });
  }
}

export function useStore(): AppState {
  return useSyncExternalStore(store.subscribe, store.getState);
}

export function selectVisibleTasks(s: AppState): Task[] {
  const q = s.query.trim().toLowerCase();
  const view = s.view;
  let tasks = s.tasks.filter((t) => !t.deletedAt);
  if (view.type === 'smart') {
    if (view.id === 'myday') tasks = tasks.filter((t) => t.myDay);
    else if (view.id === 'important') tasks = tasks.filter((t) => t.important);
    else if (view.id === 'planned') tasks = tasks.filter((t) => t.dueDate || t.reminderAt);
  } else if (view.type === 'list') {
    tasks = tasks.filter((t) => t.listId === view.id);
  }
  if (view.type === 'search' && q) {
    tasks = tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q) ||
        t.steps.some((st) => st.title.toLowerCase().includes(q)),
    );
  }
  const open = tasks.filter((t) => !t.completed).sort((a, b) => a.order - b.order);
  const done = tasks.filter((t) => t.completed).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));
  return [...open, ...done];
}

export function listCounts(s: AppState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of s.tasks) {
    if (t.deletedAt) continue;
    counts[t.listId] = (counts[t.listId] || 0) + (t.completed ? 0 : 1);
  }
  return counts;
}
