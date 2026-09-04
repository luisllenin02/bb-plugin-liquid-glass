# Liquid Glass

Liquid Glass brings monocode's translucent-window look to bb with a wallpaper
layer beneath genuinely frosted panes, two dark and light palettes, and vibrant,
pickable accents alongside adjustable shell tint, opacity, and blur.

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

### BB Community marketplace

Open bb's plugin marketplace, find **Liquid Glass**, and choose **Install**.

### Git

```bash
bb plugin install git:https://github.com/luisllenin02/bb-plugin-liquid-glass.git@^0.5.4
```

### Activate

```bash
bb theme set plugin:liquid-glass:liquid-glass
```

Use `plugin:liquid-glass:liquid-glass-light` instead for the light palette. The
palettes also appear under **Settings → Appearance**.

Configure the theme visually under **Settings → Liquid Glass**, or use
`bb liquid-glass` for the same settings from the command line. The plugin does
not poll in the background; it reacts only to settings, appearance, and theme
events. True transparency through to the desktop requires a compatible host
build because a theme plugin cannot make an opaque application window
transparent.

## Settings → Liquid Glass

The settings page is split into six sections, each named for what it changes:

- **Theme** holds the palette cards, a System / Dark / Light follow-the-system
  row, the shell-tint chips with their hue and saturation sliders, the accent
  picker, and interactive vibrancy.
- **Transparency** sets how solid each surface family is: the sidebar, the main
  pane, menus and sheets and cards, the header and dock tint with its depth,
  and the prompt box collapsed and expanded.
- **Blur** carries the three blurs that exist: sidebar frost, header and
  prompt-box frost, and wallpaper blur. Menus, dialogs and cards use a fixed
  backdrop blur and are deliberately not adjustable here.
- **Wallpaper** shows the five presets as named gradient cards, keeps the
  custom URL and local-file controls, and holds the wallpaper brightness,
  colour, and wash filters.
- **Phones** is the single solid-panels-on-phones toggle.
- **Composer** holds the context meter and the status cards above the prompt.
  Both are saved on this device rather than in the shared settings.

The hue, saturation and accent H/S/L fine-tuning sliders live inside the two
colour pickers they belong to. Hue is disabled while the tint strength is 0 and
Tint depth while the tint is 0, because neither does anything there.

Choosing a swatch, ramp step, or custom colour updates the live appearance.
Changing palettes is different: the plugin calls bb's theme API only after an
explicit **Apply** click, and the current palette carries an **Active** badge.

The controls are:

| Row | Section | Range | Default |
|---|---|---|---|
| Follow the system | Theme | System / Dark / Light | System |
| Shell tint | Theme | 8 chips + hue 0–360, saturation 0–100 % | neutral |
| Accent | Theme | 9 vibrant + 6 Monokai + custom | blue |
| Interactive vibrancy | Theme | 0–100 % | 70 % |
| Sidebar | Transparency | 15–100 % | 85 % |
| Main pane | Transparency | 15–100 % | 85 % |
| Menus, sheets and cards | Transparency | 50–100 % | 94 % |
| Header and dock tint | Transparency | 0–100 % | 72 % |
| Tint depth | Transparency | 0–96 px | 40 px |
| Prompt box, collapsed | Transparency | 15–100 % | 60 % |
| Prompt box, expanded | Transparency | 15–100 % | 100 % |
| Sidebar frost | Blur | 0–64 px | 24 px |
| Header and prompt box frost | Blur | 0–48 px | 20 px |
| Wallpaper blur | Blur | 0–64 px | 24 px |
| Wallpaper brightness | Wallpaper | 30–160 % | 100 % |
| Wallpaper colour | Wallpaper | 0–200 % | 110 % |
| Wallpaper wash | Wallpaper | 0–80 % | 35 % |
| Solid panels on phones | Phones | on / off | on |
| Context meter | Composer | marker / card | marker |
| Status cards above the prompt | Composer | cards / deck / pills / auto | auto |

There is no separate main-pane-glass toggle and no separate pane blur. A
non-glass main pane is just Main pane at 96 %, and pane blur and wallpaper blur
were always summed into one filter, so they are one Wallpaper blur knob applied
once to the wallpaper layer. Settings saved by an earlier version migrate into
the new keys on load.

The accent picker starts with the nine vibrant thread colours and adds the
classic Monokai vivid green, yellow, orange, pink, purple, and cyan. The runtime
resolves each accent from its actual hue and saturation, moves its lightness
only as far as needed for 4.5:1 contrast on the active palette, and chooses
black or white button text that also clears 4.5:1.

The wallpaper custom controls accept an `https://` URL or an absolute local
path with a **Test** button that reports what the bounded wallpaper route makes
of it.

### Chrome fades, sheets are solid

Menus, dialogs, drawers, toasts, and palettes remain solid frosted sheets so
content cannot show through them. Pane chrome is different: thread and
secondary-panel headers fade downward into the pane, while composer docks,
plugin cards, the context meter, and the scroll control fade upward. Tint and
blur share the chosen fade distance. Prompt boxes outside a thread sit at the
header tint plus 12 percentage points, capped at solid; the thread prompt box
has its own two knobs, glass while the caret is elsewhere and solid by default
once it is focused.

### Dialling in the glass

Balance **Main pane** against **Wallpaper blur**: a lower main-pane value
reveals more wallpaper, while more wallpaper blur keeps text readable over it —
and because that blur is applied once to the wallpaper layer rather than per
pane, raising it costs nothing while you type or scroll. The sidebar has its own
opacity and its own frost. Wallpaper brightness, colour, and wash always affect
the wallpaper layer whatever the panes are set to, so the image can be tuned
first. On phones **Solid panels on phones** takes the main pane, dialogs,
drawers, toasts, and the command palette to 96 %, while the sidebar drawer and
the side panel keep the chosen sidebar opacity and frost.

