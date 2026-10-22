# Signaling server options and WebSocket relay for Sanguis (static GitHub Pages card game)

Date checked: 2026-10-22. All prices USD unless noted.

Method note: this session's network proxy blocked direct fetches of developers.cloudflare.com, supabase.com, firebase.google.com, vercel.com and docs.partykit.io. Pages fetched in full this session: the Cloudflare docs source on GitHub (Durable Objects pricing partial), the Trystero README, the PeerJS server README and the cloudflare/partykit README. Everything else comes from web-search summaries. Where a summary quoted an official page, the official URL is cited and marked "(via search)". Where only third-party sources were available, that is noted. Re-check any "(via search)" figure on the live page before publishing.

## A. Hosted/serverless signaling options: free tiers, pricing, setup, reliability

### Takeaway
Cloudflare Workers + Durable Objects (directly or through the PartyServer library) is the best fit. It has a real free plan with SQLite Durable Objects, native WebSockets, a daily quota far above what signaling needs, and $5/month minimum if you upgrade. Firebase Realtime Database and Supabase Realtime are good no-server-code alternatives, and Trystero can use either of them or public relays with no account at all. Render, Railway, Fly.io and a VPS work but cost money or sleep when idle. Hosted PartyKit appears to be shutting down, and Vercel's WebSocket support is only in beta.

### Cited Findings

