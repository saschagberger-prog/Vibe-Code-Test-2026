import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import TaskView from './components/TaskView';
import TaskDetail from './components/TaskDetail';
import Settings from './components/Settings';
import { useStore } from './store/store';

export default function App() {
  const state = useStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.title = 'Vibe To Do';
  }, []);

  if (!state.ready) {
    return <div className="empty">Lädt …</div>;
  }

  return (
    <div className="app">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="main">
        <div className="content">
          <div className="view-header" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="icon-btn menu-btn"
              title="Menü"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
          </div>
          <TaskView onOpenSettings={() => setSettingsOpen(true)} />
        </div>
        {state.detailTaskId && <TaskDetail taskId={state.detailTaskId} />}
      </div>
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
