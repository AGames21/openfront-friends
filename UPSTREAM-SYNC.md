# Upstream sync - 2026-11-03

Merged 16 upstream main commits through 4ae6e3e.

Player-facing changes: mobile quick-build/tap previews; improved rail previews; new replay viewer default; graphics tuning panel; rendering canvas reuse; nation hydrogen-bomb gold reserves and better warship threat detection; keyboard and nuke-icon fixes. Upstream also adds friend requests, friend grouping for Duos/Trios/Quads, recorded team metadata, store sales, VIVERSE integration and server JWKS authentication updates. Official-service features are imported source, not new Firebase features: the custom arcade still uses its own matchmaking/auth and hides the commercial store.

Resolved four conflicts preserving the custom HUD, build icons, attack presets and sound while retaining incoming input handling. Existing local event-feed CSS remains separate and uncommitted. Production Pages build and full workspace typecheck passed. Extended gameplay testing skipped per user preference.
