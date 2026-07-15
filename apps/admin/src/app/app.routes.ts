import { Component } from '@angular/core';
import { Routes } from '@angular/router';

import { adminGuard } from './core/auth/admin.guard';
import { AppShell } from './shared/layout/app-shell/app-shell';

/**
 * TEMPORARY placeholder for the `/login` page.
 *
 * The Angular auth feature task (next in this phase) replaces this with the
 * real Material login form calling `AuthService.login`. It is defined inline
 * here — rather than as its own feature file — so it is obvious it is a
 * throwaway stand-in whose only job is to keep `/login` a valid, compiling
 * route until that task lands.
 */
@Component({
  selector: 'app-login-placeholder',
  template: `<p>Login page placeholder — replaced by the auth feature task.</p>`,
})
class LoginPagePlaceholder {}

/**
 * Routing skeleton for the admin SPA.
 *
 * `/login` is a standalone route rendered outside the app shell (no nav/
 * toolbar chrome makes sense before a user is authenticated). Every other
 * route is nested under `AppShell`, used here as a routed layout component:
 * `AppShell` renders the toolbar/sidenav chrome once and a `<router-outlet>`
 * for its children, and `adminGuard` on that parent route gates the entire
 * subtree behind an authenticated `ADMIN` session in one place, instead of
 * being repeated on every individual feature route.
 *
 * Feature routes (dashboard, products, categories, orders) are added as
 * `children` by later tasks in this phase.
 */
export const routes: Routes = [
  {
    path: 'login',
    component: LoginPagePlaceholder,
  },
  {
    path: '',
    component: AppShell,
    canActivate: [adminGuard],
    children: [],
  },
];
