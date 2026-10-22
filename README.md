# Sanguis WEBRTC test

Can two players of [Sanguis](https://github.com/cnblackxp/card-game-prototype) connect browser to
browser, with no game server? This page finds out.

**Live page:** https://cnblackxp.github.io/test-webrtc/

## How to connect

1. **Host.** One player opens the page and presses **Host a game**. The page makes a link with an
   invite in it.
2. **Send the link.** Copy it, share it (the phone's share sheet), or show its QR code. Send it
   through any chat app.
3. **Friend opens the link.** Their page joins by itself and shows a **reply** with the words
   "Send this back to the host". They copy or share it back.
4. **Host pastes the reply** into "Paste your friend's reply here" and presses **Connect**.
5. **Connected.** Both pages show a Connected banner with the route (same network, through the
   router, or a relay) and the round-trip time, then Chat and Ping. If either side closes the page,
   the other sees Disconnected and can host a new game.

A status line at the top says what each side is waiting for at every step. Wrong or broken codes
get a plain message, and an old, used or broken invite link offers to host a new game instead.
**What they can see** (on the link screen and once connected) lists what each side learns about
the other, read from the live connection.

There is no TURN relay, so some pairs of networks (strict mobile carriers, some office networks)
won't connect; after 20 seconds the page says so. Same Wi-Fi almost always works.

Browser checks (WebRTC present, a connection inside the page, a STUN lookup) sit in a collapsed
box at the bottom.

No game runs over it yet. If it connects, the game's LAN host (`js/net/host-core.js`) can run
over this data channel the same way it runs over the LAN WebSocket.

## The link format: `#invite=`, not `?invite=`

Links look like `https://cnblackxp.github.io/test-webrtc/#invite=SGO1.z…`. The owner asked for a
query parameter (`?invite=`); the page uses the fragment (`#`) instead because:

- **It never leaves the browser.** Browsers don't send the part after `#` to the server, so the
  invite (and the host's IP addresses inside it) never reaches GitHub's servers or their logs.
- **No server length limits.** The invite is about 500–600 characters. Fragments aren't subject to
  server URL limits.
- It changes nothing else: the page reads it the same way and works from a `file://` URL.

`?invite=` links still work too, in case one is typed by hand. Either way the page removes the
invite from the address bar (`history.replaceState`) as soon as it reads it, so a refresh or a
screenshot doesn't reuse it.

## Privacy and lifetime

- **The invite link contains the host's IP addresses.** Anyone who gets the link, or reads it
  later in a chat history, can read them. The reply contains the joiner's addresses the same way.
- **An invite only works while the host's page is open and waiting.** Closing the tab ends it for
  good: an old link can't connect to anyone, and nothing is stored on any server. GitHub Pages only
  serves the static page, and the `#invite` part of the link never reaches it.
- **The connection is encrypted (DTLS)** and ends when either tab closes.
- **Each Host press makes a fresh invite.**
- **Not shared:** no files, no camera or microphone, no location beyond what an IP address
  suggests, no account info. The page doesn't send the browser's user agent; chat text goes
  straight to the other player and isn't saved.

The QR code library ([qrcode-generator](https://www.npmjs.com/package/qrcode-generator) 1.4.4,
pinned, with an SRI hash) loads from jsDelivr only when **Show QR code** is pressed.

## GitHub Pages

The site is the repository's root (`index.html`, plus `.nojekyll` so it's served as is). One-time
setup: **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `/ (root)`
→ Save.** After that every push to `main` updates the page within a minute or two.

## Test it locally

```
npm i --no-save playwright
node tools/webrtc-test.mjs
```

Opens the local `index.html` in Chromium tabs and follows the real flow: the host presses Host and
reads the link, a second tab opens the link and reads the reply, the host pastes it and presses
Connect. It checks that:

- both sides reach Connected with a route and round-trip time; chat and ping work both ways;
- the invite is cleaned from the joiner's address bar; `?invite=` works as well as `#invite=`;
- a reused, garbage or cut-off invite shows the error screen with "Host a new game instead";
- the host's Connect refuses an empty reply, its own invite, garbage, and a reply to another invite;
- "What they can see" lists the remote address actually in use (from `getStats()`);
- closing one side shows Disconnected on the other; a reply whose sender is gone ends in the
  "Couldn't connect directly" message; no horizontal scroll at 360 px.

It uses `/opt/pw-browsers/chromium` when that exists (Claude Code cloud containers). If the CDN is
blocked, `QR_JS=path/to/qrcode-generator/qrcode.js node tools/webrtc-test.mjs` serves the QR library
from a local copy (the page's SRI hash must still match). Different networks, phones and share
sheets can only be checked on real devices with the live page.
