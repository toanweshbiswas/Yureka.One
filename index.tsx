import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { oauthHandoffUrl } from '@shared/oauthHandoff';
import { registerInstallServiceWorker } from '@shared/AddToHomeScreen';
import { initializeFirebaseAnalytics } from '@shared/firebase';

const handoff = oauthHandoffUrl();
if (handoff) {
  // Hard navigation. do not mount Supabase on this origin (would burn the PKCE verifier).
  window.location.replace(handoff);
} else {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Could not find root element to mount to');
  }

  registerInstallServiceWorker();
  void initializeFirebaseAnalytics();

  void import('./App').then(({ default: App }) => {
    document.documentElement.classList.add('hydrated')
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  });
}
