// The palette a theme is drawn from: its page, text and accent, with the rest of its surfaces and roles
export type Palette = {
  mode: 'light' | 'dark'
  surfaces: [string, string, string, string]
  text: [string, string, string]
  roles: { accent: string; danger: string; success: string; warning: string; pro: string }
}
// the pooled wave of every conversation, and what they are doing
export type Wave = '' | 'waiting' | 'error'
export type Mood = 'thinking' | 'waiting' | 'idle'

export type Theme = {
  id: string
  name: string
  tagline: string
  // its colors; absent for Claude's own
  palette?: Palette
  // the scene drawn behind the conversation, by name
  wallpaper?: string
  status?: { idle: string; tool: string; error: string; done: string }
  // a person's own scene: the text of their <id>.svg
  scene?: string
  // a person's own wallpaper: its <id>.jpg, as a data: URL, for the pane's tile
  thumb?: string
}

declare module 'claude-code' {
  interface PluginState {
    'narsil-skin': {
      current: string
      // the old extension is still in Claude Desktop's extensions folder
      legacy: boolean
      speed: number
      veil: number
      sky: { wave: Wave; tide: boolean; state: Mood; flare: boolean }
    }
  }
}
