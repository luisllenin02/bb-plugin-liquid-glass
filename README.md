# Liquid Glass

monocode's translucent window, inside bb: a wallpaper layer on the window floor
and genuinely frosted panes above it, with the shell tint, accent, opacity,
blur, and wallpaper all pickable.

Two palettes:

- **Liquid Glass** (`liquid-glass`) — dark shell, canvas 9 % lightness, ink 92 %.
- **Liquid Glass Light** (`liquid-glass-light`) — pale shell, 97 % / 18 %.

## What this can and cannot do

monocode gets its look from a transparent macOS `NSWindow` plus native
background blur, so the real desktop shows through the app. **bb's desktop app
is Electron and its window is opaque on macOS** (only Linux has a
`--transparent-window` flag), and no plugin can change that. This theme does not
claim OS-level transparency and does not try to fake it.

What it does instead: it paints a full-window **wallpaper layer** — your own
image, or one of five vibrant presets — on the floor of the window, and makes
every pane above it genuinely translucent with real `backdrop-filter` blur at
monocode's own opacities (sidebar 0.85, blur 24 px). Inside the window the
result is the monocode look over a wallpaper; outside the window, nothing shows
through.

"Genuinely translucent" is measured, not asserted. bb's shell nests its
surfaces — `body` and the main pane both carry `bg-background`, and the sidebar
carries `bg-sidebar` on four elements from the panel down to each sticky tier —
so a theme that only sets the tokens would composite 0.85 four times and pass
0.05 % of the wallpaper. The palettes collapse each stack to exactly one tinted,
blurred layer, and `test/theme-contract.test.mjs` asserts that 15 % of the
wallpaper reaches the eye through both the sidebar and the main pane.

## Install

```
bb plugin install /path/to/liquid-glass --yes
bb theme set plugin:liquid-glass:liquid-glass        # or :liquid-glass-light
```

The palettes also appear under **Settings → Appearance**.

## Settings → Liquid Glass

The settings page is split into four focused sections:

- **Glass** keeps theme mode, independent sidebar and pane opacity and blur,
  main-pane glass, overlay opacity, compact solid panes, wallpaper filters,
  and interactive vibrancy.
- **Colours** offers miniature cards for applying either palette, named accent
  swatches, a credited Monokai-vivid row, nine keyboard-accessible shade ramps,
  native and hex custom-colour controls, and eight shell-tint chips.
- **Wallpaper** shows the five presets as named gradient cards and keeps the
  custom URL and local-file controls.
- **Advanced** is collapsed by default and retains every original hue,
  saturation, and accent H/S/L slider for fine adjustment.

Choosing a swatch, ramp step, or custom colour updates the live appearance.
Changing palettes is different: the plugin calls bb's theme API only after an
explicit **Apply** click, and the current palette carries an **Active** badge.

The Glass controls are:

| Row | Range | Default |
|---|---|---|
| Theme | System / Dark / Light | System |
| Sidebar opacity | 15–100 % | 85 % |
| Blur radius | 1–64 | 24 |
| Main pane glass | on / off | on |
| Pane opacity | 15–100 % | 85 % |
| Pane blur | 0–64 px | 24 px |
| Overlay opacity | 85–100 % | 94 % |
| Compact solid panes | on / off | on |
| Wallpaper brightness | 30–160 % | 100 % |
| Wallpaper blur | 0–40 px | 0 px |
| Wallpaper saturation | 0–200 % | 110 % |
| Wallpaper dim | 0–80 % | 35 % |
| Interactive vibrancy | 0–100 % | 70 % |

The accent picker starts with the nine vibrant thread colours and adds the
classic Monokai vivid green, yellow, orange, pink, purple, and cyan. The runtime
resolves each accent from its actual hue and saturation, moves its lightness
only as far as needed for 4.5:1 contrast on the active palette, and chooses
black or white button text that also clears 4.5:1.

The wallpaper custom controls accept an `https://` URL or an absolute local
path with a **Test** button that reports what the bounded wallpaper route makes
of it.

### Screenshot placeholders

- [ ] Glass controls and independent pane settings
- [ ] Palette cards with the Active badge and Apply button
- [ ] Accent swatches, Monokai-vivid row, and hue ramps
- [ ] Shell-tint chips and custom colour control
- [ ] Named wallpaper gradient cards and custom image controls
- [ ] Expanded Advanced fine-adjustment sliders

### Dialling in the glass

Turn **Main pane glass** on, then balance **Pane opacity** against **Pane blur**:
lower opacity reveals more wallpaper, while more blur keeps text readable at a
small compositing cost. Sidebar opacity and blur stay independent. Wallpaper
brightness, blur, saturation, and dim always affect the wallpaper layer, even
when main-pane glass is off, so the image can be tuned before the pane is made
transparent. On phones the main pane and sheets can go near-solid, but the
sidebar drawer always keeps the chosen sidebar opacity and blur.

