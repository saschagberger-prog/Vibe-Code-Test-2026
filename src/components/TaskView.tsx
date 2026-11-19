import { useState } from 'react';
import type { Task } from '../model/types';
import { selectVisibleTasks, store, useStore } from '../store/store';
import { formatDue, todayStr } from '../util/format';

function viewTitle(state: ReturnType<typeof useStore>): { title: string; icon: string; sub: string } {
  const v = state.view;
  if (v.type === 'smart') {
    if (v.id === 'myday') {
      const d = new Date();
      return {
        title: 'Mein Tag',
        icon: '☀️',
        sub: d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
      };
    }
    if (v.id === 'important') return { title: 'Wichtig', icon: '⭐', sub: 'Mit Stern markierte Aufgaben' };
    if (v.id === 'planned') return { title: 'Geplant', icon: '📅', sub: 'Aufgaben mit Fälligkeit oder Erinnerung' };
    return { title: 'Alle Aufgaben', icon: '☰', sub: 'Alle offenen Aufgaben' };
  }
  if (v.type === 'search') return { title: 'Suche', icon: '🔍', sub: `„${state.query}“` };
  const list = state.lists.find((l) => l.id === v.id);
  return {
    title: list?.name || 'Liste',
    icon: list?.icon || '📋',
    sub: '',
  };
}

function TaskRow({ task }: { task: Task }) {
  const state = useStore();
  const due = formatDue(task.dueDate);
  const openSteps = task.steps.filter((s) => !s.done).length;
  const list = state.lists.find((l) => l.id === task.listId);
  const showListBadge = state.view.type === 'smart' || state.view.type === 'search';
  const isOpen = state.detailTaskId === task.id;

  return (
    <div
      className={`task-row${task.completed ? ' completed' : ''}${isOpen ? ' open' : ''}`}
      onClick={() => store.openTask(task.id)}
    >
      <button
        className={`check${task.completed ? ' done' : ''}`}
        title={task.completed ? 'Als offen markieren' : 'Als erledigt markieren'}
        onClick={(e) => {
          e.stopPropagation();
          void store.toggleTask(task.id);
        }}
      >
        {task.completed ? '✓' : ''}
      </button>
      <div className="task-main">
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          {showListBadge && list && (
            <span className="badge">
              <span className="dot" style={{ background: list.color, width: 8, height: 8, borderRadius: '50%', display: 'inline-block' }} />
              {list.name}
            </span>
          )}
          {due && <span className={`badge due-${due.tone}`}>📅 {due.label}</span>}
          {task.reminderAt && <span className="badge">🔔</span>}
          {task.steps.length > 0 && (
            <span className="badge">
              ✓ {task.steps.length - openSteps}/{task.steps.length}
            </span>
          )}
          {task.myDay && state.view.type !== 'smart' && <span className="badge">☀️ Mein Tag</span>}
        </div>
      </div>
      <div className="row-actions">
        <button
          className={`icon-btn${task.myDay ? ' active' : ''}`}
          title="Mein Tag"
          onClick={(e) => {
            e.stopPropagation();
            void store.updateTask(task.id, { myDay: !task.myDay });
          }}
        >
          ☀️
        </button>
        <button
          className={`icon-btn${task.important ? ' active' : ''}`}
          title="Wichtig"
          onClick={(e) => {
            e.stopPropagation();
            void store.updateTask(task.id, { important: !task.important });
          }}
        >
          {task.important ? '★' : '☆'}
        </button>
      </div>
    </div>
  );
}

export default function TaskView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const state = useStore();
  const [newTitle, setNewTitle] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const tasks = selectVisibleTasks(state);
  const { title, icon, sub } = viewTitle(state);
  const open = tasks.filter((t) => !t.completed);
  const done = tasks.filter((t) => t.completed);

  const currentListId =
    state.view.type === 'list'
      ? state.view.id
      : state.lists.filter((l) => !l.deletedAt).sort((a, b) => a.order - b.order)[0]?.id || '';

  const submit = () => {
    if (!newTitle.trim()) return;
    void store.addTask(currentListId, newTitle, state.view.type === 'smart' && state.view.id === 'myday');
    setNewTitle('');
  };

  return (
    <>
      <div className="view-header">
        <h2>
          <span>{icon}</span>
          <span>{title}</span>
          {state.view.type === 'smart' && state.view.id === 'myday' && (
            <button className="icon-btn" title="Einstellungen" onClick={onOpenSettings}>
              ⚙️
            </button>
          )}
        </h2>
        {sub && <div className="sub">{sub}</div>}
      </div>

      <div className="add-task">
        <span className="plus-circle">＋</span>
        <input
          placeholder="Aufgabe hinzufügen"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
      </div>

      <div className="task-list">
        {open.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
        {open.length === 0 && done.length === 0 && (
          <div className="empty">
            {state.view.type === 'search'
              ? 'Keine Ergebnisse.'
              : 'Keine offenen Aufgaben. Alles erledigt! 🎉'}
          </div>
        )}
      </div>

      {done.length > 0 && (
        <div className="completed-section">
          <button className="completed-toggle" onClick={() => setShowCompleted((v) => !v)}>
            {showCompleted ? '▾' : '▸'} Erledigt ({done.length})
          </button>
          {showCompleted && (
            <div className="task-list">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          )}
        </div>
      )}

      {state.view.type === 'smart' && state.view.id === 'myday' && (
        <div className="sub" style={{ marginTop: 16, color: 'var(--text-dim)' }}>
          Heute: {todayStr()}
        </div>
      )}
    </>
  );
}
