import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppShell],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
  });

  it('creates the shell', () => {
    const fixture = TestBed.createComponent(AppShell);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders a nav link for every feature route', () => {
    const fixture = TestBed.createComponent(AppShell);
    fixture.detectChanges();
    const links = fixture.nativeElement.querySelectorAll('a[mat-list-item]');
    expect(links.length).toBe(4);
  });

  it('logs out and navigates to /login when the logout button is clicked', () => {
    const fixture = TestBed.createComponent(AppShell);
    const authService = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);
    const logoutSpy = vi.spyOn(authService, 'logout');
    const navigateSpy = vi.spyOn(router, 'navigate');
    fixture.detectChanges();

    const logoutButton: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    logoutButton.click();

    expect(logoutSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});
