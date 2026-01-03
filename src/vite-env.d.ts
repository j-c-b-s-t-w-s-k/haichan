/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BLINK_PUBLISHABLE_KEY: string
  readonly VITE_PROJECT_ID: string
  readonly VITE_URBIT_STAR_PATP?: string
  readonly VITE_URBIT_BRIDGE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
