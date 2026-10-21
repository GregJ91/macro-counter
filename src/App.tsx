import { useState } from 'react';
import { useStore } from './lib/store';
import { Diary } from './pages/Diary';
import { Planner } from './pages/Planner';
import { Progress } from './pages/Progress';
import { Settings } from './pages/Settings';

type Page = 'diary' | 'planner' | 'progress' | 'settings';

const ICONS: Record<Page, JSX.Element> = {
  diary: <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zm0 13a3 3 0 0 1 3-3h11M9 8h6" />,
  planner: <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" />,
  progress: <path d="M4 19h16M5 15l4-5 4 3 6-7" />,
  settings: <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm8 3-2-1 .5-2.2-1.6-1.6L14.7 8 13.5 4h-3L9.3 6.2 7.1 5.7 5.5 7.3 6 9.5 4 11v2l2 1.5-.5 2.2 1.6 1.6 2.2-.5L10.5 20h3l1.2-2.2 2.2.5 1.6-1.6-.5-2.2L20 13z" />,
};

export function App() {
  const { data } = useStore();
  const [page, setPage] = useState<Page>('diary');

  if (!data.profile) {
    return (
      <div className="app">
        <Settings onboarding />
      </div>
    );
  }

  return (
    <div className="app">
      {page === 'diary' && <Diary />}
      {page === 'planner' && <Planner />}
      {page === 'progress' && <Progress />}
      {page === 'settings' && <Settings />}
      <nav className="tabs">
        <div>
          {(['diary', 'planner', 'progress', 'settings'] as Page[]).map((k) => (
            <button key={k} aria-current={page === k ? 'page' : undefined} onClick={() => setPage(k)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[k]}
              </svg>
              {k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
