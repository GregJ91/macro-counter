import { useState } from 'react';
import { useStore } from './lib/store';
import { Diary } from './pages/Diary';
import { Foods } from './pages/Foods';
import { Planner } from './pages/Planner';
import { Profile } from './pages/Profile';
import { Progress } from './pages/Progress';
import { Settings } from './pages/Settings';

type Page = 'diary' | 'foods' | 'planner' | 'progress' | 'profile';

const ICONS: Record<Page, JSX.Element> = {
  diary: <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zm0 13a3 3 0 0 1 3-3h11M9 8h6" />,
  planner: <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" />,
  progress: <path d="M4 19h16M5 15l4-5 4 3 6-7" />,
  foods: <path d="M6 3v8a2 2 0 0 0 2 2v8M10 3v6M6 7h4M16 21V3c2 1 3 4 3 8h-3" />,
  profile: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0" />,
};

export function App() {
  const { data } = useStore();
  const [page, setPage] = useState<Page>('diary');
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Onboarding: profile first, then goal. Stays on the goal step until it's saved.
  const [onboardingGoal, setOnboardingGoal] = useState(false);

  if (!data.profile || onboardingGoal) {
    return (
      <div className="app">
        {data.profile ? (
          <Settings onboarding onDone={() => setOnboardingGoal(false)} />
        ) : (
          <Profile onboarding onDone={() => setOnboardingGoal(true)} />
        )}
      </div>
    );
  }

  return (
    <div className="app">
      {page === 'diary' && <Diary />}
      {page === 'planner' && <Planner />}
      {page === 'progress' && <Progress />}
      {page === 'foods' && <Foods />}
      {page === 'profile' &&
        (settingsOpen ? <Settings onBack={() => setSettingsOpen(false)} /> : <Profile onOpenSettings={() => setSettingsOpen(true)} />)}
      <nav className="tabs">
        <div>
          {(['diary', 'foods', 'planner', 'progress', 'profile'] as Page[]).map((k) => (
            <button
              key={k}
              aria-current={page === k ? 'page' : undefined}
              onClick={() => {
                setPage(k);
                setSettingsOpen(false);
                window.scrollTo(0, 0);
              }}
            >
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
