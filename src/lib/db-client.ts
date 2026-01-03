import { createClient } from '@blinkdotnew/sdk'

export const PROJECT_ID = 'haichan-pow-imageboard-7e3gh26u'

export const db = createClient({
  projectId: PROJECT_ID,
  publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY,
  authRequired: false,
  auth: {
    mode: 'headless'
  }
})

export default db
