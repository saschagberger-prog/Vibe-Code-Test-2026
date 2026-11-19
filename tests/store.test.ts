import { beforeAll, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';

const { store, selectVisibleTasks, listCounts } = await import('../src/store/store');
const { DEFAULT_LIST_ID } = await import('../src/model/types');

describe('store (mit fake-indexeddb)', () => {
  beforeAll(async () => {
    await store.seed();
  });

  it('seed legt Default-Liste und 3 Aufgaben an', () => {
    const s = store.getState();
    expect(s.lists).toHaveLength(1);
    expect(s.lists[0].id).toBe(DEFAULT_LIST_ID);
    expect(s.tasks).toHaveLength(3);
  });

  it('addTask / toggleTask / updateTask funktionieren', async () => {
    await store.addTask(DEFAULT_LIST_ID, 'Testaufgabe');
    let s = store.getState();
    const task = s.tasks.find((t) => t.title === 'Testaufgabe');
    expect(task).toBeTruthy();
    expect(task!.completed).toBe(false);

    await store.toggleTask(task!.id);
    s = store.getState();
    expect(s.tasks.find((t) => t.id === task!.id)!.completed).toBe(true);
    expect(s.tasks.find((t) => t.id === task!.id)!.completedAt).toBeTruthy();

    await store.updateTask(task!.id, { important: true, dueDate: '2026-12-24' });
    s = store.getState();
    const updated = s.tasks.find((t) => t.id === task!.id)!;
    expect(updated.important).toBe(true);
    expect(updated.dueDate).toBe('2026-12-24');
  });

  it('Schritte hinzufügen, umschalten, löschen', async () => {
    await store.addTask(DEFAULT_LIST_ID, 'Schritte-Test');
    const s1 = store.getState();
    const task = s1.tasks.find((t) => t.title === 'Schritte-Test')!;
    await store.addStep(task.id, 'Schritt 1');
    await store.addStep(task.id, 'Schritt 2');
    let s = store.getState();
    let t = s.tasks.find((x) => x.id === task.id)!;
    expect(t.steps).toHaveLength(2);
    await store.toggleStep(task.id, t.steps[0].id);
    s = store.getState();
    t = s.tasks.find((x) => x.id === task.id)!;
    expect(t.steps[0].done).toBe(true);
    await store.removeStep(task.id, t.steps[1].id);
    s = store.getState();
    expect(s.tasks.find((x) => x.id === task.id)!.steps).toHaveLength(1);
  });

  it('deleteTask setzt Tombstone', async () => {
    await store.addTask(DEFAULT_LIST_ID, 'Weg damit');
    const s = store.getState();
    const task = s.tasks.find((t) => t.title === 'Weg damit')!;
    await store.deleteTask(task.id);
    const after = store.getState();
    expect(after.tasks.find((t) => t.id === task.id)).toBeUndefined();
    expect(selectVisibleTasks(after).every((t) => t.id !== task.id)).toBe(true);
  });

  it('selectVisibleTasks filtert Smart-Listen', async () => {
    let s = store.getState();
    store.setView({ type: 'smart', id: 'myday' });
    s = store.getState();
    const myday = selectVisibleTasks(s);
    expect(myday.length).toBeGreaterThan(0);
    expect(myday.every((t) => t.myDay && !t.completed && !t.deletedAt)).toBe(true);

    store.setView({ type: 'smart', id: 'important' });
    s = store.getState();
    const imp = selectVisibleTasks(s);
    expect(imp.length).toBeGreaterThan(0);
    expect(imp.every((t) => t.important)).toBe(true);

    store.setView({ type: 'list', id: DEFAULT_LIST_ID });
    s = store.getState();
    expect(selectVisibleTasks(s).every((t) => t.listId === DEFAULT_LIST_ID)).toBe(true);
    expect(listCounts(s)[DEFAULT_LIST_ID]).toBeGreaterThan(0);
  });

  it('addList legt Liste an und wechselt die Ansicht', async () => {
    await store.addList('Projekt X', '#ca5010', '💼');
    const s = store.getState();
    const list = s.lists.find((l) => l.name === 'Projekt X');
    expect(list).toBeTruthy();
    expect(s.view).toEqual({ type: 'list', id: list!.id });
  });
});
