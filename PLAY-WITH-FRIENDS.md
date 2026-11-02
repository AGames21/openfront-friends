# OpenFront Friends

A self-hosted OpenFront fork with a private multiplayer entry screen and a LAN launcher. The complete upstream territory simulation, maps, buildings, alliances, bots, audio, controls, and multiplayer protocol are retained. This is an independent fork, not an official OpenFront service.

## Start on Windows, macOS, or Linux

Install Node.js 24.15+ (Node 24) and npm 12.1+ (npm 12), then run:

```sh
npm ci --ignore-scripts
npm run friends
```

If your Node installation bundles npm 11, use a local npm 12 without changing the global installation:

```sh
npx --yes --ignore-scripts npm@12.1.0 ci --ignore-scripts
npm run friends
```

Open http://localhost:9000. Choose a name, click **Host a match**, choose the map and rules, and copy the lobby link. Friends open the same link using the LAN address printed by the launcher instead of `localhost`. Start after everyone appears in the roster. Each player needs a separate browser profile/device; two tabs in one profile share the same player identity.

Allow Node through Windows Firewall on your **private network** if Windows asks. The host PC must stay running. This development launcher is for trusted LAN/private-VPN play; it uses upstream development guest identities and is not hardened for public Internet exposure. Do not forward its ports to the Internet.

## What works independently

Private lobbies, bots, solo play, and the game simulation run locally. OpenFront's account login, paid cosmetics, ranked matchmaking, and cloud statistics require upstream services and are not provided by this fork. Some optional upstream widgets may log unavailable API requests to localhost:8787; these are separate from the local game server.

GitHub stores the source; GitHub Pages cannot host this Node/WebSocket multiplayer server. Internet hosting needs a server, HTTPS/WebSockets, and an independently configured identity service. No public game host is provisioned by this setup.

## Credits and source

Based on https://github.com/openfrontio/OpenFrontIO. © OpenFront and Contributors. Code remains AGPL-3.0; resources remain under their supplied asset licenses. The complete upstream package and notices are preserved, including the separate terms in `proprietary/LICENSE`. No external premium assets were downloaded. See `LICENSE`, `LICENSE-ASSETS`, and `LICENSING.md`.

This fork adds `FriendsWelcome.ts`, the `friends` launcher, and this guide. `README.md` retains upstream development documentation.

## Hosted browser edition

Play solo at https://agames21.github.io/openfront-friends/. GitHub Pages serves the client, maps, audio, and browser simulation. It cannot run the multiplayer Node/WebSocket server. Use the LAN launcher above for multiplayer. The Pages build hides unavailable multiplayer entry points.

`npm run build:pages` creates the Pages artifact, and `.github/workflows/pages.yml` publishes main automatically.
