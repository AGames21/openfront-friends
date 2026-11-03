# Verification — November 1, 2026

Upstream base: `103bba550d3a39ceb623179a04687719cf8a051b`.

- Production build and TypeScript check passed.
- 96 focused tests passed across 8 files: lobby sockets, host lobby, server joins/rejoins/phases/desync, share links, and Keyboard API compatibility.
- Actual Chrome, two isolated browser contexts: host created one private lobby; guest joined the same ID; both rosters showed 2 players. Host started the match; both clients reached the world map and spawn countdown. Received 104 and 113 WebSocket frames respectively, with zero JavaScript page errors.
- Home and lobby presentation visually inspected at 1440x1000. Live game screenshot captured at 1400x1000.
- This verifies local two-player lobby admission and game startup. Full-match victory, reconnect during a live browser match, separate physical devices, mobile gameplay, Internet hosting, and public-service authentication were not tested.
- Fixed an upstream browser compatibility issue: some Chrome versions expose `navigator.keyboard` without event-listener methods. Layout-change subscription now uses an optional method, with a regression test.
- Installation reported 22 dependency advisories (11 moderate, 7 high, 4 critical). Dependencies are the unmodified upstream lockfile. No speculative automatic dependency upgrades were made.
- Upstream CSS/chunk-size build warnings remain. Optional account/news widgets request an unavailable local API on port 8787; private game hosting does not require that service.


## GitHub Pages ? November 2, 2026

- Added a dedicated Pages build with rendered bootstrap configuration, repository-relative bundle paths, and correctly prefixed map/audio/worker assets.
- Pages edition offers browser solo play; the Node multiplayer launcher is retained separately. The hosted UI states that multiplayer requires a separate server.
- Workflow `.github/workflows/pages.yml` publishes `static/` on main pushes.


## 2026-11-02: accounts, matchmaking, and gentler Normal

The new Pages multiplayer flow uses Firebase Authentication (email/password and Google) and Realtime Database on Spark. See PLAY-WITH-FRIENDS.md for current behavior and limits; it supersedes earlier static-only multiplayer notes. Normal nation army capacity is now 65% of the base (previously 75%), growth multiplier 0.92 (previously 0.95), and attack reactions 62-80 ticks (previously 55-70). Human stats and other difficulty levels are unchanged.

Validation: full TypeScript workspace checks and Pages build passed; 77 relevant unit tests passed. The browser Normal playthrough verified all difficulty selections, audio playback/muting, protected start, world-control progress, bottom HUD, attack ratio, field guide, and mobile overflow. Two real Firebase test accounts joined from isolated browsers, both sent actions, and game hashes matched at turns 0 and 100. Simultaneous queue entry, cancellation, and a 20-second fallback to a real Singleplayer/Medium game passed. Rules rejected anonymous room reads and guest writes to host turns. Temporary accounts and test rooms were removed. Google provider verification and live deployment results are recorded below when complete.

Google provider is enabled with a generated web OAuth client. A browser test opened the real Google sign-in page; completing a personal Google account sign-in was not automated. Live email account creation, sign-in, session persistence, simultaneous pairing, matching state hashes, cancellation and Normal AI fallback all passed. The relay allows a maximum three-turn pipeline to absorb network latency while preserving turn order.


## 2026-11-03: arcade edition, surviving worlds, and local saves

Hidden upstream purchase/store/inventory/online leaderboard/clan navigation in the Pages edition and added a same-tab AG Arcade return link. All nation AI levels and tribes were eased; see PLAY-WITH-FRIENDS.md for numbers. Multiplayer queue version changed to prevent pairing old clients with new continuation behavior. When the opponent leaves, the survivor detaches from the room and continues its ordered simulation locally with the departed player marked disconnected. Neither player deletes the survivor world.

Regression tests cover host and guest continuation for 61 seconds, beyond the former 45-second timeout. Real Firebase two-browser verification matched hashes at 0/100/200/300, played past spawning, closed the host, and confirmed guest ticks advancing from 340 to 376 without a kick. IndexedDB stored a real 478679-byte worker snapshot; a reload and Continue saved world restored tick 392. Temporary test accounts/rooms were removed. Worlds autosave every ten seconds per browser account/guest; this is local-device persistence, not cross-device cloud sync. Full-match victory remains untested.

Browser checks verified same-tab launch and return, hidden upstream menu items, removed NFL chart, and real native Retro Bowl savedata.ini persistence across refresh. The classic browser game is accurately labeled a 2026 schedule fan season; the official NFL Retro Bowl 27 app and licensed real-player/coach roster are not included.


## 2026-11-03 hover card overlap

Lowered the world-control HUD below hovered-player cards and offset the cards below the bar on desktop/mobile. Production build passed. Browser layout checks populated the real player-info component and verified its card clears the world bar: desktop bar bottom 78.5px/card top 100px; mobile bar bottom 101px/card top 110px. Screenshots: outputs/hover-layout-1440.png and hover-layout-390.png in the task workspace. These check seeded hover-card layout, not every possible unit/building tooltip. Existing unrelated event-feed wrapping changes remain uncommitted.
