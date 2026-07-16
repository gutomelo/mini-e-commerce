'use client';

import { Button, Input, Label } from '@mini-e-commerce/ui';
import type { ReactElement } from 'react';
import { useActionState } from 'react';

import { type AuthFormState, registerAction } from '@/actions/auth';

const initialState: AuthFormState = {};

/**
 * Registration form. Kept as the only Client Component on the page — it
 * exists solely to wire `useActionState` to the `<form action>` and render
 * the returned error state; the surrounding page stays a Server Component.
 */
export function RegisterForm(): ReactElement {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" type="text" autoComplete="name" required minLength={1} />
      </div>

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
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="mt-2 w-full">
        {pending ? 'Creating account...' : 'Create account'}
      </Button>
    </form>
  );
}
