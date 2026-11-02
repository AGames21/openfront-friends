# Play OpenFront Friends

Play at https://agames21.github.io/openfront-friends/ .

## Online matchmaking

1. Click **Multiplayer**.
2. Sign in with Google, or create/sign in to an email and password account.
3. Click **Find multiplayer match**. Keep the tab open.
4. If another commander joins within 20 seconds, both players share the same world with AI nations. If nobody joins, the game clearly switches to **Normal AI**.

Online games currently support two humans plus AI, on the compact World map, with Normal difficulty and five-minute border protection. Queue cancellation is available. Your account stays signed in across reloads; use Sign out on a shared device. Password recovery is available in the account panel.

Matches are casual and peer-hosted: the first player's browser orders turns and both browsers simulate them. Both peers must remain connected. A disconnected or out-of-sync match shows an explanation; return to the menu and search again. Rejoining a departed match, large public lobbies, ranked play, and dedicated-server anti-cheat are not implemented.

## Hosting and maintenance

GitHub Pages hosts the game. Firebase project `ag-arcade-frontier` uses the free Spark plan for Authentication and Realtime Database; no billing account was linked. Provider settings and authorized domains are configured for AGames21.github.io. `src/client/FriendsFirebase.ts` contains only the public Firebase web configuration. OAuth authorization codes, refresh tokens, Google client secrets, and service-account credentials must never be committed.

Database rules in `database.rules.json` require authentication, restrict room data to its members, reserve host turn writes for the host, and restrict inputs/acknowledgements to their owner. They are deployed with `firebase deploy --only database --project ag-arcade-frontier`. Quota exhaustion stops online service; solo remains available. No automatic paid upgrade is configured. Abandoned host sessions can leave room history behind; periodically remove old closed rooms in the Firebase console. Turn writes expire after two hours.

## Optional LAN server

For the original full Node server and larger private lobbies, run `npm run friends` locally and share its LAN address with friends on the same network. The GitHub Pages multiplayer button uses Firebase matchmaking instead of this server.
