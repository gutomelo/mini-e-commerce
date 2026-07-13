import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { RegisterForm } from './_components/register-form';

export const metadata: Metadata = {
  title: 'Create account',
};

export default function RegisterPage(): ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Register to start shopping and track your orders.
        </p>
      </div>

      <RegisterForm />

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>
    </div>
  );
}
