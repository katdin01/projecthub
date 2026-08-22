// Installs window.api (HTTP transport to the local server) before anything
// touches it. Must stay first so the app never sees an undefined api.
import './lib/browserApi'

import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
