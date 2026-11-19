import { useState } from 'react';
import { LIST_COLORS, LIST_ICONS, type SmartListId } from '../model/types';
import { listCounts, store, useStore } from '../store/store';

const SMART: { id: SmartListId; label: string; icon: string }[] = [
  { id: 'myday', label: 'Mein Tag', icon: '☀️' },
  { id: 'important', label: 'Wichtig', icon: '⭐' },
  { id: 'planned', label: 'Geplant', icon: '📅' },
  { id: 'all', label: 'Alle Aufgaben', icon: '☰' },
];

export default function Sidebar({
  open,
  onClose,
  onOpenSettings,
}: {
  open: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const state = useStore();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(LIST_COLORS[0]);
  const [icon, setIcon] = useState(LIST_ICONS[0]);
  const counts = listCounts(state);

  const smartCount = (id: SmartListId): number => {
    const t = state.tasks.filter((x) => !x.deletedAt && !x.completed);
    if (id === 'myday') return t.filter((x) => x.myDay).length;
    if (id === 'important') return t.filter((x) => x.important).length;
    if (id === 'planned') return t.filter((x) => x.dueDate || x.reminderAt).length;
    return t.length;
  };

  const isActiveSmart = (id: SmartListId) => state.view.type === 'smart' && state.view.id === id;
  const isActiveList = (id: string) => state.view.type === 'list' && state.view.id === id;

  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-head">
        <h1>✅ Vibe To Do</h1>
        <button className="icon-btn" title="Einstellungen" onClick={onOpenSettings}>
          ⚙️
        </button>
        <button className="icon-btn menu-btn" title="Schließen" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="search-box">
        <input
          placeholder="Suchen"
          value={state.query}
          onChange={(e) => {
            store.setQuery(e.target.value);
            if (e.target.value.trim()) store.setView({ type: 'search' });
            else if (state.view.type === 'search') store.setView({ type: 'smart', id: 'myday' });
          }}
        />
      </div>

      <nav className="nav" onClick={onClose}>
        {SMART.map((s) => (
          <button
            key={s.id}
            className={`nav-item${isActiveSmart(s.id) ? ' active' : ''}`}
            onClick={() => store.setView({ type: 'smart', id: s.id })}
          >
            <span>{s.icon}</span>
            <span>{s.label}</span>
            <span className="count">{smartCount(s.id)}</span>
          </button>
        ))}

        <div className="nav-section">Listen</div>
        {state.lists
          .filter((l) => !l.deletedAt)
          .sort((a, b) => a.order - b.order)
          .map((l) => (
            <button
              key={l.id}
              className={`nav-item${isActiveList(l.id) ? ' active' : ''}`}
              onClick={() => store.setView({ type: 'list', id: l.id })}
            >
              <span className="dot" style={{ background: l.color }} />
              <span>{l.icon}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {l.name}
              </span>
              <span className="count">{counts[l.id] || 0}</span>
            </button>
          ))}

        {creating ? (
          <div className="new-list-form">
            <input
              autoFocus
              placeholder="Listenname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void store.addList(name, color, icon);
                  setName('');
                  setCreating(false);
                }
                if (e.key === 'Escape') setCreating(false);
              }}
            />
            <div className="picker-row">
              {LIST_COLORS.map((c) => (
                <button
                  key={c}
                  className={`swatch${color === c ? ' selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Farbe ${c}`}
                />
              ))}
            </div>
            <div className="picker-row">
              {LIST_ICONS.map((i) => (
                <button
                  key={i}
                  className={`emoji-pick${icon === i ? ' selected' : ''}`}
                  onClick={() => setIcon(i)}
                >
                  {i}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setCreating(false)}>
                Abbrechen
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  void store.addList(name, color, icon);
                  setName('');
                  setCreating(false);
                }}
              >
                Anlegen
              </button>
            </div>
          </div>
        ) : (
          <button className="nav-item" onClick={() => setCreating(true)}>
            <span>＋</span>
            <span>Neue Liste</span>
          </button>
        )}
      </nav>

      <div className="sidebar-foot">
        <span className={`sync-dot ${state.syncStatus}`} />
        <span>
          {state.syncUrl
            ? state.syncStatus === 'syncing'
              ? 'Synchronisiere …'
              : state.syncStatus === 'error'
                ? 'Sync-Fehler'
                : state.lastSyncAt
                  ? `Sync ${new Date(state.lastSyncAt).toLocaleTimeString('de-DE')}`
                  : 'Sync konfiguriert'
            : 'Offline (lokal)'}
        </span>
      </div>
    </aside>
  );
}
