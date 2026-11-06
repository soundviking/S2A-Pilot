# Copilot relay beta — public trial flow

The complete beta installer adds copilot/ beside the PWA. Build with tools/package-beta.py then tools/package-copilot-relay.py. The combined ZIP includes the simple notice; no user key/account/device activation is required. The generated config.php holds only a server secret; the internal packaging entropy file remains ignored under downloads/beta and is never shipped as a raw key.

POST JSON, HTTPS, same-origin browser calls (no CORS). Loopback development requires explicit S2A_COPILOT_LOCAL=1 and a private S2A_COPILOT_STORAGE directory. Host startup is independent of the transport and waits for the workspace to load before restoring a saved share.

create is anonymous and rate-limited: 30 per hour/IP (HMAC address+hour with server secret, no raw IP stored), 100 active sessions globally. Management requires the returned host token; join requires the invitation; read requires a unique viewer token. No remote GO, playback/edit endpoint or media upload. Revoke blocks an individual token, clears their name and closes admission. Stop clears snapshot/names and invalidates all access. Input/MIME/length/count bounds, prepared SQL, serialized joins/revokes, private SQLite, no-store responses and no internal error/path exposure.

TTL is exactly 14 days, not extended by polling. Expired records are purged on later traffic. Host tokens, invitations, links and expiry are retained in that browser localStorage under a project identity; only the project identity is exported in the project ZIP, not host credentials. Reload restores management; switching projects parks old sharing with show:false and can restore it later. A different browser creates its own independent share without activation. Clearing browser data loses the local management mapping. Opening QR after expiry creates a new session; an expired active session renews automatically while its panel is open. Never promise a cross-device retained link without transferring management credentials: that is not implemented.

Viewers receive the Show model only, with current/next/waiting thumbnails and locally interpolated countdowns. stale after 5 seconds: hide Show and stop countdowns. Edit/parked state is an explicit waiting screen. 300 Cues, 50 non-revoked registrations; about half-second polling with snapshot-age and RTT compensation. Physical iOS/Android, o2switch HTTPS, background behavior and mobile data remain deployment validation steps.

Go wait markers are passive state in Copilot; only the host can resume. Module UI is French in these first tests; existing Pilot language support is unchanged.

Local test root: /tmp/s2a-copilot-runtime/public_html/S2A-Pilot-Beta; PHP port 8933, private SQLite in /tmp/s2a-copilot-runtime/private. This isolated local fixture may use the older host_key_hash config as entropy for migration testing. Never run mutation/expiry tests against production.

Tests: tools/test-copilot-relay.py, tools/test-copilot-integration.cjs, tools/test-copilot-lifecycle.cjs. Full beta notes: docs/beta-1.6.3.md.

Next Cue alerts pulse red during the last ten seconds, with reduced-motion support. Hidden-page host transport uses audio events and a fallback timer instead of depending solely on RAF. Browser/OS suspension is still an external limitation, particularly on mobile.
