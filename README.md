# Narsil Skin

<p align="center">
  <img src="https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/readme/celebrating-claro.svg" width="150" alt="Narsil showing off a new theme (light mode)">
  <img src="https://raw.githubusercontent.com/davshn/narsil-pet/main/assets/readme/celebrating-oscuro.svg" width="150" alt="Narsil showing off a new theme (dark mode)">
</p>

Narsil Skin is the third mod in the [Narsil](https://github.com/davshn/narsil-pet) family, alongside [Narsil Check](https://github.com/davshn/narsil-check): it reskins the Claude desktop app. It applies live color themes and animated wallpapers drawn with characters that move behind the chat, through the app's own theme API. Themes are picked from a side pane with `/narsil-skin themes`, so the space above the prompt stays free for Narsil.

It is an **open source** Claude Code mod, released under the [MIT](#license) license.

## Contents

- [Features](#features)
- [Installation](#installation)
- [Commands](#commands)
- [Supported systems](#supported-systems)
- [Uninstalling](#uninstalling)
- [Security](#security)
- [Development](#development)
- [License](#license)

## Features

### The themes pane
`/narsil-skin themes` opens the **Themes** pane next to the chat. At the top it says which theme you have on and its description, and below are the themes grouped into **Live wallpapers**, **Color themes**, and **Your themes**, each with its thumbnail. A click on a theme applies it right away; **Claude** brings back the app's original colors. The pane closes with **Close** or with Escape.

The **Auto day and night** button switches themes on its own based on your computer's clock: **Narsil Light** from 6:00 to 17:59 and **Narsil** from 18:00 to 5:59. Turn it off by clicking it again or by picking a theme by hand.

The theme you pick is kept between sessions, and your other open conversations switch to it at their next message, or within ten seconds.

### Animated wallpapers
A scene drawn with characters moves behind the chat. From the pane you can change its speed and how opaque the app's panels, the sidebar among them, are over it (**panels**: from clear glass to 80%, 40% by default), so the text stays readable. The themes pane itself paints no ground over a live wallpaper, so the scene shows through it.

<p align="center">
  <img src="docs/narsil.png" alt="Narsil: a night sea background with a crescent moon at the top right of the window">
  <br><strong>Narsil</strong>
</p>

**Narsil** is the house theme: a night sea with a crescent moon high over the chat, clear of the side panes, whose light breathes slowly. The stars twinkle, and flare when a turn ends; shooting stars cross while Claude thinks, and a blue border pulses when it is waiting for you.

The wave at the bottom sums up the state of all your conversations at once:

| Wave | When |
|:-|:-|
| **Yellow** | Some conversation needs your answer. |
| **Red** | There was an error. It goes out when a tool works again or you write to that conversation. |
| **Blue** | Nothing is pending. |
| **High tide** | Some conversation is working. |

If one conversation is waiting for you and another has an error at the same time, the wave turns yellow.

<p align="center">
  <img src="docs/narsil-light.png" alt="Narsil Light: a sky blue background with a sun at the top right of the window">
  <br><strong>Narsil Light</strong>
</p>

**Narsil Light** is the daytime version for light mode: a sky-blue sky with a sun high over the chat, whose rays turn slowly. The wave works the same way, in softer tones so the text over it stays readable, and the sunlight flashes when a turn ends.

While Claude thinks, the scene runs three times faster.

### Narsil while Claude thinks
Under **Narsil** and **Narsil Light**, Narsil's head takes the place of Claude's thinking indicator, tilting slowly from side to side, with Claude's words beside it. Her dark version shows in dark mode and her light one in light mode. While a command or another tool runs, the app shows its own indicator: a mod cannot change that one. Under Claude's colors or your own themes, the indicator stays as it is.

### Narsil when Claude asks you something
Under **Narsil** and **Narsil Light**, when Claude asks you a question, Narsil shows up above the question card with her surprised face, a faint, slow ripple running down her from crest to chin, and the words "Narsil tiene una pregunta para ti". The card itself is the app's, so you answer it as always. Like the thinking indicator, her dark version shows in dark mode and her light one in light mode, and under Claude's colors or your own themes the card stays as it is.

### Narsil beside each tool call
Under **Narsil** and **Narsil Light**, a small face of Narsil sits beside each tool call's row in the conversation (a command, an edit) and tells how it is going:

| Face | When |
|:-|:-|
| Focused, bobbing | The call is running. |
| Happy | It finished well. |
| Wincing | It failed. |
| Asleep | It was interrupted. |

Reads, searches, and listings are folded by the app into one line ("Read 3 files"), and that line gets one face for all of them: working while any still runs, then asleep if one was interrupted, wincing if one failed, and happy once all went well. When you unfold it, each row shows its own face. Under Claude's colors or your own themes, the rows stay as they are.

### Color themes
A color theme changes all of the app's colors, built from three: a page color, a text color, and an accent. The mod only includes **Claude**, the app's original colors; you can [make your own](#your-own-themes).

If you have "reduce motion" on, the scenes hold still and only the colors remain.

### Your own themes
Ask Claude to "make me a theme" with an idea, an image, or both. The `make-theme` skill asks you which kind you want, shows you a draft as an Artifact for you to approve, and then builds it.

You can also create them by hand in `%USERPROFILE%\.claude\narsil-skin\` (macOS: `~/.claude/narsil-skin/`):

- **Color theme**: `<id>.json` with `id`, `name`, and the `bg`, `text`, and `accent` colors as `#rrggbb`.
- **Animated wallpaper**: the same `<id>.json`, with the scene as an SVG in `<id>.svg` beside it. It shows up when you pick it in `/narsil-skin themes`, without restarting.

They appear under **Your themes**, and a mod update does not delete them.

## Installation

You need the Claude desktop app, in the **Code** tab. Inside Claude Code, run:

```
/plugin marketplace add davshn/narsil-skin
/plugin install narsil-skin@narsil-skin
```

In the desktop app, where `/plugin` does not work: open **Settings → Plugins**, click **Add → Add marketplace**, type `davshn/narsil-skin`, and install **narsil-skin**.

Then:

1. If `/narsil-skin` does not show up in the command list, run `/reload-plugins` and then `/reload-skills`.
2. Run `/narsil-skin themes` in a conversation and pick a theme. On the **+ New** home page it only opens a new conversation: run it again inside that one.

There is nothing else to install: the themes paint through the app's own theme API, with no restart.

### Coming from 1.x

Versions 1.x painted the themes with an extension that Claude Desktop 6.28899 and later no longer loads. If it is still installed, the themes pane says so: click **Remove old extension** to take it out, along with the `REACT_PROFILE` variable when no other mod uses its folder. Your theme choice carries over. Custom stylesheets (`<id>.css`) and canvas scenes (`<id>.js`) of your own themes are no longer read: their colors still work, and a scene can be redrawn as `<id>.svg`.

To update to the latest version:

```
/plugin marketplace update narsil-skin
/plugin update narsil-skin@narsil-skin
```

## Commands

| Command | What it does |
| --- | --- |
| `/narsil-skin themes` | Opens the themes pane. It is the way to open it again if you close it. |
| `/narsil-skin` | Shows the help with the commands. It also answers this way to an argument it does not know. |
| `/narsil-skin:make-theme` | Creates a new theme, a color one or an animated wallpaper, from an idea or an image. You can also ask Claude for it in your own words. |

## Supported systems

The themes are painted by the apps that draw Claude Code's themes:

| | Desktop app | Mobile app | Terminal and VS Code |
| --- | --- | --- | --- |
| Themes pane | Yes | Yes | The pane is drawn, but there is nothing to paint |
| Color themes | Yes | Yes | No |
| Animated wallpapers | Yes | Yes, under one veil | No |

It uses the theme API that Claude Code gives mods, from version 2.1.328.

## Uninstalling

1. Pick **Claude** in `/narsil-skin themes` to bring back the app's colors (uninstalling also takes the theme with it).
2. Uninstall the plugin: in **Settings → Plugins** or with `claude plugin uninstall narsil-skin`.
3. Optional: also remove the marketplace, with `claude plugin marketplace remove narsil-skin` or from **Settings → Plugins → Add → Manage marketplaces**.

Your themes, and the conversations' shared state in `.state`, stay in `%USERPROFILE%\.claude\narsil-skin\` (macOS: `~/.claude/narsil-skin/`). Delete that folder if you do not want them.

If a 1.x extension is still in the app's `extensions` folder, click **Remove old extension** in the themes pane before uninstalling, or remove it by hand. The folder may hold other mods, so this only deletes it, along with the variable, when it contains only this one. In PowerShell:

```powershell
$data = Get-ChildItem "$env:LOCALAPPDATA\Claude-Data" -Directory -Filter 'claude*' -ErrorAction SilentlyContinue |
  Where-Object { Test-Path (Join-Path $_.FullName 'Local State') } | Select-Object -First 1
$d = if ($data) { Join-Path $data.FullName 'extensions\fmkadmapgofadopljbjfkapdkoienihi' } else { "$env:APPDATA\Claude\extensions\fmkadmapgofadopljbjfkapdkoienihi" }
if (((Get-Content "$d\manifest.json" -Raw | ConvertFrom-Json).content_scripts.js -join ',') -eq 'theme.js') {
  Remove-Item -Recurse $d; [Environment]::SetEnvironmentVariable('REACT_PROFILE', $null, 'User')
} else { "Another mod shares $d. Delete only theme.js, theme.json and event.json, and their manifest entries." }
```

On macOS, in Terminal:

```bash
d="$HOME/Library/Application Support/Claude/extensions/fmkadmapgofadopljbjfkapdkoienihi"
js() { plutil -extract "$1" raw -o - "$d/manifest.json" 2>/dev/null; }
if [ "$(js content_scripts)/$(js content_scripts.0.js)/$(js content_scripts.0.js.0)" = "1/1/theme.js" ]; then
  rm -rf "$d"; launchctl unsetenv REACT_PROFILE
  rm -f ~/Library/LaunchAgents/com.github.0toshigami.themes-for-claude.plist
else echo "Another mod shares $d. Delete only theme.js, theme.json and event.json, and their manifest entries."; fi
```

## Security

A theme is data only. Its colors go to the app through the theme API, and an animated wallpaper's scene (`<id>.svg`) is drawn by the app as a pure vector picture: it refuses any scene that holds a script, a picture, a font, or a link to anything outside it.

## Development

Narsil Skin is open source and contributions are welcome: open an issue or a pull request on [GitHub](https://github.com/davshn/narsil-skin).

To work on a local copy, add its folder as a marketplace; changes arrive with `/reload-plugins`, without reinstalling:

```
claude plugin marketplace add <path-to-your-copy>
claude plugin validate .
claude plugin test .
```

- `hooks/register.tsx`: the mod's hooks (the themes pane, `/narsil-skin themes`, setting the theme, the Backdrop scene, the reactions to what Claude is doing, and removing the 1.x extension).
- `hooks/look.ts`: the themes' palettes and the colors built from them with `make-colors.js`, which comes from the plugin-authoring skill and is left as it is.
- `hooks/scenes.ts`: the animated wallpapers, as SVG scenes.
- `hooks/themes.ts`: the list of themes, reading your themes, and the pane's thumbnails.
- `hooks/thumbs.ts`: the animated wallpapers' thumbnails.
- `hooks/spinner.ts`: Narsil's head in place of the thinking indicator, and its tilt.
- `hooks/asking.ts`: Narsil's surprised face above the question card, and its wave.
- `hooks/tools.ts`: Narsil's face beside each tool call's row and each folded group of calls, by how they are going.
- `hooks/heads.ts`: her faces, light and dark, as pixel art; made by `tools/heads/build.ps1` from the art in [narsil-pet](https://github.com/davshn/narsil-pet), since the app drops a picture embedded in an SVG.
- `skills/make-theme/`: the skill that creates new themes.
- `tools/thumbs/`: the thumbnail capture.
- `tools/heads/`: the script that makes `hooks/heads.ts`.
- `tests/`: the tests.

## License

Narsil Skin is released under the [MIT license](LICENSE).

In short: you can use, copy, modify, and distribute it freely, including in closed-source projects, as long as you keep the copyright notices and the license text in [LICENSE](LICENSE). It comes with no warranty.

It is a community mod: it is not made or endorsed by Anthropic. Claude, Claude Desktop, Claude Code, and Clawd belong to Anthropic.
