---
name: make-theme
description: Make a new Claude Desktop theme for the Narsil Skin mod, in the style of its own themes, from a text idea, a reference image, or both. Use when the person asks to create, design or make their own theme, color scheme or live wallpaper for Claude Desktop. Drafts the idea as an Artifact for the person to approve before anything is built.
---

# Make a theme

This skill makes a theme for the Narsil Skin mod. The mod's root is two folders up from this file (`../..`).
Before you start, read `hooks/themes.ts` and `hooks/scenes.ts` there: their themes are the style to follow.

The mod paints a theme through Claude Desktop's own theme API: the app's colors come from three colors of the theme,
and a live wallpaper is an SVG scene drawn behind the conversation. Fonts, corners, shadows and stylesheets are not
part of a theme.

## 1. Find out which kind of theme

There are two kinds. If the person did not say which kind, explain both and ask with `AskUserQuestion`. Do not guess.

- **Color theme.** A page color, a text color, an accent and a status line. It goes into the person's own themes
  folder, shows in the `/narsil-skin themes` pane at once, and a mod update never removes it.
- **Live wallpaper.** All of the above, plus an animated SVG scene behind the window (like Narsil). The scene goes
  beside the theme as `<id>.svg`. It takes longer to make, with a few rounds of review. It moves on its own; unlike
  Narsil's, it does not react to what Claude is doing.

## 2. Read the references

The person can give text, an image, or both.

- **Text:** take the mood, the motifs, the colors and the place it names.
- **Image:** read it with the Read tool. Take its palette (a background, a text color with strong contrast against
  it, one accent), its mood, and its main motifs. For a live wallpaper, also take its shapes and composition: what
  moves, where it sits, and what stays still.

If a reference does not give you enough, ask one short question. Do not ask about things you can choose well
yourself.

## 3. Draft it as an Artifact, and wait for a yes

Do not build before the person sees a draft and approves it.

1. Write the theme as JSON in your scratchpad, for example `draft/theme.json`. The fields are in
   [The theme file](#the-theme-file).
2. For a live wallpaper, write the scene as `draft/<id>.svg` in your scratchpad. Read
   [Live wallpaper scenes](#live-wallpaper-scenes) first.
3. Build the draft page with this skill's script (Node 22.18 or later):
   ```bash
   node "<this skill's folder>/draft.mjs" --theme draft/theme.json [--scene draft/<id>.svg] --out draft/<id>-draft.html
   ```
   The page is a small Claude Desktop mock in the theme's colors, its scene behind frosted panels, as the mod paints
   it. The script prints what the design system finds wrong with the colors. A line that starts with
   `Desktop won't paint` means the app would ignore the whole theme: change the colors until none is left. The other
   notes still paint.
4. Publish the page as an Artifact. Load the artifact skills first, as the Artifact tool asks. In your reply, name
   the colors you chose and why, and the motifs you took from the references.
5. Change the draft until the person says yes. Publish each new version to the same Artifact.

If the person wants to compare versions, make a page with tabs that switch between them, each tab an iframe of one
draft.

## 4. Build it

The person's themes folder is `%USERPROFILE%\.claude\narsil-skin\` on Windows and `~/.claude/narsil-skin/` on macOS.
Create it if it is not there. Do not change the mod's own files: the theme belongs to the person, not to the mod.

1. Write `<id>.json` to the themes folder.
2. For a live wallpaper, copy the approved scene to `<id>.svg` beside it, and make its pane tile, a picture of the
   scene, as `<id>.jpg` (without it the tile is drawn from the theme's colors):
   ```bash
   node "<this skill's folder>/draft.mjs" --theme "<themes folder>/<id>.json" --scene "<themes folder>/<id>.svg" --bare --out draft/<id>-tile.html
   powershell -NoProfile -File "<the mod's root>/tools/thumbs/capture.ps1" -Page draft/<id>-tile.html -Out "<themes folder>/<id>.jpg"
   ```
   On macOS, take the picture with `capture.sh` instead of the `powershell` line:
   ```bash
   sh "<the mod's root>/tools/thumbs/capture.sh" -Page draft/<id>-tile.html -Out "<themes folder>/<id>.jpg"
   ```
   Read the picture to check it shows the scene's main motifs. If the capture fails, delete any `<id>.jpg`, go on,
   and tell the person the tile shows the theme's colors instead.
3. Tell the person to run `/narsil-skin themes` and pick the theme in the "Your themes" row. It shows at once, with
   no restart.

The mod refuses a file with a bad `id`, a missing name, or colors that are not `#rrggbb`, and an `id` that a built-in
theme uses. It drops a scene that is not an `<svg>` or is longer than 131,072 characters. Check these before you
write the files.

## The theme file

```json
{
  "id": "rainy-cafe",
  "name": "Rainy Cafe",
  "tagline": "Warm lamplight, rain on the glass, a slow evening",
  "bg": "#2a211c", "text": "#f2e6d8", "accent": "#e0a458",
  "status": { "idle": "☕", "tool": "☕ {tool}…", "error": "☔ {tool} failed", "done": "☕ done" }
}
```

- `id`: lowercase letters, digits and dashes, 2 to 41 characters, starting with a letter. The file is `<id>.json`.
- `bg`, `text`, `accent`: `#rrggbb` only. The mod builds all of the app's colors from these three: the other
  surfaces and texts are mixed between `bg` and `text`, and a light `bg` makes a light theme. Keep the text readable
  on the background: a contrast ratio of at least 7:1 for text, and 3:1 for the accent.
- `status`: the status line. `{tool}` is the tool's name. Keep each one short; one emoji plus a few words.

## Live wallpaper scenes

Read `hooks/scenes.ts` before you write one: Narsil and Narsil Light are drawn there. The Backdrop takes an SVG with
strict rules, and a scene that breaks one is not drawn at all:

- **Size and frame.** At most 131,072 characters. Start with
  `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">` and fill it with
  `<rect width="100%" height="100%" .../>` layers. Pin a subject to a corner with a nested
  `<svg width="100%" height="100%" viewBox="..." preserveAspectRatio="xMaxYMin meet">`, as the moon is.
- **Pure vector.** No `<image>`, `data:` or base64, `foreignObject`, `@font-face`, `@import`, no `url()` or `href` but
  a local `#id`, no backslash, no DOCTYPE, CDATA or `<?`, and no character reference but `&amp;`, `&lt;`, `&gt;`,
  `&quot;` and `&apos;`. Keep comments to plain words.
- **Motion** is CSS in one `<style>`: `@keyframes` on classes. Keep it slow; a scene that flashes is held still. Give
  each moving part a resting look in its plain markup, since reduced motion takes the animation out.
- **Keep the middle calm.** The chat is written over the middle and the message box sits at the foot: put the big
  things at the sides and top corners.

The person liked these rules for the built-in scenes:

- **A clear idea and a few big motifs**, not a full picture. Two or three kinds of things, each easy to recognize.
- **Drawn in characters**, like Narsil's moon: rounded tiles with a glyph each, and loose glyphs around them as a halo.
- **Things move their bodies**, not only slide: light breathes, rays turn, water rolls.
- **A living background**: twinkles, a slow wave, drifting specks. A scene without one looked empty.
- Keep the visible words in English. Draw nothing that copies a real brand or another person's art.
