# TURN relay options and costs for Sanguis (P2P WebRTC data-channel card game on GitHub Pages)

Checked: 2026-10-22. **Method caveat:** direct page fetches (WebFetch/curl) were blocked by this session's egress proxy (403 / DNS failure for developers.cloudflare.com, twilio.com, metered.ca). All figures below come from web-search result extracts of the cited pages, not from reading the full live page. The URLs are the pages the figures were taken from; re-check the official pages before committing money. EUR is converted at an assumed 1 EUR = 1.17 USD (approximate October 2026 rate, not verified this session; Hetzner's own docs use about 1.20).

## Managed TURN services: free tier, price per GB, minimums, regions, credential model

### Takeaway
For a low-traffic data-channel game, **Cloudflare Realtime TURN** (1,000 GB/month free, then $0.05/GB, anycast) and **ExpressTURN** (vendor says 1 TB/month free) cost effectively $0. **Metered's Open Relay** (20 GB/month free) also covers it. Metered's and Xirsys's free tiers are only 500 MB, and Twilio has no free tier ($0.40/GB and up). Every provider that issues short-lived credentials does it through an API call that needs a secret key, and that key must stay off the static site. So a GitHub Pages-only deployment needs a small serverless function, such as a Cloudflare Worker, to hand out credentials. The other option is embedding long-lived static credentials, which anyone can then reuse.

