import type { UserConfig } from 'vite'

export interface IkarosUserConfig {
  viteOption: UserConfig
  input: {
    name: string
    path: string
  }
}
