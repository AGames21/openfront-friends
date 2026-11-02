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
