// Browser test of index.html (the "Sanguis WEBRTC" test page), following the link flow:
// one Chromium page presses Host and reads the invite link, a second page opens that link and
// reads the reply, the host pastes it and presses Connect, then they chat and ping. Also checks
// the error states (garbage invite, reused invite, wrong reply) and the "What they can see" modal.
// Runs the local file, so it tests the page's code; open the GitHub Pages site to test real networks.
//   node tools/webrtc-test.mjs        (needs playwright: npm i --no-save playwright)
// QR_JS=/path/to/qrcode.js serves the QR library from a local copy (qrcode-generator@1.4.4) when
// the CDN can't be reached; the page's SRI hash still has to match it.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = pathToFileURL(path.join(root, 'index.html')).href;
const TIMEOUT = 15000;
const CHROMIUM = '/opt/pw-browsers/chromium'; // preinstalled in Claude Code cloud containers

const fail = msg => { console.error('FAIL: ' + msg); process.exitCode = 1; };
const ok = msg => console.log('ok: ' + msg);
const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROMIUM) ? CHROMIUM : undefined,
  // Fake mDNS off so host candidates are real addresses the other page can reach.
  args: ['--disable-features=WebRtcHideLocalIpsWithMdns'],
});
const statusOf = p => p.textContent('#status-text');
const waitStatus = (p, re) => p.waitForFunction(src => new RegExp(src).test(document.getElementById('status-text').textContent), re.source, { timeout: TIMEOUT });
const visible = (p, sel) => p.evaluate(s => !document.querySelector(s).closest('[hidden]'), sel);