### Cited Findings
**Cloudflare Realtime TURN (formerly Calls TURN)**
- Price: $0.05 per GB of egress, and the first 1,000 GB each month is free. — [Cloudflare Realtime pricing](https://developers.cloudflare.com/realtime/pricing/); [SFU pricing](https://developers.cloudflare.com/realtime/sfu/platform/pricing/)
- The 1,000 GB free allowance is **shared** between SFU and TURN. They are not two separate free tiers. — [Cloudflare Realtime pricing](https://developers.cloudflare.com/realtime/pricing/)
- Billing counts data flowing from the Cloudflare edge to the TURN client, measured per RFC 8656, **including TURN overhead**. Client-to-server traffic is free ingress. — [Cloudflare TURN FAQ](https://developers.cloudflare.com/realtime/turn/faq/)
- STUN at stun.cloudflare.com is free and unlimited. — [Cloudflare TURN FAQ](https://developers.cloudflare.com/realtime/turn/faq/)
- Anycast: allocations are homed in the nearest available Cloudflare data center. The TURN IP may change unless an enterprise contract says otherwise. Flag: this text comes from the older Calls FAQ URL. — [Cloudflare Calls TURN FAQ](https://developers.cloudflare.com/calls/turn/faq)
- CreatePermission/ChannelBind requests to private, loopback, link-local, multicast or BYOIP addresses are denied. — [Cloudflare Calls TURN FAQ](https://developers.cloudflare.com/calls/turn/faq)
- Credentials: the server calls `POST https://rtc.live.cloudflare.com/v1/turn/keys/{key_id}/credentials/generate` (or `.../generate-ice-servers` in the newer guide; the two sources disagree on which path is current) with `Authorization: Bearer {key_secret}` and a JSON `ttl`. Cloudflare says to keep the TURN key server-side and pass only the resulting ICE config to the browser. — [Cloudflare generate credentials](https://developers.cloudflare.com/calls/turn/generate-credentials)
- Max TTL is reported as 172,800 s (48 h). Flag: this comes from a third-party reference, not Cloudflare. — [TURN API reference (third-party copy)](https://cdn.jsdelivr.net/npm/memory-journal-mcp@8.0.1/skills/cloudflare/references/turn/api.md)
- Ports in returned ICE servers: stun/turn on 3478 UDP+TCP, `turns:turn.cloudflare.com:5349?transport=tcp`, `turns:turn.cloudflare.com:443?transport=tcp`, plus UDP/TCP 53 and TCP 80. Some integrators drop the port-53 URLs for browsers. — [Cloudflare generate credentials](https://developers.cloudflare.com/calls/turn/generate-credentials); [go2rtc issue #1708](https://github.com/AlexxIT/go2rtc/issues/1708)

**Twilio Network Traversal Service**
- TURN prices: $0.40/GB in US West and Europe; $0.60/GB in Singapore, Mumbai and Tokyo; $0.80/GB in Sydney and São Paulo. STUN is free. No free tier for TURN was found. The page says billing is "in megabytes", which reads as per-MB metering at the per-GB rate. — [Twilio NTS pricing](https://www.twilio.com/en-us/stun-turn/pricing)
- Volume or enterprise pricing is available through sales (as described for Twilio products generally). No monthly minimum was found. — [Twilio NTS pricing](https://www.twilio.com/en-us/stun-turn/pricing)
- Credentials: the server calls the Tokens resource with Account SID + Auth Token and gets back an `ice_servers` array with ephemeral username/password. The default `ttl` is 86,400 s (24 h) and can be overridden. — [Twilio NTS API docs](https://www.twilio.com/docs/stun-turn/api); [Twilio Token resource](https://www.twilio.com/docs/api/rest/token)
- Inference from the above: the Auth Token is an account-wide credential, so it must stay server-side.

**Metered.ca (paid TURN + Open Relay Project)**
- Plans: Free trial is $0/month with **500 MB** TURN usage (ingress + egress), no card needed. Growth is $99/month for 150 GB, then $0.40/GB. Business is $199/month for 500 GB, then $0.20/GB. Enterprise is $499/month for 2 TB, then $0.10/GB. — [Metered pricing](https://metered.ca/pricing); same figures on [Capterra](https://www.capterra.com/p/10050321/Metered-TURN/)
- Conflict: older Metered blog posts claim 5 GB or 50 GB free per month. These look outdated next to the live pricing page. — [Metered blog (Azure TURN)](https://www.metered.ca/blog/azure-turn-server/); [DEV post](https://dev.to/alakkadshaw/twilio-turn-server-alternative-290m)
- Open Relay Project: "20 GB of free TURN usage every month". Runs on ports 80 and 443, supports STUN and TURNS. — [Metered Open Relay](https://www.metered.ca/tools/openrelay/). Conflict: some Metered-authored DEV posts say 50 GB. — [DEV Community](https://dev.to/metered-video/what-is-a-turn-server-traversal-using-relays-around-nat-28fg)
- Credentials API: `POST https://<appname>.metered.live/api/v1/turn/credential?secretKey=...` with optional `expiryInSeconds` (if omitted, the credential never expires) and a label. The **secretKey is account-scoped and server-side only**. The returned **apiKey is credential-scoped and "safe for front-end use"**, and it is used with the Get Credentials endpoint to fetch an iceServers array, which takes an optional `region` parameter. — [Metered create credential](https://www.metered.ca/docs/turn-rest-api/post-create-credential); [Metered project credential](https://www.metered.ca/docs/turn-rest-api/project/post-create-project-turn-credential); [Get credentials](https://metered.ca/docs/turn-rest-api/get-credentials-v2)
- Metered's own guide contains an error ("7200 seconds = 1 hour"), so double-check expiry values. — [Metered expiring credentials guide](https://www.metered.ca/docs/turnserver-guides/expiring-turn-credentials)

**Xirsys**
- Free plan: permanent, one region, 500 MB/month TURN, unlimited STUN, 25 concurrent WebSocket connections, 2 channels. Basic plan reported at $39/month with 50 GB, then $0.50/GB, 12 regions. **Flag: aggregator data only.** I could not retrieve xirsys.com/pricing. — [freetier.co Xirsys](https://freetier.co/directory/products/xirsys); [agentdeals.dev Xirsys](https://agentdeals.dev/vendor/xirsys)

**ExpressTURN**
- Its own comparison pages claim a free tier of **1 TB/month** with all features, and a flat **$9/month for 5 TB** premium plan. **Flag: vendor marketing only, no independent confirmation.** — [ExpressTURN vs Metered](https://www.expressturn.com/vs-metered); [ExpressTURN vs Twilio](https://www.expressturn.com/vs-twilio); [ExpressTURN vs Xirsys](https://www.expressturn.com/vs-xirsys)
- ExpressTURN documents a shared-secret (TURN REST-style) credential mode. — [ExpressTURN secret key examples](https://www.expressturn.com/webrtc-secret-key-examples)

**Others seen, not researched in depth:** [Turnix.io](https://turnix.io/) (API-driven TURN). A 2026 Fora Soft comparison repeats Twilio at $0.40/GB and Cloudflare at $0.05/GB with 1,000 GB free. — [Fora Soft TURN bandwidth calculator (2026-05-31)](https://www.forasoft.com/learn/video-streaming/articles-streaming/turn-bandwidth-calculator)

### Inferences
- On GitHub Pages there is nowhere to keep a secret. Short-lived credentials therefore need one small serverless endpoint, for example a Cloudflare Worker (natural with Cloudflare TURN) or a Netlify/Vercel function. Metered's apiKey model is the exception: the browser can call Metered's Get Credentials endpoint directly with a front-end-safe apiKey, so no server is needed. The cost is that anyone who copies the key can consume the quota.
- Embedding static, non-expiring credentials in a public static site lets third parties use the relay on the owner's bill. On Cloudflare, abuse beyond 1,000 GB costs $0.05/GB. On free tiers like Metered/Open Relay, abuse just exhausts the quota.

### Gaps
- Live pricing pages could not be fetched directly. The Xirsys and ExpressTURN figures in particular are unverified against the vendors' own pricing pages.
- Not established: whether Cloudflare bills the relay-to-non-TURN-peer leg as egress. The FAQ says only "edge to TURN client" is billed.
- Twilio's region list beyond the seven priced regions and any minimum spend were not confirmed.

## Self-hosted TURN (coturn / eturnal / Pion) on a VPS

### Takeaway
The cheapest workable self-hosted options are **Oracle Cloud Always Free** ($0, 10 TB egress/month, with capacity and idle-reclaim caveats), **DigitalOcean** ($4/month, 500 GiB, $0.01/GiB overage), **Hetzner CX23** (about €4-5.50 plus €0.50 IPv4, so about $5-7/month; 20 TB EU traffic, €1/TB overage; 2026 price rises and availability limits), and **Lightsail** ($3.50 IPv6-only, which is unsuitable; IPv4 bundles cost more). At this game's traffic, any of them is egress-unconstrained. The real cost is ops work: a public IPv4, open UDP/TCP ports and a relay range, a domain plus TLS certificate for TURNS on 443, a shared-secret auth setup, plus OS and coturn patching. Fly.io works for UDP but needs a dedicated IPv4 and special binding, which makes it a poor fit.

### Cited Findings
**Hetzner Cloud**
- CX23 (2 vCPU, 4 GB RAM, 40 GB NVMe) replaced CX22. Price reports conflict: €3.49 (pre-2026), €3.99 (after the 1 April 2026 increase), €5.49 plus €0.50 IPv4 (August 2026 comparison). A further increase took effect 15 June 2026, roughly 1.3-1.4x for CX/CAX. — [whtop CX23](https://www.whtop.com/amp/plans/hetzner.com/144086); [kimmo.suominen.com cloud pricing 2026-08](https://kimmo.suominen.com/stuff/cpc-2026-08.txt); [privatedevops on June 2026 increase](https://privatedevops.com/news/hetzner-june-2026-cloud-price-increase-what-to-do); [findstack](https://findstack.com/resources/hetzner-price-increase-2026)
- Availability: Hetzner's cloud page showed "Currently not available" on Cost-Optimized CX/CAX plans (re-checked 17 August 2026), with a "Limited availability" notice since 26 June. — [findstack](https://findstack.com/resources/hetzner-price-increase-2026)
- Traffic: 20 TB/month included in the EU for CX/CAX; the US is about 1 TB and Singapore 0.5 TB. Overage is €1 (about $1.20) per TB. — [Hetzner traffic docs](https://docs.hetzner.com/robot/general/traffic/); [whtop](https://www.whtop.com/amp/plans/hetzner.com/144086). Some third parties quote €1.19/TB. — [egresscost.com](https://egresscost.com/hetzner)
- USD: about €5.99 total (5.49 + 0.50 IPv4) × 1.17 ≈ **$7.00/month** (assumed rate).

**DigitalOcean**
- The Basic Droplet costs $4/month: 512 MiB RAM, 1 shared vCPU, 10 GiB SSD, 500 GiB transfer. One source says this followed a January 2026 cut from $5, with per-second billing since January 2026. **Flag: third-party sources.** — [infratally DO pricing 2026](https://infratally.com/articles/digitalocean-droplet-pricing-guide-2026/); [kuberns](https://kuberns.com/blogs/digitalocean-pricing/)
- Overage is $0.01/GiB ($10/TiB). The transfer allowance is pooled across Droplets, inbound is free, and only public outbound counts. — [DO bandwidth billing FAQ](https://docs.digitalocean.com/release-notes/upcoming/droplet-bandwidth-billing-faq); [DO community](https://www.digitalocean.com/community/questions/do-you-charge-for-bandwidth-overages)

**Oracle Cloud Always Free**
- Ampere A1: 4 OCPU / 24 GB total (1-4 VMs), with 3,000 OCPU-hours and 18,000 GB-hours per month. Data egress is **10 TB/month** across services. — [Oracle free tier](https://developer.oracle.com/free.html); [selfhost.it OCI breakdown](https://selfhost.it.com/blog/oci-free-tier-breakdown)
- Risks: idle instances (CPU, network and RAM all under 20% for 7 days) can be reclaimed, and A1 is often "Out of Capacity" in some regions. — [selfhost.it](https://selfhost.it.com/blog/oci-free-tier-breakdown); [Medium guide 2026](https://medium.com/@imvinojanv/setup-always-free-vps-with-4-ocpu-24gb-ram-and-200gb-storage-the-ultimate-oracle-cloud-guide-2026-bed5cbf73d34)
- Inference: a lightly used TURN server would sit under 20% utilisation, so the idle-reclaim rule is a real risk for this use case.

**AWS Lightsail**
- The $3.50/month bundle is **IPv6-only** (512 MB, 20 GB SSD, 1 TB transfer). Mumbai, Sydney and Jakarta get half the allowance. Overage is reported at $0.09/GB (third-party; varies by region). — [Lightsail pricing](https://aws.amazon.com/lightsail/pricing); [wring.co guide](https://wring.co/blog/aws-lightsail-pricing-guide)
- Inference: a TURN server must be reachable over IPv4 by most clients, so an IPv4 bundle is needed. Its price was not confirmed this session.

**Fly.io**
- UDP needs a **dedicated IPv4**; shared IPv4 and IPv6 do not work for UDP. The app must bind to and reply from `fly-global-services`, because binding 0.0.0.0 sends replies from the wrong source address. Ports are not remapped, and UDP MTU is slightly reduced. — [Fly.io UDP & TCP docs](https://fly.io/docs/networking/udp-and-tcp)
- Community notes: TURN effectively needs single-VM apps because of sticky routing. Declaring any UDP port exposes all inbound UDP, so a relay range works. TURN servers need their own bind to the per-machine fly-global-services IP, resolved at boot. — [Fly community: UDP MTU and TURN](https://community.fly.io/t/udp-mtu-and-the-webrtc-turn-protocol/3742); [Opening port range for WebRTC](https://community.fly.io/t/opening-port-range-for-webrtc/22533); [LiveKit on Fly bind fix](https://community.fly.io/t/running-livekit-livekit-server-livekit-sip-on-fly-the-fly-global-services-udp-bind-requirement-and-a-specific-fix/28316)

**coturn authentication (TURN REST API / shared secret)**
- `use-auth-secret` enables the TURN REST API mode. The secret comes from `static-auth-secret` or from the DB `turn_secret` table. It implies the long-term credential mechanism internally. — [coturn man page (openSUSE)](https://manpages.opensuse.org/Tumbleweed/coturn/coturn.1.en.html); [coturn README.turnserver 4.7.0](https://forger.sitiv.fr/apitech/coturn/src/tag/4.7.0/README.turnserver); [example coturn.conf](https://docs.paquerette.eu/roles/coturn/templates/coturn.conf)
- Credential format: username = `<expiry-unix-timestamp>[:<userid>]`, password = base64(HMAC-SHA1(secret, username)). coturn verifies these without a database lookup. — [coturns Docker page example](https://hub.docker.com/r/michaelfig/coturns); [coturn man page](https://manpages.opensuse.org/Tumbleweed/coturn/coturn.1.en.html)
- The scheme only stays safe if the HMAC is computed server-side. A forum thread on PairDrop + coturn shows clients generating credentials from the secret themselves, which exposes the secret if that client is a public web page. — [ComputerBase forum](https://www.computerbase.de/forum/threads/stun-turn-fuer-nextcloud-talk-und-pairdrop.2233445/)

### Inferences
- Port and config checklist (background knowledge of coturn defaults, **not re-verified from the live coturn repo this session**): `listening-port=3478` (UDP+TCP), `tls-listening-port=5349`, add TURNS on **443/TCP** to get through firewalls that only allow HTTPS (needs a cert, e.g. Let's Encrypt via certbot on a domain such as turn.example.com), set `realm`, `min-port`/`max-port` for the relay range (default 49152-65535; can be narrowed to, say, a few hundred ports for a small game), `external-ip` when behind 1:1 NAT (Oracle, AWS), and `denied-peer-ip` for private ranges to prevent SSRF into the VPS network. See [coturn GitHub](https://github.com/coturn/coturn) and [RFC 8656](https://www.rfc-editor.org/rfc/rfc8656).
- Ongoing maintenance: OS security updates, coturn upgrades, Let's Encrypt renewal (90-day certs, auto-renew plus coturn reload), monitoring, and abuse controls (rate limits, `user-quota`, `total-quota`). Even then, the static site still needs a serverless function to mint HMAC credentials.
- A single VPS has one location, so players far from it get higher RTT on relayed paths. Cloudflare's anycast avoids this. Latency matters little for a turn-based card game.

### Gaps
- Official Hetzner, DigitalOcean, Lightsail and Oracle pricing pages could not be fetched directly. The Hetzner CX23 2026 price is unsettled across sources.
- eturnal and Pion TURN were not researched (no tool budget left).
- Whether Oracle Always Free includes a reserved public IPv4 was not confirmed.

## Traffic per match, share of connections needing TURN, GB/month and cost

### Takeaway
A turn-based card match over a data channel is tiny. Estimate about **0.2-0.5 MB through the relay per relayed match**, and keepalives (STUN consent checks every ~5 s) can outweigh the game messages. With 10-25% of sessions needing TURN, even 10,000 matches/month is about 0.5-5 GB/month. That is free on Cloudflare, ExpressTURN and Open Relay, about $0.20-2/month on Twilio, and over the 500 MB Metered/Xirsys free tiers only at the high end.

### Cited Findings
- Share needing TURN: up to 17.7% of sessions relayed (small study by Philipp Hancke, cited by OpenVidu, 2026). — [OpenVidu blog 2026-06-09](https://openvidu.io/blog/2026/06/09/turn-key-considerations/)
- 15-25% of consumer WebRTC sessions fall back to TURN (vendor estimate), or "typically 10-20%" in another page from the same vendor. — [Fora Soft TURN calculator](https://www.forasoft.com/learn/video-streaming/articles-streaming/turn-bandwidth-calculator); [Fora Soft NAT glossary](https://www.forasoft.com/learn/video-streaming/glossary/terms-streaming/nat)
- "Estimated that 85-90% of connections do not require TURN" (unsourced, older EasyRTC docs). — [EasyRTC docs](https://github.com/gunjank/easyrtc/blob/master/docs/easyrtc_server_ice.md)
- 2016 callstats.io: 22% of *failed* calls required a relay (not a share of all calls). — [No Jitter 2016](https://www.nojitter.com/video-conferencing/know-where-to-turn-when-deploying-webrtc)
- ExpressTURN: 10-25% of viewers need TURN (streaming context, vendor). — [ExpressTURN streaming](https://www.expressturn.com/streaming)
- Keepalive: ICE consent freshness sends STUN binding requests every 5 s by default (randomised 4-6 s), and consent expires after 30 s without a response. — [RFC 7675](https://rfc-editor.org/rfc/rfc7675)
- Cloudflare bills TURN egress including TURN overhead. — [Cloudflare TURN FAQ](https://developers.cloudflare.com/realtime/turn/faq/). Metered counts ingress + egress. — [Metered pricing](https://metered.ca/pricing)

### Inferences (estimate; assumptions stated)
- Assumptions: 15-minute match, about 200 JSON messages total, about 200 B each (payload about 40 KB).
- Per-packet overhead: IP 20 + UDP 8 + TURN ChannelData 4 + DTLS 1.2 AES-GCM record about 29-37 + SCTP common header plus DATA chunk 28 comes to about 90-100 B. Add an SCTP SACK packet of about 80-90 B per message. That puts each message at about 400 B on the wire, about 80 KB per match.
- Keepalives: consent checks at about 5 s, each direction, request plus response about 100-130 B each with IP/UDP. Over 900 s that is about 180 × 2 × 2 × ~120 B ≈ 85 KB. Add SCTP heartbeats (~30 s) and TURN Refresh/CreatePermission (minutes), a few KB. Add setup (ICE checks, DTLS handshake with certificates) at about 5-10 KB.
- **Total about 0.2 MB per one-way-relayed path per match.** Counting both relay legs (client to TURN plus TURN to peer) gives about 0.4 MB. With `iceTransportPolicy: 'relay'` on both peers (two allocations) it is about 0.8 MB. Planning figure: **0.5 MB per relayed match**, and **1 MB** as a safe upper bound.
- GB/month at 20% relayed and 1 MB per relayed match: 100 matches is 0.02 GB, 1,000 matches is 0.2 GB, 10,000 matches is 2 GB. If every match is forced to relay (100%, 1 MB): 0.1 / 1 / 10 GB.
- Cost per month (20% case / 100%-relay case):
  - Cloudflare: $0 in all cases (under 1,000 GB free).
  - ExpressTURN free (1 TB, vendor claim): $0.
  - Open Relay (20 GB): $0.
  - Metered free (500 MB): free at 100 and 1,000 matches. At 10,000 matches, 2 GB exceeds the free tier, and the next step is Growth at $99/month. The 100%-relay case already exceeds 500 MB at 1,000 matches.
  - Xirsys free (500 MB): same pattern as Metered, with Basic reported at $39/month.
  - Twilio at $0.40/GB: $0.01 / $0.08 / $0.80 (20% case), $0.04 / $0.40 / $4.00 (100% relay). Higher in APAC regions ($0.60-0.80/GB).
  - Self-hosted VPS: a fixed $0 (Oracle), $4 (DigitalOcean) or about $5-7 (Hetzner) per month. Traffic is negligible against 500 GiB-20 TB allowances.
- Even a 5x error in the per-match estimate leaves every scenario at 50 GB/month or less.

### Gaps
- No large-scale, peer-reviewed or recent first-party (Google/Chrome, Twilio, Daily, LiveKit) measurement of the TURN share was found. The 10-25% range rests on vendor blogs and one small study.
- The per-match byte figure is a calculated estimate, not a measurement. Measuring `bytesSent`/`bytesReceived` from `RTCPeerConnection.getStats()` (candidate-pair) on a real match would replace it.

## Privacy: can the relay read data, and does relay-only hide IPs?

### Takeaway
No, the relay cannot read the data. Data channels are DTLS-encrypted end to end between the peers, and the TURN server only sees encrypted packets plus both peers' IPs. Setting `iceTransportPolicy: 'relay'` stops peers from learning each other's IP addresses, though the relay operator still sees both. It sends 100% of matches through TURN and doubles allocations when both sides set it, which for this game is still only about 1 MB per match.

### Cited Findings
- Clients encrypt with keys negotiated via DTLS between peers. The TURN server reads only routing headers and has no keys to decrypt the payload. — [LiveSwitch security docs](https://developer.liveswitch.io/liveswitch-server/server/security.html); [Riedel: TURN security concerns](https://manuals.riedel.net/en/stage/2.0/security-concerns-regarding-the-turn-service)
- DTLS certificate fingerprints are exchanged in signaling, so the signaling channel must be protected. Otherwise a man-in-the-middle could swap fingerprints and break the end-to-end property. — [LiveSwitch security docs](https://developer.liveswitch.io/liveswitch-server/server/security.html)
- Forcing relay-only guarantees peers can't learn each other's private network info, optionally including the WAN IP. The TURN server still sees both endpoints. — [LiveSwitch security docs](https://developer.liveswitch.io/liveswitch-server/server/security.html)
- `iceTransportPolicy: 'relay'` is the RTCConfiguration setting for relay-only. Forcing TURN does not guarantee TLS transport, because clients may still use UDP to the TURN server. — [LiveKit firewall tips](https://livekit.com/field-guides/guide/firewall-tips)
- Cloudflare denies relaying to private, loopback and similar addresses. — [Cloudflare Calls TURN FAQ](https://developers.cloudflare.com/calls/turn/faq)

### Inferences
- IP hiding only works if **both** peers set relay-only, or if each peer filters out non-relay candidates before sending them over signaling. Otherwise host and srflx candidates (public IPs) still leak through the signaling channel.
- Traffic cost of relay-only: every match uses TURN, versus about 10-25% without it. That means 2 allocations and about 1 MB per match. At 10,000 matches that is about 10 GB/month: $0 on Cloudflare, about $4 on Twilio, and well past the Metered/Xirsys 500 MB free tiers.
- Relay-only also adds a hard dependency: if the TURN service is down, no match can connect.

### Gaps
- No primary W3C/IETF text on candidate leakage was fetched this session. RFC 8827 (WebRTC security architecture) and RFC 8828 (IP handling) would be the authoritative sources.
