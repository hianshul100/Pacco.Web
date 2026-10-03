import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AppShell } from '@/AppShell'

import './index.css'

const container = document.getElementById('root')
if (container === null) {
  throw new Error('Pacco.Web could not mount: #root is missing from the host document.')
}

createRoot(container).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
)
