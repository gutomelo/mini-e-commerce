import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';

/** Sentinel returned by the login pipeline's `catchError` so the subscriber can
 * distinguish "HTTP call failed" (error message already set) from "call
 * succeeded" (`undefined`, since `AuthService.login` resolves to `void`). */
const LOGIN_FAILED = Symbol('login-failed');

interface LoginFormControls {
  email: FormControl<string>;
  password: FormControl<string>;
}

/**
 * `/login` page. Authenticates via `AuthService.login`, then enforces the
 * admin-only rule at the app boundary: the NestJS API authenticates any valid
 * credentials regardless of role, so a successful HTTP login by a `CUSTOMER`
 * must still be rejected here — the session is torn back down and the user
 * never reaches an admin screen.
 */
@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = new FormGroup<LoginFormControls>({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  protected submit(): void {
    if (this.submitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.submitting.set(true);

    const { email, password } = this.form.getRawValue();

    this.authService
      .login(email, password)
      .pipe(
        catchError(() => {
          this.errorMessage.set('Invalid email or password.');
          return of(LOGIN_FAILED);
        }),
        finalize(() => this.submitting.set(false)),
      )
      .subscribe((result) => {
        if (result === LOGIN_FAILED) {
          return;
        }

        if (this.authService.isAdmin()) {
          void this.router.navigate(['/']);
          return;
        }

        this.authService.logout();
        this.errorMessage.set('This account does not have admin access.');
      });
  }
}
