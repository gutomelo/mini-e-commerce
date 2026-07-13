import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { LoginForm } from './_components/login-form';

export const metadata: Metadata = {
  title: 'Log in',
};

export default function LoginPage(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Log in</h1>
        <p className="text-sm text-muted-foreground">Welcome back — enter your details.</p>
      </div>

      <LoginForm />

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-foreground underline underline-offset-4">
          Create one
        </Link>
      </p>
    </div>
  );
}
