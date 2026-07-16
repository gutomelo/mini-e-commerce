'use client';

import { Button, Input, Label } from '@mini-e-commerce/ui';
import type { ReactElement } from 'react';
import { useActionState } from 'react';

import { type AuthFormState, loginAction } from '@/actions/auth';

const initialState: AuthFormState = {};

/**
 * Login form. Kept as the only Client Component on the page — it exists
 * solely to wire `useActionState` to the `<form action>` and render the
 * returned error state; the surrounding page stays a Server Component.
 */
export function LoginForm(): ReactElement {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? 'Logging in...' : 'Log in'}
      </Button>
    </form>
  );
}
