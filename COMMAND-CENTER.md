# Command-center update

- New responsive command-center home screen, illustrated globe, original SVG icons, and four campaign cards.
- Easy / Normal / Hard / Extreme map to the engine's Easy / Medium / Hard / Impossible AI. Selection is remembered and applied when solo setup opens. Advanced setup remains available.
- Five original synthesized WAV cues replace the interface click, hover/slider, match launch, spawn, and conquest sounds. They use the existing mixer, master mute, and category-volume controls. The launch-sound test enables sound explicitly; browsers still require a user gesture for audio.
- Added an in-game Field Guide with icons and descriptions for cities, factories, defense posts, ports, warships, and missile silos. It explains the existing Build menu.
- All new icons are code-native SVGs. New `friends-*.wav` assets are original and follow the resources directory's CC BY-SA 4.0 license. Existing upstream copyright and asset notices remain.
- User-provided RoWorld menu and HUD screenshots guided the navy/gold palette, prominent play button, map backdrop, live world-control panel, and wide bottom battle dock. No Roblox assets were extracted.
- GitHub Pages continues to host solo play. Internet multiplayer still requires a separate server.

- Added a live top-center world-control panel with real territory share, leader, rank, configurable victory target, match timer, and border-protection countdown when active.
- Desktop bottom dock now combines nation identity, troops, attack strength, gold, building icons, hotkeys, and real costs. Quick 10/25/35/50/75% buttons use the existing attack-ratio controller; the slider still works.
- New solo matches offer five minutes of actual engine border protection, enabled by default with a setup checkbox to disable it. Tutorial and saved-game configurations are preserved.

## Verification

Production build and TypeScript passed. 158 tests passed across 11 files covering audio mixing, solo configuration, unit display, and attack-ratio controls. In Chrome: all four preset cards applied the expected engine difficulty; a synthesized launch cue played as non-silent audio in a running AudioContext; mute suppressed selection playback; the 25% button updated the live attack ratio; protection could be disabled in setup and enabled for a match; the victory target displayed 80%; and the bottom dock measured 1,400px wide at a 1,440px viewport. A solo match started and progressed with the Field Guide open. Desktop and 390px mobile layouts were checked with no horizontal overflow. No JavaScript page errors or missing game assets were observed. Physical speaker listening and a full-match victory were not verified.
