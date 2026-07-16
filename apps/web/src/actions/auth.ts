'use server';

import { redirect } from 'next/navigation';

import { login, logout, register } from '@/data-access/auth';
import { ApiError } from '@/data-access/http-client';
import { clearSessionCookies, getRefreshToken, setSessionCookies } from '@/lib/session';

/** Shape returned to the client form component via `useActionState`. */
export interface AuthFormState {
  error?: string;
}

function readField(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Registers a new account and, on success, immediately logs the user in
 * (rather than bouncing them to `/login` to re-type credentials they just
 * entered) before redirecting to the catalog. If the auto-login call itself
 * fails for some transient reason, the registration still succeeded, so we
 * fall back to `/login` instead of reporting a false failure.
 */
export async function registerAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = readField(formData, 'name');
  const email = readField(formData, 'email');
  const password = readField(formData, 'password');

  try {
    await register({ name, email, password });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.statusCode === 409) {
        return { error: 'An account with this email already exists.' };
      }
      return { error: error.message };
    }
    throw error;
  }

  try {
    const tokens = await login({ email, password });
    await setSessionCookies(tokens);
  } catch {
    redirect('/login');
  }

  redirect('/products');
}

/** Logs an existing user in and starts their session. */
export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = readField(formData, 'email');
  const password = readField(formData, 'password');

  let tokens;
  try {
    tokens = await login({ email, password });
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.statusCode === 401) {
        return { error: 'Invalid email or password.' };
      }
      return { error: error.message };
    }
    throw error;
  }

  await setSessionCookies(tokens);
  redirect('/products');
}

/**
 * Ends the session. Always succeeds from the user's perspective: the API
 * revocation call is best-effort (e.g. the refresh token may already be
 * expired or revoked), but the local cookies are cleared unconditionally.
 */
export async function logoutAction(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    try {
      await logout(refreshToken);
    } catch {
      // Swallow — see doc comment above.
    }
  }

  await clearSessionCookies();
  redirect('/login');
}
