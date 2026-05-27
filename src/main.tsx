import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App.tsx';

// Google OAuth client ID, read at build time from .env (.env.local).
// Google's GSI script (initTokenClient) throws synchronously on an empty
// client_id, so when the env var is unset we pass a clearly-fake
// placeholder. lib/auth.ts intercepts signIn() in that state and pops an
// actionable error toast instead of letting the OAuth popup open.
const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || 'unset.apps.googleusercontent.com';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
);