try {
  const ctx = await browser.newContext();
  if (process.env.QR_JS) {
    await ctx.route('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', r => r.fulfill({
      body: fs.readFileSync(process.env.QR_JS), contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' },
    }));
  }
  const errors = p => p.on('pageerror', e => fail('page error: ' + e.message));
  const host = await ctx.newPage(); errors(host);
  await host.goto(url);

  // First screen: only Host; checks collapsed. The API and in-page checks must pass; STUN needs internet.
  if (!await visible(host, '#host')) fail('Host button not visible on the first screen');
  if (await host.$('#role-join')) fail('there should be no Join button');
  if (await host.evaluate(() => document.getElementById('checks-box').open)) fail('checks should start collapsed');
  await host.waitForFunction(() => !/Testing/.test(document.getElementById('c-loop-pill').textContent), null, { timeout: TIMEOUT });
  for (const k of ['api', 'loop', 'stun']) {
    const pill = await host.textContent(`#c-${k}-pill`), text = await host.textContent(`#c-${k}`);
    console.log(`check ${k}: ${pill} (${text})`);
    if (k !== 'stun' && !/Present|Works/.test(pill)) fail(`check ${k} did not pass`);
  }

  // Codes round-trip; wrong codes are refused with a message.
  const rt = await host.evaluate(async () => {
    const sdp = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n';
    const code = await SanguisRTC.encode('offer', { sdp }, { made: 5 });
    const back = await SanguisRTC.decode('offer', 'Join my game: https://x/#invite=' + code);
    const why = async (k, c) => { try { await SanguisRTC.decode(k, c); return 'accepted'; } catch (e) { return e.why; } };
    return { same: back.sdp === sdp, tag: back.tags.made, wrongKind: await why('answer', code), junk: await why('offer', 'hello'), cut: await why('offer', code.slice(0, 40)) };
  });
  if (!rt.same || rt.tag !== '5') fail('code did not round-trip with its tags');
  if (rt.wrongKind !== 'wrong-kind') fail('an invite pasted as a reply was not refused');
  if (rt.junk !== 'junk') fail('junk was not refused');
  if (rt.cut !== 'damaged') fail('a cut-off code was not refused');
  ok('codes round-trip and bad codes are refused');

  // Host -> link.
  await host.click('#host');
  await host.waitForFunction(() => /#invite=SGO1\./.test(document.getElementById('invite-link').value), null, { timeout: TIMEOUT });
  const link = await host.inputValue('#invite-link');
  console.log(`invite link: ${link.length} characters (${await host.textContent('#link-meta')})`);
  if (!link.startsWith(url + '#invite=')) fail('link is not this page + #invite=: ' + link.slice(0, 80));
  await waitStatus(host, /Waiting for reply/);
  if (!await visible(host, '#reply-in') || !await visible(host, '#connect')) fail('reply box not shown right after the link');
  ok('host status: ' + await statusOf(host));

  // QR code: rendered if the library loads (CDN or QR_JS), otherwise a plain message.
  await host.click('#qr-btn');
  await host.waitForFunction(() => document.querySelector('#qr svg') || /QR code maker/.test(document.getElementById('link-meta').textContent), null, { timeout: TIMEOUT });
  if (await host.$('#qr svg')) ok('QR code rendered'); else console.log('note: QR library not reachable here; the page said so');

  // Host-side bad replies: empty, own invite, garbage.
  const replyError = async (text, re, what) => {
    await host.fill('#reply-in', text);
    await host.click('#connect');
    await host.waitForFunction(src => { const e = document.getElementById('reply-err'); return !e.hidden && new RegExp(src).test(e.textContent); }, re.source, { timeout: TIMEOUT });
    ok(what + ': ' + await host.textContent('#reply-err'));
  };
  await replyError('', /Paste the reply first/, 'empty reply refused');
  await replyError(link, /your own invite/, 'own invite refused');
  await replyError('hello there', /doesn't look like a Sanguis code/, 'garbage reply refused');

  // A reply to some other invite is refused too.
  const other = await ctx.newPage(); errors(other);
  await other.goto(url); await other.click('#host');
  await other.waitForFunction(() => /#invite=/.test(document.getElementById('invite-link').value), null, { timeout: TIMEOUT });
  const otherLink = await other.inputValue('#invite-link');
  const stray = await ctx.newPage(); errors(stray);
  await stray.goto(otherLink);
  await stray.waitForFunction(() => document.getElementById('reply-out').value.startsWith('SGA1.'), null, { timeout: TIMEOUT });
  await replyError(await stray.inputValue('#reply-out'), /different invite/, 'reply for another invite refused');
  await stray.close(); await other.close();

  // Joiner opens the link: no Host/Join choice, reply shown, address bar cleaned.
  const join = await ctx.newPage(); errors(join);
  await join.goto(link);
  await join.waitForFunction(() => document.getElementById('reply-out').value.startsWith('SGA1.'), null, { timeout: TIMEOUT });
  const answer = await join.inputValue('#reply-out');
  console.log(`reply code: ${answer.length} characters`);
  if (await visible(join, '#host')) fail('joiner sees a Host button');
  if (!/Send this back to the host/.test(await join.textContent('#s-join'))) fail('joiner instruction missing');
  if (join.url() !== url) fail('invite not cleaned from the address bar: ' + join.url());
  await waitStatus(join, /Waiting for the host to paste your reply/);
  ok('joiner status: ' + await statusOf(join) + '; address bar: ' + join.url());

  // Host pastes the reply (with some share-sheet text around it) and connects.
  await host.fill('#reply-in', 'Here: ' + answer + ' ');
  await host.click('#connect');
  for (const p of [host, join]) {
    await waitStatus(p, /^Connected$/);
    await p.waitForFunction(() => /Route: /.test(document.getElementById('banner-route').textContent) && /ms round trip/.test(document.getElementById('banner-route').textContent), null, { timeout: TIMEOUT });
    if (await visible(p, '#reply-in') || await visible(p, '#reply-out')) fail('setup steps still visible after connecting');
  }
  console.log('host: ' + await host.textContent('#banner'));
  console.log('join: ' + await join.textContent('#banner'));

  // Chat both ways, then a ping each way.
  await host.fill('#msg', 'The Butcher takes the field.');
  await host.click('#send');
  await join.waitForFunction(() => /them: The Butcher takes the field\./.test(document.getElementById('log').textContent), null, { timeout: TIMEOUT });
  await join.fill('#msg', 'Grave Pit is set.');
  await join.press('#msg', 'Enter');
  await host.waitForFunction(() => /them: Grave Pit is set\./.test(document.getElementById('log').textContent), null, { timeout: TIMEOUT });
  for (const p of [join, host]) {
    await p.click('#ping');
    await p.waitForFunction(() => /pong: \d+ ms/.test(document.getElementById('log').textContent), null, { timeout: TIMEOUT });
  }
  ok('chat both ways and ping both ways');

  // "What they can see": lists the remote address actually in use, from getStats.
  const pair = await host.evaluate(() => SanguisRTC.pair());
  await host.click('#s-live .see');
  await host.waitForFunction(() => document.getElementById('see-dlg').open, null, { timeout: TIMEOUT });
  const seen = await host.textContent('#see-body');
  if (!pair || !pair.remote.address || !seen.includes(pair.remote.address + ' port ' + pair.remote.port)) fail('modal does not list the remote address ' + JSON.stringify(pair && pair.remote));
  else ok(`modal lists the remote address ${pair.remote.address}:${pair.remote.port} (${pair.remote.type})`);
  for (const want of [/DTLS sha-256/, /Messages they sent: 1/, /What is NOT shared/, /invite link holds the host's IP addresses/]) {
    if (!want.test(seen)) fail('modal is missing ' + want);
  }
  await host.click('#see-close');

  // Reusing the invite: opening the same link again in this browser shows the error state.
  const again = await ctx.newPage(); errors(again);
  await again.goto(link);
  await again.waitForFunction(() => !document.getElementById('s-bad').hidden, null, { timeout: TIMEOUT });
  ok('reused invite: ' + await again.textContent('#bad-text'));
  if (!await visible(again, '#bad-host')) fail('no "Host a new game instead" on the reused-invite screen');
  // Garbage in the link shows the same screen.
  await again.goto(url + '#invite=hello');
  await again.waitForFunction(() => !document.getElementById('s-bad').hidden, null, { timeout: TIMEOUT });
  ok('garbage invite: ' + await again.textContent('#bad-text'));
  // ?invite= works as well as #invite= (and is cleaned the same way).
  await again.goto(url + '?invite=SGO1.zbroken');
  await again.waitForFunction(() => !document.getElementById('s-bad').hidden, null, { timeout: TIMEOUT });
  if (again.url() !== url) fail('?invite= not cleaned from the address bar');
  ok('?invite= read and cleaned: ' + await again.textContent('#bad-text'));
  await again.click('#bad-host');
  await again.waitForFunction(() => /#invite=/.test(document.getElementById('invite-link').value), null, { timeout: TIMEOUT });
  ok('"Host a new game instead" makes a fresh link');
  await again.close();

  // Phone width: no horizontal scroll on the live screen.
  await host.setViewportSize({ width: 360, height: 740 });
  if (await host.evaluate(() => document.documentElement.scrollWidth > innerWidth)) fail('horizontal scroll at 360 px');
  else ok('no horizontal scroll at 360 px');

  // The joiner leaves: the host sees Disconnected and is offered a new game.
  await join.close();
  await waitStatus(host, /Disconnected/);
  if (!/Disconnected/.test(await host.textContent('#banner-title'))) fail('banner did not switch to Disconnected');
  if (!await visible(host, '#again')) fail('no "Host a new game" after the other side left');
  if (!await host.isDisabled('#msg')) fail('chat still enabled after disconnect');
  ok('other side left: ' + await statusOf(host));

  // A reply whose sender is gone: the host's Connect ends in the "couldn't connect" message.
  const lone = await ctx.newPage(); errors(lone);
  await lone.goto(url); await lone.click('#host');
  await lone.waitForFunction(() => /#invite=/.test(document.getElementById('invite-link').value), null, { timeout: TIMEOUT });
  const gone = await ctx.newPage();
  await gone.goto(await lone.inputValue('#invite-link'));
  await gone.waitForFunction(() => document.getElementById('reply-out').value.startsWith('SGA1.'), null, { timeout: TIMEOUT });
  const goneReply = await gone.inputValue('#reply-out');
  await gone.close();
  await lone.fill('#reply-in', goneReply);
  await lone.click('#connect');
  await lone.waitForFunction(() => /Couldn't connect directly/.test(document.getElementById('status-text').textContent), null, { timeout: 40000 });
  if (!await visible(lone, '#again')) fail('no "Host a new game" after a failed connection');
  ok('no route: ' + await statusOf(lone));
} catch (e) {
  fail(e.message);
} finally {
  await browser.close();
}
if (!process.exitCode) console.log('webrtc-test: all passed');
