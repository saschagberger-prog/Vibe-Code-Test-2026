import { useState } from 'react';
import { store, syncNow, useStore } from '../store/store';
import { formatDateTime } from '../util/format';

export default function Settings({ onClose }: { onClose: () => void }) {
  const state = useStore();
  const [url, setUrl] = useState(state.syncUrl);
  const [notifState, setNotifState] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>⚙️ Einstellungen</h2>

        <label>
          Design
          <select value={state.theme} onChange={(e) => void store.setTheme(e.target.value as typeof state.theme)}>
            <option value="system">System</option>
            <option value="light">Hell</option>
            <option value="dark">Dunkel</option>
          </select>
        </label>

        <label>
          Sync-Server (z. B. http://192.168.1.10:4173) – leer = nur lokal
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              placeholder="http://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="btn primary" onClick={() => void store.setSyncUrl(url)}>
              Speichern
            </button>
          </div>
        </label>

        <div className={`sync-status${state.syncStatus === 'error' ? ' error' : ''}`}>
          Status: {state.syncStatus === 'syncing' && 'Synchronisiere …'}
          {state.syncStatus === 'ok' && `OK – letzter Sync ${formatDateTime(state.lastSyncAt)}`}
          {state.syncStatus === 'error' && `Fehler: ${state.syncError}`}
          {state.syncStatus === 'idle' && 'Bereit'}
        </div>
        <div>
          <button className="btn" disabled={!state.syncUrl} onClick={() => void syncNow()}>
            Jetzt synchronisieren
          </button>
        </div>

        <label>
          Browser-Benachrichtigungen für Erinnerungen
          <div>
            {notifState === 'granted' ? (
              <span className="sync-status">aktiviert ✅</span>
            ) : notifState === 'unsupported' ? (
              <span className="sync-status">nicht verfügbar</span>
            ) : (
              <button
                className="btn"
                onClick={async () => {
                  const p = await Notification.requestPermission();
                  setNotifState(p);
                }}
              >
                Aktivieren
              </button>
            )}
          </div>
        </label>

        <div className="sync-status">
          Plattformen: Web/PWA · Windows (Electron) · Android &amp; iOS (Capacitor) – gleicher Datenbestand
          via Sync-Server.
        </div>

        <div className="modal-actions">
          <button className="btn primary" onClick={onClose}>
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
