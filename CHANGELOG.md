# Changelog

## 0.5.20 — 2026-09-03

### Settings

- **The settings page is regrouped** into Theme, Transparency, Blur, Wallpaper,
  Phones, and Composer, each named for what it changes. The Advanced drawer is
  folded into the two colour pickers it belonged to.
- **Two knobs retired.** Pane blur and wallpaper blur were always summed into
  one filter, so they are now one **Wallpaper blur**, applied once to the
  wallpaper layer. Main pane glass off was a main pane pinned at 96 %, so it is
  now just **Main pane** opacity. Settings saved by an earlier version migrate
  into the new keys on load, before validation, so no stored value can fall back
  to a default.
- **Renamed for what they do**: `sidebarBlur`, `headerTint`, `headerTintDepth`,
  `headerBlur`, `menuOpacity`, `promptCollapsedOpacity`,
  `promptExpandedOpacity`, `wallpaperWash`, `accentWash`. `bb liquid-glass show`
  prints the new names and `set` accepts the old ones — and the two retired
  knobs — forever.
- **Ranges corrected**: sidebar blur reaches 0, menu opacity goes down to 50 %.
  Hue is disabled while colour strength is 0 and Tint depth while the tint is 0,
  because neither did anything there. Accent brightness shows the palette's
  readable band instead of a slider half of which was inert.
- **Five misleading labels fixed**: the sidebar blur never touched cards or
  popovers, chrome opacity was a tint, the composer knobs key on expanded rather
  than on the caret, and solid-panels-on-phones does not touch the sidebar's
  glass.

### Composer

- **Prompt box opacity, collapsed and expanded**, as two separate knobs. The
  thread prompt box is glass while the caret is elsewhere and solid by default
  once it is focused.
- **Status cards above the prompt** can be cards, a see-through deck, or one
  line of live pills, with Auto choosing pills on phones and cards on desktop,
  plus a fold toggle in the prompt action row. The context meter can be a slim
  marker under the prompt or a card in the stack. Both are saved per device.

### Phones

- The closed mobile sidebar no longer ghosts through the pane, the side panel
  clears the status bar and takes the sidebar's glass, the new-thread dock runs
  through the safe-area strip, and the new-thread text field is tinted enough
  that the Recent list does not print through it.

### Performance

- **No blur layer for menus.** The no-blur override for menus, selects,
  tooltips and popovers never won against the sheet rules, so every one of them
  was allocating a 32 px backdrop-blur layer on open.
- **Pane blur costs nothing.** A backdrop-filter on a full-height pane
  re-rasterises it every frame its content changes; the only thing behind the
  main pane is the static wallpaper, so the blur is applied there once instead.
  The theme contract test forbids it coming back as a backdrop-filter.
- **One document observer** feeds both content scripts, with per-watcher record
  filters; thread and composer lookups are cached against a tree stamp instead
  of queried per scroll frame; no identical attribute or style write is made.
- **The wallpaper route** caches file bytes in memory keyed by path, mtime and
  size, and answers `If-None-Match` with 304. The custom wallpaper is cached in
  the browser.
- Dropped `:has()` dock selectors, byte-identical restatements of the pane
  variables, and rules superseded by later ones. Both palettes verified
  structurally identical.

### Packaging

- `THIRD_PARTY_NOTICES.md` added, reproducing the MIT licences of monocode, ayu,
  vercel-theme, and zod, and noting the Monokai accent row.
- The README's settings, CLI, and CSS-variable documentation now matches the
  shipped build.
- This changelog.

## 0.5.4 – 0.5.19 — 2026-09-03

Sixteen same-day releases chasing the shell's chrome to a clear, readable
finish: the follow-up and new-thread composers, the sticky thread footer dock,
nested running-thread chrome, and side-chat footer chrome all stopped painting
opaque bands over the glass; the chrome tint fades to transparent and its dial
reaches 0; tooltip contrast on frosted popups was fixed; and the closed mobile
sidebar stopped showing through the pane. Commit-level history is in the git
tags.