### Why sheets are frosted, not clear

Sidebar and main-pane glass sit beside each other directly on the wallpaper,
so translucency belongs there. Menus, dialogs, drawers, and the compact home
pane sit over readable application content and use an independent 94 % shell
tint with a fixed 32 px blur. Sticky headers and composer docks instead use the
chrome defaults: 72 % tint and 20 px blur at the outer edge, fading into the
pane over 40 px. **Menus, sheets and cards** can take those sheets fully solid,
and **Solid panels on phones** does the same on small screens; the sidebar keeps
its glass either way.

**Reset to monocode defaults** at the foot of the page restores every value.

The **Theme** row writes bb's own client-side light/dark key
(`localStorage["bb.theme"]`); the marketplace **Theme Toggle** plugin is a good
companion if you want to switch palettes quickly from the sidebar footer.

## `bb liquid-glass`

```
bb liquid-glass show                     # every key and its current value
bb liquid-glass set sidebarOpacity 0.7
bb liquid-glass set paneOpacity 0.72
bb liquid-glass set menuOpacity 0.97
bb liquid-glass set sidebarBlur 32
bb liquid-glass set headerTint 0.6
bb liquid-glass set headerTintDepth 56
bb liquid-glass set headerBlur 24
bb liquid-glass set promptCollapsedOpacity 0.5
bb liquid-glass set promptExpandedOpacity 1
bb liquid-glass set compactSolidPanes off
bb liquid-glass set hue 210
bb liquid-glass set accent violet
bb liquid-glass set wallpaper ocean
bb liquid-glass set wallpaperPath /home/you/Pictures/wall.jpg
bb liquid-glass set wallpaperBrightness 0.9
bb liquid-glass set wallpaperBlur 8
bb liquid-glass set wallpaperSaturation 1.25
bb liquid-glass set wallpaperWash 0.4
bb liquid-glass set accentWash 85
bb liquid-glass presets                  # wallpaper presets and accent swatches
bb liquid-glass reset
```

`show` prints these names. `set` also accepts the internal names they replaced —
`blur`, `chromeOpacity`, `chromeFade`, `chromeBlur`, `overlayOpacity`,
`composerIdleOpacity`, `composerFocusOpacity`, `dim`, `interactiveVibrancy` —
and the two retired knobs `paneBlur` and `paneGlass`, so an older script keeps
working.

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
| `--lg-pane-a` | `0.85` | main-pane opacity |
| `--lg-blur` | `24px` | sidebar backdrop blur |
| `--lg-overlay-a` | `0.94` | menus, sheets, dialogs, drawers, and toasts |
| `--lg-chrome-a` | `0.72` | outer-edge opacity of pane chrome |
| `--lg-chrome-fade` | `40px` | chrome fade distance into pane glass |
| `--lg-chrome-blur` | `20px` | outer-edge backdrop blur of pane chrome and prompt boxes |
| `--lg-composer-idle-a` | `0.6` | thread prompt box while the caret is elsewhere |
| `--lg-composer-focus-a` | `1` | thread prompt box once it is focused |
| `--lg-wp-brightness` | `1` | wallpaper brightness filter |
| `--lg-wp-blur` | `24px` | wallpaper blur filter |
| `--lg-wp-sat` | `1.1` | wallpaper saturation filter |
| `--lg-wallpaper` | the `aurora` preset | the wallpaper image |
| `--lg-wallpaper-custom` | — | the custom `url()` |
| `--lg-dim` | `0.35` dark / `0.1` light | wallpaper dim overlay |
| `--lg-vibrancy` | `70` | accent-wash intensity for interactive controls |

Presets are selected with `html[data-lg-wallpaper="aurora|forest|sunset|ocean|mono|custom"]`
and the phone behaviour with `html[data-lg-compact-solid="on|off"]`.

## Accessibility

`test/theme-contract.test.mjs` computes — it never assumes — every text token's
contrast against the flat canvas and against the sidebar and main pane
composited over the default wallpaper at the default dim, and asserts 4.5:1 on
both. It also checks every shipped accent and custom hue/saturation boundaries
through the runtime resolver against both palettes. A wallpaper you supply
yourself is outside that model: a very bright image
under the dark palette, or a very dark one under the light palette, reduces
contrast. The **Sidebar**, **Main pane**, and **Wallpaper wash** sliders are the
fix.

Two system preferences are honoured without any setting. Under
`prefers-reduced-transparency: reduce` menus, sheets, and both prompt-box states
go fully opaque. On an engine with no `backdrop-filter` there is no blur to
separate a pane from the wallpaper, so the panes stop pretending to be glass.

## Development

```
npm install
npm run typecheck
npm test          # node:test theme contract + vitest (server, appearance, app)
bb plugin build
```

Fonts are deliberately not set here — the Fonts plugin owns typography.

## Credits

The visual direction, the default opacities and blurs, the appearance knob
names and ranges, and the nine vibrant accent swatches follow
[hardbeat920/monocode](https://github.com/hardbeat920/monocode). Packaging
patterns draw from [vburojevic/bb-plugin-ayu](https://github.com/vburojevic/bb-plugin-ayu)
and [divyesh-puri/vercel-theme](https://github.com/divyesh-puri/vercel-theme).
The Monokai vivid accent row reproduces the classic Monokai colours, the work of
Wimer Hazenberg. The server bundles [zod](https://github.com/colinhacks/zod).

Every one of those projects is MIT licensed and their licence texts are
reproduced in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

[MIT](LICENSE) © 2026 Luis Llenin.
