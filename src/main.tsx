import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { setupPwa } from '@/app/pwa';
import { setupI18n } from '@/i18n/setup';
import '@/ui/styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');

void setupI18n().then(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  void setupPwa();
});
