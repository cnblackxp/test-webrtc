// Browser test of index.html (the "Sanguis WEBRTC" test page):
// two Chromium pages, one hosts and one joins by swapping the copy-paste codes, then they
// chat and ping over the data channel. Runs the local file, so it tests the page's
// code; open the GitHub Pages site to test real networks.
//   node tools/webrtc-test.mjs        (needs playwright: npm i --no-save playwright)
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(path.join(root, 'index.html')).href;
const TIMEOUT = 15000;

const fail = msg => { console.error('FAIL: ' + msg); process.exitCode = 1; };
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH ? undefined : '/opt/pw-browsers/chromium',
  // Fake mDNS off so host candidates are real addresses the other page can reach.
  args: ['--disable-features=WebRtcHideLocalIpsWithMdns'],
});
try {
  const ctx = await browser.newContext();
  const host = await ctx.newPage(), join = await ctx.newPage();
  for (const p of [host, join]) {
    p.on('pageerror', e => fail('page error: ' + e.message));
    await p.goto(url);
  }

  // Checks: the API and the in-page connection must pass; STUN needs internet, so only report it.
  await host.waitForFunction(() => !/Testing/.test(document.getElementById('c-loop-pill').textContent), null, { timeout: TIMEOUT });
  for (const k of ['api', 'loop', 'stun']) {
    const pill = await host.textContent(`#c-${k}-pill`), text = await host.textContent(`#c-${k}`);
    console.log(`check ${k}: ${pill} (${text})`);
    if (k !== 'stun' && !/Present|Works/.test(pill)) fail(`check ${k} did not pass`);
  }

  // Codes must round-trip and wrong codes must be refused with a message.
  const rt = await host.evaluate(async () => {
    const sdp = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\n';
    const code = await SanguisRTC.encode('offer', { sdp });
    const back = await SanguisRTC.decode('offer', code);
    let wrongKind = '', junk = '';
    try { await SanguisRTC.decode('answer', code); } catch (e) { wrongKind = e.message; }
    try { await SanguisRTC.decode('offer', 'hello'); } catch (e) { junk = e.message; }
    return { same: back.sdp === sdp, wrongKind, junk };
  });
  if (!rt.same) fail('code did not round-trip');
  if (!/invite code/.test(rt.wrongKind)) fail('an invite code pasted as a reply was not refused');
  if (!/Sanguis code/.test(rt.junk)) fail('junk was not refused');

  // Host -> invite code -> joiner -> reply code -> host.
  await host.click('#role-host');
  await host.waitForFunction(() => document.getElementById('host-offer').value.startsWith('SGO1.'), null, { timeout: TIMEOUT });
  const offer = await host.inputValue('#host-offer');
  console.log(`invite code: ${offer.length} characters (${await host.textContent('#offer-meta')})`);

  await join.click('#role-join');
  await join.fill('#join-offer', offer);
  await join.click('#make-answer');
  await join.waitForFunction(() => document.getElementById('join-answer').value.startsWith('SGA1.'), null, { timeout: TIMEOUT });
  const answer = await join.inputValue('#join-answer');
  console.log(`reply code: ${answer.length} characters`);

  await host.fill('#host-answer', answer);
  await host.click('#accept-answer');
  for (const p of [host, join]) await p.waitForFunction(() => !document.getElementById('msg').disabled, null, { timeout: TIMEOUT });
  console.log('host: ' + await host.textContent('#conn-state'));
  console.log('join: ' + await join.textContent('#conn-state'));

  // Chat both ways, then a ping.
  await host.fill('#msg', 'The Butcher takes the field.');
  await host.click('#send');
  await join.waitForFunction(() => /them: The Butcher takes the field\./.test(document.getElementById('log').textContent), null, { timeout: TIMEOUT });
  await join.fill('#msg', 'Grave Pit is set.');
  await join.click('#send');
  await host.waitForFunction(() => /them: Grave Pit is set\./.test(document.getElementById('log').textContent), null, { timeout: TIMEOUT });
  await join.click('#ping');
  await join.waitForFunction(() => /pong: \d+ ms/.test(document.getElementById('log').textContent), null, { timeout: TIMEOUT });
  console.log('chat both ways and ping: ok');

  // The used invite can't be accepted twice.
  await host.click('#accept-answer');
  await host.waitForFunction(() => /already used/.test(document.getElementById('log').textContent), null, { timeout: TIMEOUT });
  console.log('reused invite refused: ok');
} catch (e) {
  fail(e.message);
} finally {
  await browser.close();
}
if (!process.exitCode) console.log('webrtc-test: all passed');
