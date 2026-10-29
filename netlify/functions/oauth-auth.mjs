/*
 * Step 1 of "Login with GitHub" for the /admin editor.
 *
 * Decap CMS opens a pop-up at  https://<site>/oauth/auth.  We send the browser to
 * GitHub's sign-in page, remembering a random `state` value in a short-lived cookie
 * so that oauth-callback.mjs can prove the reply really belongs to this sign-in
 * (protection against forged log-in requests).
 *
 * Environment variables (Netlify → Site configuration → Environment variables):
 *   GITHUB_CLIENT_ID      required  – from the GitHub OAuth App
 *   GITHUB_SCOPE          optional  – default "repo" (needed for a private repository;
 *                                     use "public_repo" if the repository is public)
 *   OAUTH_REDIRECT_URI    optional  – override; default <this site>/oauth/callback
 */
import { randomBytes } from 'node:crypto';

const text = (body, status = 200) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export default async (req) => {
  const url = new URL(req.url);
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return text('The login service is not set up yet (GITHUB_CLIENT_ID is missing).', 500);

  const provider = url.searchParams.get('provider');
  if (provider && provider !== 'github') return text('Unsupported provider.', 400);

  const state = randomBytes(16).toString('hex');
  const redirectUri = process.env.OAUTH_REDIRECT_URI || url.origin + '/oauth/callback';

  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('scope', process.env.GITHUB_SCOPE || 'repo');
  authorize.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      'Set-Cookie': `oauth_state=${state}; Max-Age=600; Path=/oauth; HttpOnly; Secure; SameSite=Lax`,
      'Cache-Control': 'no-store',
    },
  });
};

export const config = { path: '/oauth/auth' };
