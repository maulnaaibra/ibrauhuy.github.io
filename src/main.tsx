import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import {
  applyAppearanceToDocument,
  loadAppearanceSettings,
} from './lib/appearance';

applyAppearanceToDocument(loadAppearanceSettings());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
