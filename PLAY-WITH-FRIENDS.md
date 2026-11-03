# Play OpenFront Friends

Play at https://agames21.github.io/openfront-friends/ .

## Online matchmaking

1. Click **Multiplayer**.
2. Sign in with Google, or create/sign in to an email and password account.
3. Click **Find multiplayer match**. Keep the tab open.
4. If another commander joins within 20 seconds, both players share the same world with AI nations. If nobody joins, the game clearly switches to **Normal AI**.

Online games currently support two humans plus AI, on the compact World map, with Normal difficulty and five-minute border protection. Queue cancellation is available. Your account stays signed in across reloads; use Sign out on a shared device. Password recovery is available in the account panel.

Matches are casual and peer-hosted: the first player's browser orders turns and both browsers simulate them. If either player leaves, the remaining player continues the same world locally. The departing nation is marked disconnected; there is no kick or match reset. A network outage also switches the survivor to local play after a grace period. A desync still shows an error rather than silently merging different worlds. Rejoining a departed match, large public lobbies, ranked play, and dedicated-server anti-cheat are not implemented.

## Hosting and maintenance

GitHub Pages hosts the game. Firebase project `ag-arcade-frontier` uses the free Spark plan for Authentication and Realtime Database; no billing account was linked. Provider settings and authorized domains are configured for AGames21.github.io. `src/client/FriendsFirebase.ts` contains only the public Firebase web configuration. OAuth authorization codes, refresh tokens, Google client secrets, and service-account credentials must never be committed.

Database rules in `database.rules.json` require authentication, restrict room data to its members, reserve host turn writes for the host, and restrict inputs/acknowledgements to their owner. They are deployed with `firebase deploy --only database --project ag-arcade-frontier`. Quota exhaustion stops online service; solo remains available. No automatic paid upgrade is configured. Abandoned host sessions can leave room history behind; periodically remove old closed rooms in the Firebase console. Turn writes expire after two hours.

## Optional LAN server

For the original full Node server and larger private lobbies, run `npm run friends` locally and share its LAN address with friends on the same network. The GitHub Pages multiplayer button uses Firebase matchmaking instead of this server.


## Saved worlds and the AG Arcade edition

Games open in the same tab. The top-left AG Arcade button saves the current world before returning to the library. The upstream store, inventory, clan, online leaderboard, and Steam purchase menus are hidden in this edition; source credits remain.

Worlds autosave every ten seconds in IndexedDB, separately for a signed-in account or guest on this browser. Continue saved world restores the last complete snapshot. An online world resumes as a local continuation, not a rejoin to an old room. Keep browser site data; private browsing, clearing storage, a different browser/device, or an incompatible future save format can prevent continuation. This is local-device saving, not cloud synchronization. Retro Bowl uses its existing browser career saves; the arcade wrapper preserves their origin and storage.

All AI levels were eased: nation capacity multipliers Easy/Normal/Hard/Extreme are 0.30/0.45/0.65/0.85; growth multipliers are 0.65/0.75/0.85/0.95; attack intervals are 100-145/85-120/70-100/55-85 ticks. Human stats remain unchanged. Tribes use one-quarter base capacity and a 0.35 growth multiplier.
