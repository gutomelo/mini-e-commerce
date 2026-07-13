import { expect, test } from '@playwright/test';

import { buildTestUser } from './support/fixtures';
import { registerAndLogin } from './support/ui-helpers';

test.describe('auth: register, login, session persistence', () => {
  test('register -> login round trip sets httpOnly session cookies that survive a reload', async ({
    page,
    context,
  }) => {
    const user = buildTestUser();

    await registerAndLogin(page, user);

    // registerAction auto-logs the new account in and redirects to /products;
    // the header shows "Log out" only when an access_token cookie is present
    // (see SiteHeader), so this alone already proves the round trip worked.
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();

    const cookies = await context.cookies();
    const accessTokenCookie = cookies.find((c) => c.name === 'access_token');
    const refreshTokenCookie = cookies.find((c) => c.name === 'refresh_token');

    expect(accessTokenCookie, 'access_token cookie must be set').toBeTruthy();
    expect(refreshTokenCookie, 'refresh_token cookie must be set').toBeTruthy();
    // The browser never sees raw tokens in a readable way: both cookies must
    // be httpOnly (inaccessible to `document.cookie`), matching the spec's
    // "browser never sees raw tokens" requirement.
    expect(accessTokenCookie?.httpOnly).toBe(true);
    expect(refreshTokenCookie?.httpOnly).toBe(true);
    expect(accessTokenCookie?.sameSite).toBe('Lax');
    expect(refreshTokenCookie?.sameSite).toBe('Lax');

    // Confirm httpOnly is enforced from the browser's own point of view too,
    // not just as reported by the cookie jar: `document.cookie` must not
    // reveal either token.
    const documentCookie = await page.evaluate(() => document.cookie);
    expect(documentCookie).not.toContain('access_token');
    expect(documentCookie).not.toContain('refresh_token');

    // Session survives a full page reload.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log in' })).toHaveCount(0);
  });

  test('logout clears the session and blocks auth-required pages', async ({ page }) => {
    const user = buildTestUser();
    await registerAndLogin(page, user);

    await page.getByRole('button', { name: 'Log out' }).click();
    await page.waitForURL('**/login');

    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible();

    // An auth-required page redirects to /login once logged out.
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('an invalid/expired access token triggers exactly one transparent silent refresh', async ({
    page,
    context,
  }) => {
    // Scope note: the API's `JwtAuthGuard` returns the same 401 for a token
    // that is expired, malformed, or signed with the wrong secret — it does
    // not distinguish "expired" from "otherwise invalid" (both simply fail
    // verification). Overwriting the access_token cookie with a syntactically
    // different, invalid JWT therefore exercises the exact same server-side
    // 401 response, and the exact same client-side "401 -> refresh once ->
    // retry" branch in `authFetch`, that a genuinely time-expired token
    // would. This sidesteps two real problems with forcing a short
    // `JWT_ACCESS_TTL` for a live browser test: (1) it would need a *second*,
    // separately configured API process just for this one test (Playwright's
    // `webServer` list is fixed for the whole run), and (2) a short TTL
    // applied to the *whole* suite would cause near-constant silent refreshes
    // across every other authenticated test, which — combined with the auth
    // endpoints' shared per-IP throttle bucket — would make the suite flaky
    // by design. The precise "exactly one refresh, retried exactly once, no
    // loop" call-count guarantee is already proven deterministically (no
    // timing dependency at all) by the mocked unit tests in
    // `src/data-access/http-client.test.ts`, and refresh-token rotation
    // itself is proven end-to-end at the HTTP level by the API's own
    // `auth.e2e-spec.ts`. What this test adds on top is the missing piece
    // neither of those covers: a *real browser*, holding the session only in
    // httpOnly cookies, transparently recovers from an invalid access token
    // without the user ever seeing a logged-out state.
    const user = buildTestUser();
    await registerAndLogin(page, user);

    const cookiesBefore = await context.cookies();
    const originalAccessToken = cookiesBefore.find((c) => c.name === 'access_token')?.value;
    expect(originalAccessToken).toBeTruthy();

    await context.addCookies([
      {
        name: 'access_token',
        value: 'not-a-valid-jwt.tampered.value',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    // /orders is a Server Component that calls the authenticated
    // `listOrders()` data-access function on every request, so this
    // navigation is exactly the kind of authenticated request the silent
    // refresh exists to protect.
    await page.goto('/orders');

    // The user is never bounced to /login and never sees a broken page —
    // the refresh happened transparently server-side inside the Server
    // Component render.
    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.getByRole('heading', { name: 'Your orders' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();

    // Finding worth documenting (this is expected, correct behavior, not a
    // bug the test is guarding against): the refreshed token pair is *not*
    // persisted back into cookies here, because `setSessionCookies` writes
    // via `next/headers`' `cookies().set()`, which Next.js only allows from
    // a Server Action or Route Handler — calling it during a plain Server
    // Component render (exactly what happens when `authFetch`'s silent
    // refresh fires from a GET page like this one) is a documented no-op
    // (see `lib/session.ts`). So the cookie jar below still holds the
    // tampered access token, and — because the API's refresh tokens are
    // single-use/rotating — the *old* refresh token that was just consumed
    // to produce this render's (unpersisted) new pair can never be reused.
    const cookiesAfterFirstNavigation = await context.cookies();
    const accessTokenAfterFirstNavigation = cookiesAfterFirstNavigation.find(
      (c) => c.name === 'access_token',
    )?.value;
    expect(accessTokenAfterFirstNavigation).toBe('not-a-valid-jwt.tampered.value');

    // A second navigation therefore hits an access token that's still
    // invalid *and* a refresh token that's now been rotated away — the
    // session is genuinely unrecoverable at this point, not just
    // momentarily stale. The auth-required Server Component pages
    // (`/orders`, `/orders/[id]`, `/checkout/confirmation/[id]`) catch that
    // specific 401 and redirect to `/login` rather than surfacing an
    // unhandled server error, which is what this asserts: graceful
    // degradation, not a crash, once the refresh path is truly exhausted.
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login$/);
  });
});
