import { Routes } from '@angular/router';

import { adminGuard } from './core/auth/admin.guard';
import { LoginPage } from './features/auth/login-page/login-page';
import { DashboardPage } from './features/dashboard/dashboard-page/dashboard-page';
import { AppShell } from './shared/layout/app-shell/app-shell';

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
 * Feature routes (products, categories, orders) are added as `children` by
 * later tasks in this phase.
 */
export const routes: Routes = [
  {
    path: 'login',
    component: LoginPage,
  },
  {
    path: '',
    component: AppShell,
    canActivate: [adminGuard],
    children: [{ path: '', component: DashboardPage, pathMatch: 'full' }],
  },
];
