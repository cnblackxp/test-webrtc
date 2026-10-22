# Security, abuse and privacy concerns of adding TURN and signaling servers to Sanguis (static-site WebRTC game)

Date checked: 2026-10-22. Method note: the session's egress proxy refused direct page fetches (WebFetch/curl got DNS failure or 403 for ietf.org, cloudflare.com, enablesecurity.com), so findings below come from web-search extracts of the cited pages, not full-text reads. Primary-source URLs are given; anything that matters for a decision (exact TTL limits, endpoint paths, coturn option names) should be re-checked on the live page. Local code facts are from `/home/user/test-webrtc/index.html` (read directly).

Local context (read from repo): the host's invite link is `page#invite=<code>` where the code is the SDP offer (index.html line 11, 571); ICE servers are only `stun:stun.l.google.com:19302` and `stun:stun.cloudflare.com:3478` (index.html line 262); the STUN check in the page explicitly looks for `srflx` (public-address) candidates (index.html ~line 427). So the invite link already contains the host's public IP (srflx candidate) and Google/Cloudflare STUN already see both players' IPs.

## 1. TURN credentials in a static site: why static secrets get abused, and the ephemeral-credential pattern

### Takeaway
Any TURN username/password shipped in client JS is public; the industry-standard fix is short-lived credentials minted by a tiny backend (HMAC "TURN REST API" scheme for coturn, or a provider's credential API for Cloudflare/Twilio/Metered). GitHub Pages cannot hold the minting secret, so a separate endpoint (e.g. a Cloudflare Worker) is required, and it should be gated by Origin/CORS, rate limits, Turnstile and short TTLs, accepting that Origin alone does not stop scripts.

### Cited Findings
- The TURN REST API draft states the core problem directly: TURN credentials are meant to be secret, "but in web applications, ensuring this secrecy is typically impossible"; time-limited credentials are the mitigation so access stays controllable even when users can discover them — [draft-uberti-behave-turn-rest-00](https://datatracker.ietf.org/doc/html/draft-uberti-behave-turn-rest-00)
- The draft's design is stateless: the only interaction between the web service and the TURN server is a shared secret key; the username encodes an expiry timestamp plus an app user ID, the password is an HMAC of that username with the shared secret — [draft-uberti-behave-turn-rest-00](https://datatracker.ietf.org/doc/html/draft-uberti-behave-turn-rest-00); [sibling draft-uberti-rtcweb-turn-rest-00](https://datatracker.ietf.org/doc/html/draft-uberti-rtcweb-turn-rest-00)
- Expired credentials do not kill existing allocations (tied to a 5-tuple), but new allocation requests fail after expiry; the draft also says the credential HTTP endpoint can be ACLed — [draft-uberti-rtcweb-turn-rest-00](https://datatracker.ietf.org/doc/html/draft-uberti-rtcweb-turn-rest-00)
- Status: the draft is an expired individual Internet-Draft (old, ~2013), never an RFC, but remains the de facto scheme implemented by coturn and others — [datatracker](https://datatracker.ietf.org/doc/draft-uberti-behave-turn-rest/00/)
- coturn implements it via `use-auth-secret` + `static-auth-secret`; username format "timestamp:userid", password = base64(HMAC(secret, username)) — [coturn turnserver.conf comments as mirrored](https://gitea.kosmos.org/kosmos/chef/raw/commit/7e55a1f1d1a08957d724db9bc49c52eec2133e6a/site-cookbooks/kosmos-ejabberd/templates/turnserver.conf.erb); [NixOS option docs](https://mynixos.com/nixpkgs/option/services.coturn.use-auth-secret). (Secondary mirrors; official coturn repo not fetched.)
- Common deployments use 24 h TTL (86400 s) for minted credentials — [Continuwuity TURN guide](https://continuwuity.org/calls/turn); a PyPI implementation defaults to one day — [turn-ephemeral-credentials](https://pypi.org/project/turn-ephemeral-credentials)
- Cloudflare Realtime TURN: a long-term "TURN key" is a secret used server-side to generate unlimited short-lived credentials; POST to `https://rtc.live.cloudflare.com/v1/turn/keys/{key_id}/credentials/generate-ice-servers` with Bearer token and a `ttl` (examples use 86400); docs say keep the key on the server, not the browser; issued credentials can be revoked — [Cloudflare docs: generate credentials](https://developers.cloudflare.com/calls/turn/generate-credentials). Some mirrors/code show path `/credentials/generate` (older); a third-party reference claims max TTL 172800 s — unverified — [third-party API ref](https://cdn.jsdelivr.net/npm/memory-journal-mcp@8.0.1/skills/cloudflare/references/turn/api.md)
- Twilio Network Traversal Service: POST creates a Token whose `ice_servers` contain auto-generated username/credential; `ttl` default 86400 s; credentials are "not meant to be stored long term" — [Twilio STUN/TURN API](https://www.twilio.com/docs/stun-turn/api)
- Metered: POST `https://<app>.metered.live/api/v1/turn/credential?secretKey=...` with optional `expiryInSeconds`; if omitted the credential never expires; docs say call it from your backend, never the front end — [Metered create credential](https://www.metered.ca/docs/turn-rest-api/post-create-credential); [Metered expiring credentials guide](https://www.metered.ca/docs/turnserver-guides/expiring-turn-credentials) (guide's example says 7200 s = "1 hour", an internal inconsistency)
- Metered's free "Open Relay" uses a published, shared username/password — [dev.to Open Relay list](https://dev.to/aprogrammer22/list-of-free-stun-and-turn-servers-open-relay-project-3a70); [Metered Open Relay](https://www.metered.ca/tools/openrelay/)
- Abuse motive: TURN servers "are also powerful proxies that hackers have been abusing since at least 2017" — [Enable Security: TURN server security threats](https://www.enablesecurity.com/blog/turn-server-security-threats/); Symantec reported DragonForce ransomware tunneling C2 through Microsoft Teams TURN relays, described as the first public case of threat-actor TURN abuse for C2 — [Enable Security RTCSec newsletter 2026-06](https://www.enablesecurity.com/newsletter/2026-06-rtcsec-news/)
- Limiting the minting endpoint: Cloudflare's Workers rate-limiting binding went GA 2025-09-19; `limit({key})` returns `success`; `period` must be 10 or 60 s; counters are per Cloudflare location (not globally coordinated) — [Cloudflare changelog](https://developers.cloudflare.com/changelog/2025-09-19-ratelimit-workers-ga/); [rate-limit binding docs](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit)
- Turnstile pattern: front end obtains a token, backend calls siteverify before doing work, check `action`; Turnstile should be paired with rate limits, not used alone — [dev.to Turnstile guide](https://dev.to/dineshrajanandan/securing-public-apis-without-login-cloudflare-turnstile-in-a-react-stack-506o); [rhelmer blog](https://www.rhelmer.org/blog/astro-turnstile-cloudflare-workers/) (third-party; official siteverify docs not fetched)
- Origin checks: OWASP WSTG describes Origin validation as the defense against Cross-Site WebSocket Hijacking (a browser-driven attack) — [OWASP WSTG Testing WebSockets](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/11-Client-side_Testing/10-Testing_WebSockets)

### Inferences
- The scrape-and-abuse path for Sanguis would be: attacker views page source, copies TURN creds, uses the relay as a free proxy/bandwidth source; bills accrue to the owner. Short TTL (e.g. 10-60 min for a game session rather than 24 h) shrinks the window; per-credential user IDs let the owner trace and quota abusers.
- Origin/CORS on the minting Worker only stops other websites' JS from using it in browsers; a curl script can set any Origin. So Origin is a nuisance filter; real controls are rate limit per IP, Turnstile, short TTL, TURN-side quotas, and a spend cap/alert.
- Keep the Worker on a separate origin (e.g. `*.workers.dev`), with the TURN key/secret in Worker secrets; GitHub Pages stays pure static.
- Optional: only mint TURN credentials after a direct/STUN attempt fails, so most sessions never get relay creds.

### Gaps
- Could not read the full draft text or official coturn README to confirm exact HMAC (SHA-1) and option semantics; mirrors only.
- Cloudflare's maximum TTL and current canonical endpoint path not confirmed from the live page.
- No primary source found quantifying real-world bandwidth-theft bills from leaked TURN creds (anecdotal only).

## 2. TURN server hardening (self-hosted coturn): CVEs, SSRF-style relaying, amplification, quotas

### Takeaway
A TURN relay is effectively an authenticated proxy; misconfigured, it reaches loopback, private networks and cloud metadata (169.254.169.254), as Enable Security showed against Slack. coturn has had repeated loopback-filter bypass CVEs through 2026; run the latest coturn (>= 4.13/4.14), set explicit `denied-peer-ip` ranges, quotas, the new 401 rate limit, and isolate the host.

### Cited Findings
- Slack (2020): Slack's TURN servers relayed TCP/UDP into Slack's internal network and to the AWS metadata service at 169.254.169.254, yielding temporary IAM credentials; credentials were obtained as a normal user by starting a call; $3,500 HackerOne bounty; fixed before disclosure (older item, 2020) — [Enable Security: Slack TURN compromise](https://www.enablesecurity.com/blog/slack-webrtc-turn-compromise-and-bug-bounty/); [PortSwigger Daily Swig](https://portswigger.net/daily-swig/open-turn-proxy-granted-unauthorized-access-to-slacks-infrastructure)
- Open-relay TURN abuse was first publicly disclosed in a Cisco Meeting Server advisory (2017-09-13) — [Enable Security: TURN threats](https://www.enablesecurity.com/blog/turn-server-security-threats/)
- Enable Security groups TURN risks as relay abuse, denial of service, and software vulnerabilities; advice: isolate, restrict, update — [Enable Security: TURN threats](https://www.enablesecurity.com/blog/turn-server-security-threats/)
- Best practice: deny relaying to internal/special-purpose ranges incl. 169.254.169.254; use narrow allow-lists only if relaying to internal media servers is intended; isolate the TURN server on a dedicated network segment; rate-limit at network level — [Enable Security: TURN security best practices](https://enablesecurity.com/blog/turn-security-best-practices/); [Enable Security: coturn security configuration guide](https://www.enablesecurity.com/blog/coturn-security-configuration-guide/)
- CVE-2020-26262 (fixed coturn 4.5.2, Jan 2021): loopback block bypassed using peer 0.0.0.0, [::1] or [::] (older) — [Enable Security advisory](https://www.enablesecurity.com/blog/cve-2020-26262-bypass-of-coturns-access-control-protection/); [Debian DLA-2522-1](https://www.debian.org/lts/security/dla-2522); [CIRCL CVE entry](https://cve.circl.lu/cve/CVE-2020-26262)
- CVE-2026-27624: IPv4-mapped IPv6 bypass of the loopback check (missing `IN6_IS_ADDR_V4MAPPED`), fixed in 4.9.0 — [releasealert.dev](https://releasealert.dev/cve/CVE-2026-27624) (aggregator; NVD not fetched)
- CVE-2026-53450: `::ffff:127.0.0.1` bypass lets an authenticated TURN client reach localhost-only services on the coturn host; CVSS 3.1 7.4 High per cvefeed; fixed in 4.13.0 — [cvefeed.io](https://cvefeed.io/vuln/detail/CVE-2026-53450); [Alpine tracker](https://security.alpinelinux.org/vuln/CVE-2026-53450) (Alpine lists severity unknown)
- coturn 4.13.1 denies link-local, ULA and site-local relay peers by default and blocks relaying to its own database endpoints (Redis/PostgreSQL) — [Enable Security newsletter 2026-06](https://www.enablesecurity.com/newsletter/2026-06-rtcsec-news/)
- Amplification: an unauthenticated request yields a larger 401 response, so spoofed sources make TURN a UDP reflector; coturn 4.14.0 added opt-in `unauthorized-ratelimit` (disabled by default; default 10/s per source IP) — [Enable Security newsletter 2026-06](https://www.enablesecurity.com/newsletter/2026-06-rtcsec-news/)
- RFC 8656 (TURN) Security Considerations cover DoS against the server, anonymous relaying of malicious traffic, and tunnel amplification — [RFC 8656](https://www.rfc-editor.org/rfc/rfc8656.txt) (only the ToC was retrievable)
- Quotas: Synapse's example coturn config sets `user-quota=12` and `total-quota=1200` relayed streams to limit DoS — [Synapse commit](https://forge.tedomum.net/tedomum/synapse/-/commit/e0ff66251f71cb46aea30a187edc1dc027760b9e)

### Inferences
- For a 2-player JSON-message game, quotas can be tiny (1-2 allocations per user, low `max-bps`), which caps damage if creds leak. Check coturn docs for `max-bps`/`bps-capacity` (not verified here).
- On a VPS, also block 169.254.0.0/16 and the cloud provider's metadata IPv6 address, plus RFC1918, 100.64/10, loopback in IPv4 and IPv4-mapped IPv6 forms, and subscribe to coturn releases / Enable Security's RTCSec newsletter.
- VPS bandwidth billing: set provider bandwidth alerts or choose a plan with a hard transfer cap.

### Gaps
- Did not retrieve official coturn GitHub Security Advisories list or NVD pages directly; versions/CVE IDs above come from aggregators and Enable Security.
- No source checked for a coturn bandwidth-cap directive (`max-bps`) semantics.

## 3. IP address exposure between peers; relay-only policy; mDNS; what the TURN operator sees

### Takeaway
WebRTC exposes candidate IPs to the other peer (and to whoever handles signaling); browsers hide private LAN IPs behind mDNS `.local` names but public (srflx) IPs are still shared. `iceTransportPolicy: 'relay'` hides each peer's IP from the other at the cost of always relaying. The TURN operator sees IPs, ports, timing and volume, but not data-channel content, which is DTLS-encrypted end to end.

### Cited Findings
- RFC 8828 (Jan 2021): ICE gathers candidates via STUN/TURN and the web app sees them, so it can learn more about the local network than an HTTP server would; it sets requirements for IP handling — [RFC 8828](https://www.rfc-editor.org/rfc/rfc8828.html)
- mDNS ICE candidates draft: if an address is not safe to expose, the browser registers a random `<uuid>.local` hostname instead; private IPv4 addresses are especially sensitive; when ICE candidate policy is "relay", mDNS candidates are ignored — [draft-ietf-mmusic-mdns-ice-candidates-02](https://www.ietf.org/archive/id/draft-ietf-mmusic-mdns-ice-candidates-02.html) (draft, 2021)
- Vendor (Metered) statement: the TURN server "cannot decrypt the data that flows through it", payload stays end-to-end encrypted — [Metered: what is TURN](https://www.metered.ca/docs/turn-server-service/what-is-turn/)
- Trystero docs: app data is sent directly peer-to-peer and end-to-end encrypted; encryption does not hide IPs (Nostr discussions note IP transport still occurs without Tor/VPN) — [Trystero README](https://raw.githubusercontent.com/dmotz/trystero/main/README.md); [nostr.at note](https://nostr.at/note1za57rgyzzv334gy8pdlsk3xvte4mhrq3ydqsa8h6ayq84cjdnvhs0gpu23)
- Sanguis today: invite code = SDP offer containing gathered candidates; STUN check looks for `srflx` public candidates — local file `/home/user/test-webrtc/index.html` (lines 11, 262, 427, 571)

### Inferences
- Current invite link therefore carries the host's public IP (and mDNS names); anyone the link is forwarded to, any chat app that logs/previews the URL, sees it. The `#` fragment is not sent to GitHub Pages by browsers (standard URL behaviour), but messaging apps store the full text.
- `iceTransportPolicy: 'relay'` (RTCPeerConnection config) would hide IPs from the opponent; with relay-only, all traffic costs TURN bandwidth — tiny for JSON messages. Could be offered as a "hide my IP" toggle.
- TURN operator (or Cloudflare/Twilio/Metered) sees both players' IPs, allocation times, byte counts; data channels are DTLS so content is protected unless the signaling path was tampered with (see Q4).
- Google and Cloudflare STUN already receive players' IPs today; a privacy notice should mention them.

### Gaps
- Did not retrieve exact RFC 8828 "mode" wording (modes 1-4) or W3C spec text for `iceTransportPolicy`.

## 4. Signaling server risks: room codes, hijacking, peer verification/MITM, rate limits, Origin, DDoS, cost blowups

### Takeaway
The signaling server sits in the trust path: WebRTC's DTLS is only end-to-end if the SDP fingerprints are delivered unmodified, so a malicious or compromised signaling server (or anyone who guesses/joins the room first) can MITM or hijack. Use high-entropy room IDs, one-shot rooms, rate limits, Origin checks (as a filter only), and optionally out-of-band fingerprint verification. On pay-per-use serverless, set spend alerts/caps; Firebase has no hard cap for most services.

### Cited Findings
- RFC 8826: unlike conventional real-time systems, WebRTC communications are directly controlled by a web server, which also serves as the signaling channel; the RFC defines the threat model — [RFC 8826](https://www.rfc-editor.org/rfc/rfc8826.html)
- RFC 8827: trust is rooted in the browser as the user's TCB; signaling protocol is not standardized; it addresses threats analyzed in RFC 8826 (identity/fingerprint sections not retrieved) — [RFC 8827](https://www.rfc-editor.org/rfc/rfc8827.html)
- Trystero's maintainer describes the room-password feature as protecting against a public signaling medium operator (e.g. a torrent tracker) reading offers and answering them itself to join peers; there is "no verified identity" — [Trystero issue #19](https://github.com/dmotz/trystero/issues/19); [Trystero README](https://raw.githubusercontent.com/dmotz/trystero/main/README.md)
- OWASP WSTG: if the WebSocket server does not validate Origin at handshake it accepts any origin (CSWSH); recommended mitigations include per-session random tokens in the handshake — [OWASP WSTG](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/11-Client-side_Testing/10-Testing_WebSockets); [gorbe.io OWASP Go SCP WebSockets](https://gorbe.io/docs/owasp/go-scp/communication-security/websockets)
- Cloudflare Durable Objects billing: duration (wall-clock) is billed while running or idle-but-not-hibernatable; plain `accept()` WebSockets bill duration for the whole connection, Hibernation API avoids it; incoming WS messages billed 20:1 as requests; paid plan includes 1M requests and 400k GB-s/month then $0.15/M requests and $12.50/M GB-s — [Cloudflare DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing)
- Firebase: budget alerts "do not pause services"; they only email; a newer "spend cap budget" exists only for Firebase AI Logic, App Hosting, Cloud Functions for Firebase and Extensions (pauses service for the rest of the month at 100%) — [Firebase budget alerts](https://firebase.google.com/docs/projects/billing/budget-alerts); [Firebase spend caps](https://firebase.google.com/docs/projects/billing/spend-caps?hl=en). Realtime Database/Firestore are not in the spend-cap list per that page.
- Workers rate-limit binding (per-location counters) — [Cloudflare docs](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit)

### Inferences
- Room-code entropy: a short human code (e.g. 4-6 chars) is guessable by a script if rooms live minutes and there is no rate limit. Prefer >= 128-bit random IDs in the link (`crypto.getRandomValues`), and if a short typed code is wanted, combine it with strict per-IP rate limits, short room lifetime, and "room closes after 2 participants".
- Hijack-before-join: attacker who learns/guesses the code joins first and receives the host's offer. Mitigations: one-time rooms, host-side confirmation ("Player X joined — accept?"), and a short verification string both players compare (derived from both DTLS fingerprints in the SDP `a=fingerprint` lines). This is the only defense against a malicious signaling server swapping SDPs (MITM) — reasoning from RFC 8826/8827 model; no specific source fetched for the SAS approach.
- Keeping today's copy-paste flow as a fallback keeps a no-server path; the current manual flow has no third-party signaling server in the trust path at all.
- DDoS/cost: a Worker+DO signaling server should use the Hibernation API, cap message size and per-room messages, and close rooms after connection; Cloudflare Workers paid plan bills usage, so set notifications. Firebase: add programmatic billing-disable via Pub/Sub budget notifications if using Blaze.

### Gaps
- No primary source fetched on Cloudflare billing notifications / hard caps for Workers.
- RFC 8826/8827 section text on fingerprint substitution and identity providers not retrieved (only abstracts).

## 5. Firebase / Supabase security rules for signaling

### Takeaway
Both are "public client key + server-side rules" systems: the API key/anon key in the static site is not a secret, so rules (Firebase Security Rules, Supabase RLS on `realtime.messages`) are the only access boundary. Test-mode/`true` rules and Supabase public channels let anyone read/overwrite signaling data.

### Cited Findings
- Firebase test mode "allows anyone to read and overwrite your data"; if unchanged, the time-limited test rules expire (commonly 30 days) and then deny all requests — [Firebase RTDB web start](https://firebase.google.cn/docs/database/web/start?hl=fi); [RapidDev guide](https://rapidevelopers.com/firebase-tutorial/how-to-secure-realtime-database-with-rules) (third-party)
- Developers commonly replace the expiring rule with `".read": true, ".write": true`, making the DB permanently open — [Kodular forum](https://community.kodular.io/t/use-firebase-databse-without-test-rules/103156); scanner vendor warns many AI-generated apps ship with test-mode rules — [vibeappscanner](https://vibeappscanner.com/firebase-security-rules) (vendor)
- Supabase Realtime: Broadcast/Presence authorization is enforced by RLS policies on `realtime.messages`; private channels need "Allow public access" disabled and clients join with `private: true`; without authorization, any client can subscribe to any public channel to send and receive messages; checks happen at connect time — [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization); [Supabase blog](https://supabase.com/blog/supabase-realtime-broadcast-and-presence-authorization)
- Supabase's getting-started examples use permissive `USING (true)` policies for authenticated users — [Supabase Realtime getting started](https://supabase.com/docs/guides/realtime/getting_started.md)

### Inferences
- For signaling, rules should: require (anonymous) auth, allow writes only to `rooms/{roomId}` with schema/size validation, allow read only to the two participant UIDs, make offer/answer write-once, and delete rooms on connect or by TTL. Room IDs must be unguessable since anyone authenticated anonymously can try.
- Trystero's Firebase/Supabase strategies inherit these risks if the owner's own project is configured loosely.

### Gaps
- Did not fetch Firebase's official "insecure rules" docs or App Check docs (App Check could add attestation for a web app via reCAPTCHA).

## 6. Privacy / GDPR

### Takeaway
IP addresses are generally personal data under GDPR (Recital 30, Art. 4(1); CJEU Breyer for dynamic IPs). Adding a TURN/signaling provider means processing players' IPs, so the owner (likely the controller) needs a privacy notice, a lawful basis (legitimate interest / contract-like necessity to connect), processor terms (DPA) with Cloudflare/Twilio/Metered/Firebase/Supabase, minimal logging and a retention period. The current invite link already shares the host's IP with whoever gets the link.

### Cited Findings
- GDPR Art. 4(1) lists "an online identifier" as making a person identifiable; Recital 30 names IP addresses and cookie identifiers and notes they can be combined to profile/identify people — [activeMind Recital 30](https://activemind.legal/legislation/gdpr/recital-30); [CookieYes summary](https://www.cookieyes.com/blog/ip-address-personal-data-gdpr/)
- Recital 26: identifiability judged by means reasonably likely to be used, considering cost, time, technology — [CookieYes summary](https://www.cookieyes.com/blog/ip-address-personal-data-gdpr/) (secondary)
- CJEU Breyer (C-582/14, 19 Oct 2016): a dynamic IP address stored by a website operator is personal data for that operator if it has legal means, with reasonable effort and third-party (ISP) help, to identify the user; ensuring website functionality can be a legitimate interest but must be balanced case by case (decided under Directive 95/46/EC — older, but still cited as leading authority) — [Bird & Bird](https://twobirds.com/en/insights/2016/global/cjeu-decision-on-dynamic-ip-addresses-touches-fundamental-dp-law-questions); [arXiv analysis of Breyer](https://arxiv.org/pdf/2511.01751); [Thomas Helbing](https://www.thomashelbing.com/en/wissen/dsgvo-hub/rechtsprechung/1.4.37-eugh-breyer)

### Inferences
- Even today (pure static), Google and Cloudflare STUN servers and GitHub Pages receive IPs; a short privacy notice is advisable now and essential once own servers log anything.
- Self-hosted coturn logs client and peer IPs by default in many configs; set log verbosity low / disable or rotate logs quickly (e.g. <= 7 days) and document it. Workers/DO: avoid storing IPs; if rate-limiting by IP, keep only ephemeral counters.
- The game owner is the controller; hosted providers act as processors — check each provider's DPA (not verified here).
- Telling players "your friend will see your IP address" before sending an invite, and offering relay-only mode, are low-cost privacy wins.

### Gaps
- Did not fetch provider DPAs or logging-retention statements (Cloudflare Realtime, Twilio, Metered, Firebase, Supabase).
- Did not find guidance specific to hobby/non-commercial games (household exemption does not apply to a public website — not sourced here).

## 7. Trust in free public relays and signaling media

### Takeaway
Free relays (Metered Open Relay, PeerJS cloud, Trystero's public Nostr/MQTT/BitTorrent relays) cost nothing but are operated by third parties with no SLA, see players' IPs, and (for signaling) can read or answer offers unless offers are encrypted with a shared secret. Fine for prototyping; for production, prefer own-controlled credentials or a paid provider.

### Cited Findings
- Open Relay: free TURN from Metered, advertised with 20 GB/month free; published shared credentials; it funnels to Metered's paid service — [Metered Open Relay](https://www.metered.ca/tools/openrelay/); [dev.to](https://dev.to/aprogrammer22/list-of-free-stun-and-turn-servers-open-relay-project-3a70)
- Trystero supports WebSocket, Firebase, Supabase, Nostr (default; hundreds of public relays), MQTT, BitTorrent, IPFS strategies; self-hosted relays possible; app data never touches the strategy medium after discovery — [Trystero README (unpkg 0.25.2)](https://app.unpkg.com/trystero@0.25.2/files/README.md)
- Trystero's optional password encrypts offers so a public medium operator cannot answer them itself; the password must be shared out-of-band (e.g. URL); users remain anonymous with no verified identity — [Trystero issue #19](https://github.com/dmotz/trystero/issues/19)

### Inferences
- If Sanguis used Trystero with a public strategy, put a random secret in the `#` fragment of the invite as the room password, so public relays only see ciphertext and timing/IPs.
- PeerJS cloud: no source retrieved on its logging, limits or SLA — treat as untrusted, best-effort.

### Gaps
- No independent audits/privacy policies found for Open Relay or PeerJS cloud server (0.peerjs.com).

## 8. Cheating / trust (P2P authority)

### Takeaway
With pure P2P, one client (the host) is authoritative and can cheat; a signaling or TURN server does not change that because it only relays.

### Cited Findings
- The repo's own note says the planned game logic `js/net/host-core.js` will run over the data channel, i.e. host-authoritative — local file `/home/user/test-webrtc/index.html` line 17
- TURN relays opaque encrypted payloads it cannot decrypt — [Metered: what is TURN](https://www.metered.ca/docs/turn-server-service/what-is-turn/)

### Inferences
- Options: accept trust between friends; commit-reveal for hidden information/randomness (both peers contribute random seeds via hash commitments); deterministic lockstep with both clients validating moves; or server arbitration (moves game logic to a server, losing the static-only property).

### Gaps
- No sources fetched on P2P anti-cheat techniques (commit-reveal etc.); these are general practice, unsourced here.