### Why sheets are frosted, not clear

Sidebar and main-pane glass sit beside each other directly on the wallpaper,
so translucency belongs there. Menus, dialogs, drawers, the compact home pane,
the sticky thread header, and the composer dock sit over readable application
content. Those surfaces use an independent 94% shell tint and a 32 px blur by
default: the layer beneath contributes a soft colour glow without leaving text
or row shapes legible. **Overlay opacity** can make sheets fully solid, while
**Compact solid panes** makes the main pane and sheets near-solid on phones;
the sidebar keeps its glass.

"Reset to monocode defaults" restores every value.

The **Theme** row writes bb's own client-side light/dark key
(`localStorage["bb.theme"]`); the marketplace **Theme Toggle** plugin is a good
companion if you want to switch palettes quickly from the sidebar footer.

## `bb liquid-glass`

```
bb liquid-glass show                     # every key and its current value
bb liquid-glass set blur 32
bb liquid-glass set sidebarOpacity 0.7
bb liquid-glass set paneOpacity 0.72
bb liquid-glass set paneBlur 32
bb liquid-glass set overlayOpacity 0.97
bb liquid-glass set compactSolidPanes off
bb liquid-glass set hue 210
bb liquid-glass set wallpaper ocean
bb liquid-glass set accent violet
bb liquid-glass set wallpaperPath /home/you/Pictures/wall.jpg
bb liquid-glass set wallpaperBrightness 0.9
bb liquid-glass set wallpaperBlur 8
bb liquid-glass set wallpaperSaturation 1.25
bb liquid-glass set interactiveVibrancy 85
bb liquid-glass set paneGlass off
bb liquid-glass presets                  # wallpaper presets and accent swatches
bb liquid-glass reset
```

## The wallpaper route

A local wallpaper is served by the plugin's own bounded route,
`GET /api/v1/plugins/liquid-glass/http/wallpaper`. It serves exactly the one
absolute path saved in the settings and nothing else: no path ever arrives from
the request, the file must exist and be a regular file, it must be 20 MB or
less, and its extension must be `.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`, or
`.gif`. Anything else is a 404.

The CSS asks for it as `…/http/wallpaper?v=<updatedAt>`, where `updatedAt` is
the server's write stamp, so pointing the setting at a different file actually
repaints instead of showing the cached picture. The route ignores the query
entirely — it can never select a file.

## Customising the palette without the frontend

Every knob is a CSS custom property with a fallback, so the palettes are
complete on their own and stay correct if the plugin's frontend is disabled:

| Property | Default | What it does |
|---|---|---|
| `--lg-hue` | `240` | shell tint hue |
| `--lg-sat` | `0%` | shell tint saturation |
| `--lg-accent-h` | `211` | accent hue |
| `--lg-accent-s` | `92%` | accent saturation |
| `--lg-accent-l` | `62%` dark / `38%` light | accent lightness |
| `--lg-primary-fg-l` | `0%` dark / `100%` light | computed primary-button foreground lightness |
| `--lg-sidebar-a` | `0.85` | sidebar and rail opacity |
| `--lg-pane-a` | `0.85` | main-pane opacity when pane glass is on |
| `--lg-blur` | `24px` | sidebar, card, and popover backdrop blur |
| `--lg-pane-blur` | `24px` | main-pane backdrop blur when pane glass is on |
| `--lg-overlay-a` | `0.94` | menus, sheets, dialogs, and sticky chrome opacity |
| `--lg-wp-brightness` | `1` | wallpaper brightness filter |
| `--lg-wp-blur` | `0px` | wallpaper blur filter |
| `--lg-wp-sat` | `1.1` | wallpaper saturation filter |
| `--lg-wallpaper` | the `aurora` preset | the wallpaper image |
| `--lg-wallpaper-custom` | — | the custom `url()` |
| `--lg-dim` | `0.35` dark / `0.1` light | wallpaper dim overlay |
| `--lg-vibrancy` | `70` | accent-wash intensity for interactive controls |

Presets are selected with `html[data-lg-wallpaper="aurora|forest|sunset|ocean|mono|custom"]`
and the main-pane toggle with `html[data-lg-pane-glass="on|off"]`.

## Accessibility

`test/theme-contract.test.mjs` computes — it never assumes — every text token's
contrast against the flat canvas and against the sidebar and main pane
composited over the default wallpaper at the default dim, and asserts 4.5:1 on
both. It also checks every shipped accent and custom hue/saturation boundaries
through the runtime resolver against both palettes. A wallpaper you supply
yourself is outside that model: a very bright image
under the dark palette, or a very dark one under the light palette, reduces
contrast. The Sidebar opacity and Wallpaper dim sliders are the fix.

## Development

```
npm install
npm run typecheck
npm test          # node:test theme contract + vitest (server, appearance, app)
bb plugin build
```

Fonts are deliberately not set here — the Fonts plugin owns typography.