**Cloudflare Workers + Durable Objects (DO)**
- Durable Objects run on both Workers Free and Workers Paid. The Free plan can only create SQLite-backed DOs — [Cloudflare DO docs (via search)](https://developers.cloudflare.com/durable-objects/platform/pricing)
- DO free plan: 100,000 requests/day and 13,000 GB-s duration/day. Once a free limit is exceeded, further operations of that type fail with an error. Limits reset at 00:00 UTC — [cloudflare-docs DO pricing source](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/partials/durable-objects/durable-objects-pricing.mdx); reset time and failure behavior from [DO pricing page (via search)](https://developers.cloudflare.com/durable-objects/platform/pricing)
- DO paid plan includes 1M requests/month, then $0.15 per million. It includes 400,000 GB-s/month, then $12.50 per million GB-s. Duration is billed at 128 MB per object whether or not the memory is used. Overage is rounded up to the next billable unit; the docs' example is 500k extra requests billed as 1M, which costs $0.15 — [cloudflare-docs DO pricing source](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/partials/durable-objects/durable-objects-pricing.mdx)
- WebSocket billing:
  - Opening a connection costs 1 request.
  - Incoming messages are billed at 20:1, so 100 messages count as 5 requests.
  - Outgoing messages and protocol pings are free.
  - `setWebSocketAutoResponse()` costs no wall-clock time.
  - Calling `accept()` bills duration for the whole connection. The WebSocket Hibernation API avoids that once handlers return.
  - Idle objects that are eligible for hibernation are not billed for duration.
  - Source: [cloudflare-docs DO pricing source](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/partials/durable-objects/durable-objects-pricing.mdx)
- DO SQLite storage:
  - Free: 5M rows read/day, 100k rows written/day, 5 GB stored.
  - Paid: 25B rows read/month and 50M rows written/month included, then $0.001 per million reads and $1.00 per million writes. 5 GB-month included, then $0.20/GB-month.
  - Source: [cloudflare-docs DO pricing source](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/partials/durable-objects/durable-objects-pricing.mdx)
- Workers Free: 100,000 requests/day and 10 ms CPU per invocation. Workers Paid has a $5/month account minimum that covers Workers, Pages Functions, KV, Hyperdrive and Durable Objects — [Workers pricing (via search)](https://developers.cloudflare.com/workers/platform/pricing/). Third-party sources give Workers Paid as 10M requests and 30M CPU-ms included. Those figures are not confirmed on the official page — [BudgetForge](https://www.budgetforge.dev/tools/cloudflare-workers-pricing-2026)
- Setup: a Cloudflare account. A free `*.workers.dev` subdomain works, so no custom domain is needed (general platform knowledge, not re-verified this session). Deploy with wrangler. Inferred from the DO docs above: the Worker itself must check the `Origin` header on the WebSocket upgrade and add CORS headers to any HTTP endpoints.

**PartyKit / PartyServer**
- PartyServer is "the core library for building real-time applications with Durable Objects". Related packages:
  - PartySocket: a client with "reconnections, buffering, resilience".
  - y-partyserver, partysub, partysync, partywhen, hono-party.
  - Source: [cloudflare/partykit README](https://github.com/cloudflare/partykit)
- Cloudflare acquired PartyKit in April 2024 and said there would be no extra charge beyond standard Workers usage — [PartyKit blog](https://blog.partykit.io/posts/partykit-is-joining-cloudflare/); [webpronews](https://www.webpronews.com/cloudflare-acquires-partykit-the-real-time-multi-user-platform/)
- A search summary of the PartyKit docs says the hosted PartyKit platform, and `npx partykit deploy` to your own account, stop working on 23 October 2026. It also says new projects should use PartyServer and deploy with wrangler — [PartyKit migration guide (via search)](https://docs.partykit.io/guides/migrate-to-partyserver/); [Deploy to own Cloudflare account (via search)](https://docs.partykit.io/guides/deploy-to-cloudflare/). **Unverified:** I could not fetch docs.partykit.io, and the cloudflare/partykit README says nothing about a shutdown. Either way, the practical choice is PartyServer on your own Cloudflare account, priced the same as DO above.

**Firebase (Google)**
- Spark (free) plan:
  - Realtime Database (RTDB): 100 simultaneous connections, 1 GB stored, 10 GB downloaded/month. Blaze raises the connection limit to 200,000 per database — [Magora](https://magora-systems.com/firebase-pricing/); [Back4app](https://blog.back4app.com/firebase-pricing/) (third-party). One outlier lists 100 MB storage — [getpricepulse](https://www.getpricepulse.com/companies/firebase-pricing.html)
  - Firestore: 50,000 reads, 20,000 writes and 20,000 deletes per day, 1 GiB stored, 10 GiB egress/month — [DEV](https://dev.to/androve2k/spark-vs-blaze-the-firebase-pricing-guide-i-wish-id-read-sooner-onb); [BudgetForge](https://www.budgetforge.dev/tools/firebase-pricing-2026)
- Blaze Firestore read price is disputed: $0.03 per 100k ([Magora](https://magora-systems.com/firebase-pricing/)) versus $0.06 per 100k ([BudgetForge](https://www.budgetforge.dev/tools/firebase-pricing-2026); [Back4app](https://blog.back4app.com/firebase-pricing/)). Official page: [firebase.google.com/pricing](https://firebase.google.com/pricing) (not fetchable this session).
- Spark has no overage billing. A product that goes over its quota is shut off rather than billed — [Magora](https://magora-systems.com/firebase-pricing/) (third-party)
- Blaze has no monthly minimum because it is pay-as-you-go; it needs a billing account (inference, not verified this session).
- Setup: a Google account and a Firebase project. Calls go from the browser over the Firebase JS SDK, and access is controlled by security rules rather than CORS (inference). Trystero supports Firebase RTDB as a strategy, using `databaseURL` as the appId, with optional security rules so that "room peer presence is only readable if the room namespace is known ahead of time" — [Trystero README](https://github.com/dmotz/trystero)

**Supabase Realtime**
- Free plan: about 200 peak concurrent connections, 2M Realtime messages/month, 256 KB max message size. One source says connections over the limit are refused and messages over the cap are dropped — [designrevision](https://designrevision.com/blog/supabase-pricing); [nayankyada](https://nayankyada.com/blog/supabase-pricing-2026-free-tier-limits-compute-costs-when-to-upgrade) (third-party; official [pricing](https://supabase.com/pricing) and [Realtime limits](https://supabase.com/docs/guides/realtime/limits) not fetchable)
- Free projects are paused after 1 week of inactivity, and paid plans are not paused — [Supabase pricing (via search)](https://supabase.com/pricing). What counts as "activity" is disputed: one source says database activity, not dashboard visits or cached API calls — [mykavo](https://mykavo.app/blog/supabase-free-tier-limits). A paused project keeps its data but must be restored by hand from the dashboard — [mykavo](https://mykavo.app/blog/supabase-free-tier-limits)
- Trystero supports Supabase, using the project URL as appId plus `supabaseKey` — [Trystero README](https://github.com/dmotz/trystero)

**Ably**
- Free: 6M messages/month, 200 concurrent connections, 200 concurrent channels, 500 msg/s. No credit card and no time limit — [Ably docs, free package (via search)](https://ably.com/docs/platform/pricing/free); [Ably limits](https://ably.com/docs/platform/pricing/limits)
- Standard plan starts at $29/month plus usage — [Ably vs Pusher pricing (Ably-authored)](https://ably.com/compare/ably-vs-pusher/pricing)

**Pusher Channels**
- Sandbox (free): 200k messages/day and 100 concurrent connections — [pusher.com/channels (via search)](https://pusher.com/channels/). Some third parties say 200 connections, which conflicts with the official figure.
- Startup plan: $49/month — [Ably's Pusher comparison (vendor-biased)](https://ably.com/topic/pusher-pricing)
- Ably and Pusher both need an account, an API key and a server-side auth endpoint for private channels. Public channels need no server (inference from general platform knowledge; not verified this session).

**PeerJS**
- The default cloud server (0.peerjs.com) is free, and PeerJS says "for production, you can host your own" — [PeerJS server docs (via search)](https://peerjs.com/peerserver)
- No SLA or quota is published — [GitHub issue p2p-games #5](https://github.com/abdullahnettoor/p2p-games/issues/5)
- Reported problems:
  - Timeouts: [peerjs #851](https://github.com/peers/peerjs/issues/851)
  - Connection delays of 6+ minutes while the status page showed all systems operational: [peerjs #1350](https://github.com/peers/peerjs/issues/1350)
  - Status page: [status.peerjs.com](https://status.peerjs.com/)
- Self-hosted PeerServer:
  - Install with `peerjs --port 9000 --key peerjs --path /myapp`, the Docker image `peerjs/peerjs-server`, or `ExpressPeerServer`.
  - `concurrent_limit` defaults to 5000. `alive_timeout` defaults to 60000 ms. `corsOptions`/`--cors` sets the allowed origins.
  - Set `proxied` behind a reverse proxy, or IP-based limiting fails.
  - "Data is not proxied through the server."
  - Source: [peers/peerjs-server README](https://github.com/peers/peerjs-server)
- PeerServer is a long-running Node process, so it needs Render, Railway, Fly.io or a VPS rather than Workers (inference).

**Trystero**
- Strategies:
  - Nostr (the default)
  - BitTorrent trackers (`@trystero-p2p/torrent`)
  - MQTT
  - IPFS
  - Supabase
  - Firebase
  - A self-hosted WebSocket relay (`ws-relay`), which has "no public default servers"
  - Source: [Trystero README](https://github.com/dmotz/trystero)
- Nostr has "hundreds of active relays". The other decentralized strategies have "far less relay redundancy than Nostr". Suggested robustness order for those: MQTT, then BitTorrent, then IPFS — [Trystero README](https://github.com/dmotz/trystero)
- Trystero bundles default STUN servers but not TURN — [Trystero README](https://github.com/dmotz/trystero)
- Trystero works from a static site with no account for the public strategies (inference from the README).

**Deno Deploy**
- Free: 1M requests/month, 50 ms CPU per request. Free egress and CPU-hour figures conflict: 100 GB and 15 CPU-h at GA ([Deno blog](https://deno.com/blog/deno-deploy-is-ga); [PocketLantern](https://pocketlantern.dev/briefs/deno-deploy-request-egress-cpu-budgeting-2026)) versus 20 GiB egress and cuts to 10 CPU-h ([agentdeals](https://agentdeals.dev/vendor/deno-deploy))
- Pro: $20/month for 5M requests and 200 GB egress. Overage is $2 per million requests and $0.50/GB — [srvrlss](https://www.srvrlss.io/provider/deno-deploy/) (third-party). Official page: [deno.com/deploy/pricing](https://deno.com/deploy/pricing) (not fetched)
- I found no WebSocket-specific metering. Deno Deploy supports `Deno.upgradeWebSocket`, but this was not verified this session.

**Vercel / Netlify**
- Vercel's knowledge base now says Vercel Functions serve WebSockets natively, in public beta on all plans and running on Fluid Compute — [Vercel KB (via search)](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections). Older posts say WebSockets are unsupported — [Vercel community, Nov 2025](https://community.vercel.com/t/does-vercel-support-websockets-now-that-we-have-fluid-compute/27205); [Ably article](https://ably.com/topic/ai-stack/websockets-on-vercel-why-serverless-functions-cant-host-them). I could not confirm the beta's duration limits.
- Netlify Functions don't support persistent WebSocket connections. I found only a secondhand source and no official doc — [glama doc](https://glama.ai/mcp/servers/@aidenlab/hello3dmcp-server/blob/586d351ffb7f1c7a28b9884c2a31088ad5d362fa/docs/setup-guides/hosting-issues.md)

**Render / Railway / Fly.io / VPS**
- Render free web service:
  - Spins down after 15 minutes with no inbound traffic, and WebSocket messages count as traffic.
  - Spin-up takes about 1 minute.
  - Sources: [Render docs: Free](https://render.com/docs/free); [Render changelog](https://render.com/changelog/free-web-services-now-remain-active-while-receiving-websocket-messages)
- Railway Hobby: $5/month including $5 of usage, with the overage billed on top. The Free plan is a trial credit — [Railway docs pricing](https://docs.railway.com/pricing); [plans](https://docs.railway.com/pricing/plans)
- Fly.io:
  - shared-cpu-1x 256 MB costs about $2.19/month ($0.0030/h), billed per second.
  - New organizations get no free tier, only a trial of up to 2 h of Machine runtime or 7 days.
  - Sources: [Fly.io docs pricing](https://docs.fly.io/about/pricing); [fly.io/pricing](https://fly.io/pricing/)
- Hetzner small VPS (CX22/CX23):
  - About €3.80–4.50/month (about $4.50) with 20 TB traffic in the EU.
  - US locations cost about 20% more and include about 1 TB of traffic.
  - Prices rose on 2026-04-01, and naming has shifted from CX22 to CX23. Sources conflict.
  - Sources: [bitdoze](https://www.bitdoze.com/md/hetzner-cloud-cost-optimized-plans.md); [vpsbenchmarks](https://vpsbenchmarks.com/hosters/hetzner/plans/cx22); [agentdeals](https://agentdeals.dev/vendor/hetzner)
- A VPS also needs a domain plus a TLS certificate (Let's Encrypt), because a `wss://` connection from an https GitHub Pages page needs a valid certificate (inference: mixed-content rules). Platform subdomains such as `*.onrender.com`, `*.fly.dev` and `*.up.railway.app` avoid that (inference).

**CORS / Origin**
- Browsers do not apply CORS preflight to WebSocket upgrades. They send an `Origin` header, which the server is expected to check (RFC 6455 §10.2, https://datatracker.ietf.org/doc/html/rfc6455#section-10.2, not fetched this session).
- For Sanguis this means:
  - A custom server (Worker or PeerServer) should allow-list `https://<user>.github.io`.
  - PeerServer exposes `corsOptions` for its HTTP endpoints — [peerjs-server README](https://github.com/peers/peerjs-server).
  - Firebase, Supabase, Ably and Pusher SDKs work from any origin. They are secured by keys and rules rather than origin checks (inference).

### Inferences
- Firebase RTDB Spark's 100-connection cap counts simultaneous connections only. Signaling connections last seconds if the client disconnects after the handshake, so the cap allows many matches per day. The risk is clients that stay connected.
- Supabase's 1-week pause is a real risk for a hobby game with bursty traffic: the first player after a quiet week finds signaling broken until the owner restores the project.
- Pusher's daily cap and Ably's monthly cap both far exceed signaling needs; their constraint is concurrent connections (100 and 200).

### Gaps
- Official Firebase, Supabase, Deno and Vercel pages could not be fetched (DNS/proxy block), so their numbers are secondary or come from search summaries.
- It is unconfirmed whether Ably and Pusher count each delivered copy of a message as a separate message (I believe they do, but did not verify).
- The PartyKit hosted-platform shutdown date (2026-10-23) is unconfirmed.
- Vercel's WebSocket beta limits (duration, pricing) were not found.

## B. Signaling traffic per match and cost at 100 / 1,000 / 10,000 matches per month

### Takeaway
One match's signaling is roughly 2 WebSocket connections and 4–30 small messages totalling about 2–10 KB. At 10,000 matches/month every option with a free tier stays free, including the Cloudflare DO free plan. The real limits are concurrent connections (Firebase Spark 100, Pusher 100, Ably and Supabase 200) and Supabase's inactivity pausing.

### Cited Findings
- The game's current non-trickle offer is about 580 characters in compressed form (from the task brief). WebRTC can send ICE candidates individually (trickle ICE). Trystero defaults trickle ICE to on, except for BitTorrent and IPFS — [Trystero README](https://github.com/dmotz/trystero)
- DO billing: 1 request per WebSocket connection, and incoming messages at 20:1 — [cloudflare-docs DO pricing source](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/partials/durable-objects/durable-objects-pricing.mdx)

### Inferences (my estimates, not sourced)
Assumed messages per match:
- Room join for both players (2)
- 1 offer and 1 answer, each about 0.6–2 KB uncompressed SDP
- With trickle ICE, about 3–10 candidates per side at about 150–300 bytes each
- 1–2 "ready"/leave messages

That gives about 4 messages / 3 KB without trickle and about 25 messages / 10 KB with trickle. Fan-out on a pub/sub service roughly doubles the counted messages.

| Option | Per-match usage | 100/mo | 1,000/mo | 10,000/mo |
|---|---|---|---|---|
| CF DO (free) | 2 connection requests + ≤2 billed message-requests = about 4 requests; duration ≈0 with hibernation | about 400 requests, $0 | 4k, $0 | 40k/month (about 1.3k/day vs the 100k/day limit), $0 |
| CF DO (paid) | same | $5 minimum | $5 | $5 (inside the 1M included) |
| Firebase RTDB Spark | about 10 KB down, 2 short connections | $0 | $0 (about 10 MB) | $0 (about 100 MB vs 10 GB) |
| Firestore Spark | about 5–30 writes and reads | $0 | $0 | about 300k writes/month vs 20k/day (about 600k/month), $0 |
| Supabase free | about 10–50 messages | $0 | $0 | ≤500k vs 2M, $0 (pause risk) |
| Ably free | about 10–50 messages | $0 | $0 | ≤500k vs 6M, $0 |
| Pusher Sandbox | about 10–50 messages | $0 | $0 | about 17k/day peak vs 200k/day, $0 |
| PeerJS cloud / Trystero public | n/a | $0 | $0 | $0 (no SLA) |
| Self-hosted PeerServer | negligible | about $2.19 (Fly) to $4.50 (VPS) | same | same; or Railway at $5 |

- Duration without hibernation: a DO that holds `accept()`-ed sockets for about 30 s uses 0.125 GB × 30 s ≈ 3.75 GB-s per match. That is about 3,500 matches/day before hitting 13,000 GB-s/day, so it is still fine for signaling.

### Gaps
- No measured byte counts for Sanguis's actual SDP and candidates; it would be worth logging them in the real game.

## C. Relaying all game traffic over WebSocket instead of WebRTC P2P

### Takeaway
For a turn-based card game, a server relay on Durable Objects with the Hibernation API is effectively free up to about 10k matches/month on the free plan, or within the $5 Paid minimum. The hibernation choice decides the cost: without it, a 20-minute match uses about 150 GB-s, which caps the free plan at about 86 matches/day. A relay always connects, hides player IPs from each other, and can enforce rules, at the price of an extra network hop (irrelevant for turn-based play) and dependence on one server.

### Cited Findings
- Durable Objects bill incoming messages at 20:1 and outgoing messages for free. Duration is billed at 128 MB per object and is avoided for hibernation-eligible idle objects. `accept()` bills duration for the whole connection time — [cloudflare-docs DO pricing source](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/partials/durable-objects/durable-objects-pricing.mdx)
- P2P without TURN fails for some users: "some networks simply don't allow direct P2P connections" ([Trystero README](https://github.com/dmotz/trystero)). Players behind symmetric NAT, some carriers or VPNs cannot connect without a TURN relay ([p2p-games issue #5](https://github.com/abdullahnettoor/p2p-games/issues/5)).
- A PeerJS signaling server does not carry game data: "Data is not proxied through the server" — [peerjs-server README](https://github.com/peers/peerjs-server). With Trystero, "your app's data never touches the strategy medium" — [Trystero README](https://github.com/dmotz/trystero)
- Render's free tier keeps an instance awake while WebSocket messages arrive, but a cold start takes about 1 minute — [Render docs](https://render.com/docs/free)

### Inferences (my estimates)
- Assume a card match of about 200 incoming messages (100 per player). That is 2 connection requests + 200/20 = 10 message-requests, about 12 requests per match.
  - 10,000 matches is 120k requests/month, about 4k/day against 100k/day free.
  - On Paid it is inside the 1M included.
  - Cost: $0 free, or $5/month Paid.
- With Hibernation the duration is about 0, because only handler execution counts.
- Without Hibernation, a 20-minute match uses 0.125 GB × 1,200 s = 150 GB-s.
  - On the free plan that hits the 13,000 GB-s/day limit at about 86 matches/day (about 2,600/month).
  - On Paid, 10k matches is 1.5M GB-s. After the 400k included, 1.1M is rounded up to 2M × $12.50 = $25, plus the $5 minimum.
- On a VPS or Fly machine it costs a flat $2–5/month for thousands of concurrent matches of small JSON messages. You also maintain TLS, a process manager and updates yourself.
- Latency: a relay adds one client-to-server-to-client leg instead of a direct path, typically tens of ms more depending on where players are relative to the server. Unimportant for turn-based cards, and P2P may route through a TURN server anyway.
- Benefits of a relay:
  - Connects whenever a WebSocket on 443 works, with no NAT or TURN problems.
  - The server can be the authority: hide hidden information such as each player's hand, validate moves, deal from a server-side RNG.
  - Player IPs are not exposed to each other, while WebRTC ICE exposes candidate IPs to the peer.
  - Reconnect and resume are easier, and the server can keep state in DO SQLite.
- Drawbacks of a relay:
  - Ongoing dependency and cost; an outage stops all games.
  - The server sees all game data.
  - Needs code for rooms, auth and abuse limits.
  - Drops the serverless P2P property of the current design.
- Hybrid option: use the DO for signaling plus a fallback relay when ICE fails. This avoids paying for a TURN service.

### Gaps
- No primary source found on DO placement and latency, or on Cloudflare-to-player RTT numbers.
- No cited TURN pricing (out of scope here, but relevant as a comparison).

## D. Trust and reliability of free public infrastructure

### Takeaway
None of the free public infrastructure (PeerJS cloud, WebTorrent trackers, public MQTT test brokers, Nostr relays) has an SLA. Some have documented outages. Operators can see signaling metadata, and with Trystero's default key they can decrypt the SDP unless a password is set. These are acceptable for a hobby game with a fallback (the current copy-paste flow), but not as the only path.

### Cited Findings
- PeerJS cloud: no published SLA or quota ([p2p-games #5](https://github.com/abdullahnettoor/p2p-games/issues/5)). It has had timeouts ([peerjs #851](https://github.com/peers/peerjs/issues/851)) and 6+ minute delays while the status page showed all systems operational ([peerjs #1350](https://github.com/peers/peerjs/issues/1350)). A third party says it has "strict rate limits and no uptime guarantees" but gives no numbers ([VideoSDK](https://www.videosdk.live/developer-hub/media-server/peerjs-webrtc)). The status page showed 200 OK on 2026-10-21 ([status.peerjs.com](https://status.peerjs.com/)).
- Public MQTT brokers:
  - test.mosquitto.org is a community test service with WebSocket ports 8081/8090/8091 — [test.mosquitto.org](https://test.mosquitto.org/)
  - broker.hivemq.com is an open, unauthenticated sandbox — [HiveMQ](https://www.hivemq.com/blog/mqtt-cli/)
  - Guidance says never to use them in production — [cloudstudioiot](https://cloudstudioiot.com/hub/mqtt-broker-iot)
  - A benchmark observed connection failures on the Mosquitto test server — [goughlui](https://goughlui.com/2022/10/23/project-benchmarking-public-free-mqtt-brokers/) (2022, older)
- Trystero encrypts SDP by default with a key derived from the app and room IDs, but "a relay strategy operator can reverse engineer the key". Setting a `password` gives stronger protection — [Trystero README](https://github.com/dmotz/trystero)
- Public strategies other than Nostr have "far less relay redundancy" — [Trystero README](https://github.com/dmotz/trystero)

### Inferences
- Even with encryption, operators and anyone subscribed to the topic can see connection timing, room hashes and client IPs. The SDP itself contains ICE candidate IPs unless it is encrypted with a password.
- Public relays and trackers can disappear or rate-limit without notice. Trystero spreads the risk across several relays, which helps; keeping manual copy-paste as a fallback costs nothing.

### Gaps
- No primary data on Nostr relay rate limits or uptime, or on WebTorrent tracker uptime; that search was not completed.
