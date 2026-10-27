import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { STORAGE_KEY, useData } from '@/store/data';
import { applyTheme, useUi } from '@/store/ui';
import { migrateFromV1, V1_STORAGE_KEY } from '@/data/migrate';

/** Einmalige Übernahme der v1-Daten, falls noch kein v2-Bestand existiert */
async function bootstrap() {
  try {
    const v1 = localStorage.getItem(V1_STORAGE_KEY);
    // Nur migrieren, wenn noch nie ein v2-Bestand gespeichert wurde
    const hasV2 = localStorage.getItem(STORAGE_KEY) !== null || localStorage.getItem(`${STORAGE_KEY}-migrated`) !== null;
    if (v1 && !hasV2) {
      const data = await migrateFromV1(v1);
      if (data) {
        useData.setState(data);
        localStorage.setItem(`${STORAGE_KEY}-migrated`, new Date().toISOString());
      }
    }
  } catch {
    /* Migration ist optional – bei Fehlern mit Demo-Daten starten */
  }

  applyTheme(useUi.getState().theme);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(useUi.getState().theme));

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
