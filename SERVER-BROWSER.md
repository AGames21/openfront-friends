# Server browser

Multiplayer lists public two-player rooms and offers named public or private hosting. Private rooms are unlisted; share the exact case-sensitive room code with a signed-in friend. They are not password protected. Both people must save a display name. The second player joins atomically; the match starts immediately with both players and Normal AI. Full rooms leave the list. Host cancellation/disconnection removes the waiting room. Hosted rooms expire after five minutes and continue against Normal AI; Quick Play retains its 20-second fallback. The existing relay handles player departure during play.

Rules restrict listing writes to the room host and reject publication of private rooms. Names are rendered as text. The server list is scoped to the existing protocol version. Display/profile keys and saves are preserved. Capacity remains two humans; this is peer-hosted, not a dedicated server process.

Main menu uses the existing real map screenshot with simplified navigation and difficulty choices. Source and credits retained.

Validation: production Pages build and full workspace typecheck passed. Live Firebase checks passed host-only listing writes, private-listing rejection, signed-out read rejection, named-room joins after 30 seconds, occupied-slot rejection, removal and host start. Actual browser UI passed sign-in, saving a display name, public hosting/list appearance, private hosting/exclusion, and cancelling both rooms without page errors. Temporary test accounts, profiles and rooms removed. Full two-player gameplay and five-minute timeout were not rerun; the existing relay and timeout design are retained.
