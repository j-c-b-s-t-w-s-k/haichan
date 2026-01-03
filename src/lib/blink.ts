import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: 'haichan-pow-imageboard-7e3gh26u',
  authRequired: false,
  auth: {
    mode: 'headless'
  }
})

export default blink
