import { useState } from 'react';
import { store, useStore } from '../store/store';
import { formatDateTime, toDateInputValue, toDateTimeLocalValue } from '../util/format';

export default function TaskDetail({ taskId }: { taskId: string }) {
  const state = useStore();
  const task = state.tasks.find((t) => t.id === taskId && !t.deletedAt);
  const [stepTitle, setStepTitle] = useState('');

  if (!task) {
    return <aside className="detail" />;
  }

  const list = state.lists.find((l) => l.id === task.listId);

  return (
    <aside className="detail">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <input
          type="text"
          value={task.title}
          style={{ fontSize: 16, fontWeight: 600, flex: 1 }}
          onChange={(e) => void store.updateTask(task.id, { title: e.target.value })}
        />
        <button className="icon-btn" title="Schließen" onClick={() => store.closeTask()}>
          ✕
        </button>
      </div>

      <div>
        <div className="field-label">Notizen</div>
        <textarea
          placeholder="Notiz hinzufügen …"
          value={task.notes}
          onChange={(e) => void store.updateTask(task.id, { notes: e.target.value })}
        />
      </div>

      <label className={`toggle-row${task.important ? ' on' : ''}`}>
        <input
          type="checkbox"
          checked={task.important}
          onChange={(e) => void store.updateTask(task.id, { important: e.target.checked })}
        />
        ⭐ Wichtig
      </label>

      <label className={`toggle-row${task.myDay ? ' on' : ''}`}>
        <input
          type="checkbox"
          checked={task.myDay}
          onChange={(e) => void store.updateTask(task.id, { myDay: e.target.checked })}
        />
        ☀️ Zu „Mein Tag" hinzufügen
      </label>

      <div>
        <div className="field-label">Fällig am</div>
        <div className="detail-row">
          <input
            type="date"
            value={toDateInputValue(task.dueDate)}
            onChange={(e) =>
              void store.updateTask(task.id, { dueDate: e.target.value ? e.target.value : null })
            }
          />
          {task.dueDate && (
            <button className="icon-btn" title="Entfernen" onClick={() => void store.updateTask(task.id, { dueDate: null })}>
              ✕
            </button>
          )}
        </div>
      </div>

      <div>
        <div className="field-label">Erinnerung</div>
        <div className="detail-row">
          <input
            type="datetime-local"
            value={toDateTimeLocalValue(task.reminderAt)}
            onChange={(e) =>
              void store.updateTask(task.id, {
                reminderAt: e.target.value ? new Date(e.target.value).toISOString() : null,
              })
            }
          />
          {task.reminderAt && (
            <button
              className="icon-btn"
              title="Entfernen"
              onClick={() => void store.updateTask(task.id, { reminderAt: null })}
            >
              ✕
            </button>
          )}
        </div>
        {task.reminderAt && <div className="sub" style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 4 }}>{formatDateTime(task.reminderAt)}</div>}
      </div>

      <div>
        <div className="field-label">Liste</div>
        <select
          value={task.listId}
          onChange={(e) => void store.updateTask(task.id, { listId: e.target.value })}
        >
          {state.lists
            .filter((l) => !l.deletedAt)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.icon} {l.name}
              </option>
            ))}
        </select>
      </div>

      <div>
        <div className="field-label">Schritte ({task.steps.filter((s) => s.done).length}/{task.steps.length})</div>
        <div className="steps">
          {task.steps.map((s) => (
            <div className="step-row" key={s.id}>
              <button
                className={`step-check${s.done ? ' done' : ''}`}
                onClick={() => void store.toggleStep(task.id, s.id)}
              >
                {s.done ? '✓' : ''}
              </button>
              <input
                type="text"
                className={s.done ? 'done' : ''}
                value={s.title}
                onChange={(e) => void store.updateStep(task.id, s.id, e.target.value)}
              />
              <button className="icon-btn" title="Schritt löschen" onClick={() => void store.removeStep(task.id, s.id)}>
                🗑
              </button>
            </div>
          ))}
          <div className="step-row">
            <span className="plus-circle" style={{ width: 16, height: 16, fontSize: 11 }}>
              ＋
            </span>
            <input
              type="text"
              placeholder="Schritt hinzufügen"
              value={stepTitle}
              onChange={(e) => setStepTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void store.addStep(task.id, stepTitle);
                  setStepTitle('');
                }
              }}
            />
          </div>
        </div>
      </div>

      <div className="detail-foot">
        <span>
          Erstellt {formatDateTime(task.createdAt)}
          {list ? ` · ${list.icon} ${list.name}` : ''}
        </span>
        <button className="btn danger" onClick={() => void store.deleteTask(task.id)}>
          Löschen
        </button>
      </div>
    </aside>
  );
}
