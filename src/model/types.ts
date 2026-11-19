export interface Step {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  listId: string;
  title: string;
  notes: string;
  dueDate: string | null;
  reminderAt: string | null;
  important: boolean;
  myDay: boolean;
  steps: Step[];
  completed: boolean;
  completedAt: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TaskList {
  id: string;
  name: string;
  color: string;
  icon: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type SmartListId = 'myday' | 'important' | 'planned' | 'all';

export type View =
  | { type: 'smart'; id: SmartListId }
  | { type: 'list'; id: string }
  | { type: 'search' };

export interface AppState {
  lists: TaskList[];
  tasks: Task[];
  view: View;
  query: string;
  detailTaskId: string | null;
  theme: 'light' | 'dark' | 'system';
  syncUrl: string;
  lastSyncAt: string | null;
  syncStatus: 'idle' | 'syncing' | 'ok' | 'error';
  syncError: string | null;
  ready: boolean;
}

export const LIST_COLORS = [
  '#0078d4', '#d13438', '#107c10', '#ca5010', '#8764b8',
  '#038387', '#e3008c', '#567c73', '#69797e', '#e81123',
];

export const LIST_ICONS = ['📋', '🛒', '💼', '🏠', '🎬', '📚', '✈️', '💰', '🎵', '⭐'];

export const DEFAULT_LIST_ID = 'default-list';
export const DEFAULT_LIST_COLOR = '#0078d4';
export const DEFAULT_LIST_ICON = '📋';
export const LAST_SYNC_KEY = 'last-sync-at';
