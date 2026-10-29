/*
 * Step 2 of "Login with GitHub" for the /admin editor.
 *
 * GitHub sends the browser back here with ?code=…&state=….  We
 *   1. check `state` against the cookie set by oauth-auth.mjs,
 *   2. swap the one-time `code` for an access token (this needs the client SECRET,
 *      which is why it happens on the server and never in the browser),
 *   3. hand the token to the Decap CMS window that opened this pop-up, using the
 *      postMessage handshake Decap expects, and only to our own site's origin.
 *
 * Environment variables:
 *   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET   required
 *   OAUTH_REDIRECT_URI                       optional (must match oauth-auth.mjs)
 */
import { timingSafeEqual } from 'node:crypto';

const SECURITY_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'",
};
const CLEAR_STATE = 'oauth_state=; Max-Age=0; Path=/oauth; HttpOnly; Secure; SameSite=Lax';

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function sameValue(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The site's own origin, plus its www / non-www twin. Nothing else may receive the token. */
function allowedOrigins(url) {
  const set = new Set([url.origin]);
  const host = url.host;
  set.add(url.protocol + '//' + (host.startsWith('www.') ? host.slice(4) : 'www.' + host));
  return [...set];
}

function handshakePage(status, payload, url) {
  const message = 'authorization:github:' + status + ':' + JSON.stringify(payload);
  // JSON inside <script>: neutralise "<" so no value can close the tag.
  const js = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const body = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Signing in…</title></head>
<body style="font-family:Georgia,serif;text-align:center;padding:3rem 1rem;color:#3a3a3a">
<p>${status === 'success' ? 'Signed in — this window will close.' : 'Sorry, the sign-in did not work. You can close this window and try again.'}</p>
<script>
(function () {
  var message = ${js(message)};
  var allowed = ${js(allowedOrigins(url))};
  function receive(e) {
    if (allowed.indexOf(e.origin) === -1) return;
    window.opener.postMessage(message, e.origin);
    window.removeEventListener('message', receive, false);
  }
  window.addEventListener('message', receive, false);
  if (window.opener) window.opener.postMessage('authorizing:github', '*');
})();
</script></body></html>`;
  return new Response(body, {
    status: status === 'success' ? 200 : 400,
    headers: { ...SECURITY_HEADERS, 'Set-Cookie': CLEAR_STATE },
  });
}

export default async (req) => {
  const url = new URL(req.url);
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return handshakePage('error', { message: 'The login service is not set up yet.' }, url);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const saved = parseCookies(req.headers.get('cookie')).oauth_state;

  if (url.searchParams.get('error')) {
    return handshakePage('error', { message: url.searchParams.get('error_description') || 'GitHub declined the sign-in.' }, url);
  }
  if (!code || !state || !saved || !sameValue(state, saved)) {
    return handshakePage('error', { message: 'The sign-in could not be verified. Please try again.' }, url);
  }

  let data;
  try {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'marry-me-in-banff-editor' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: process.env.OAUTH_REDIRECT_URI || url.origin + '/oauth/callback',
      }),
    });
    data = await res.json();
  } catch (e) {
    return handshakePage('error', { message: 'Could not reach GitHub. Please try again.' }, url);
  }

  if (!data || data.error || !data.access_token) {
    return handshakePage('error', { message: (data && data.error_description) || 'GitHub did not return a token.' }, url);
  }
  return handshakePage('success', { token: data.access_token, provider: 'github' }, url);
};

export const config = { path: '/oauth/callback' };
