import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';

interface NavLink {
  readonly label: string;
  readonly path: string;
  readonly icon: string;
}

/** Sidenav links to each feature route. Paths are plain strings (not typed routes) since the routes are wired incrementally across later tasks in this phase. */
const NAV_LINKS: readonly NavLink[] = [
  { label: 'Dashboard', path: '/', icon: 'dashboard' },
  { label: 'Products', path: '/products', icon: 'inventory_2' },
  { label: 'Categories', path: '/categories', icon: 'category' },
  { label: 'Orders', path: '/orders', icon: 'receipt_long' },
];

/**
 * Application chrome: a Material toolbar (title, current user, logout) and a
 * sidenav with links to every admin feature. Renders only chrome plus a
 * `<router-outlet>` for routed feature content — no business logic lives
 * here. Used as a routed layout component wrapping the authenticated routes
 * (see `app.routes.ts`), so `/login` can be rendered outside of it.
 */
@Component({
  selector: 'app-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly navLinks = NAV_LINKS;
  protected readonly user = this.authService.user;

  protected logout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }
}
