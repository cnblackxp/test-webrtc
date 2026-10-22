# Sanguis WEBRTC test

Can two players of [Sanguis](https://github.com/cnblackxp/card-game-prototype) connect browser to
browser, with no game server? This page finds out.

**Live page:** https://cnblackxp.github.io/test-webrtc/

1. **Checks** run as the page opens: WebRTC is present, a data channel opens inside the page,
   and a STUN server reports this device's public address.
2. **Connect two devices.** One player presses Host and sends the **invite code** to the other
   (any chat app). The other presses Join, pastes it, and sends back the **reply code**. The host
   pastes the reply and a data channel opens directly between the two browsers. Chat and Ping
   show it working, and the page says which route it found (same network, or through the router).

There is no TURN relay, so some pairs of networks (strict mobile carriers, some office networks)
won't connect. Same Wi-Fi almost always works.

No game runs over it yet. If it connects, the game's LAN host (`js/net/host-core.js`) can run
over this data channel the same way it runs over the LAN WebSocket.

## GitHub Pages

The site is the repository's root (`index.html`, plus `.nojekyll` so it's served as is). One-time
setup: **Settings → Pages → Build and deployment → Source: Deploy from a branch → `main` / `/ (root)`
→ Save.** After that every push to `main` updates the page within a minute or two.

## Test it locally

```
npm i --no-save playwright
node tools/webrtc-test.mjs
```

Opens the page in two Chromium tabs, hosts in one, joins from the other by swapping the codes,
then checks chat, ping, and that an invite can't be used twice.
