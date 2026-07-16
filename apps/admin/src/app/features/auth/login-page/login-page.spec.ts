import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let authService: {
    login: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    isAdmin: ReturnType<typeof vi.fn>;
  };
  let router: Router;

  beforeEach(() => {
    authService = {
      login: vi.fn(),
      logout: vi.fn(),
      isAdmin: vi.fn().mockReturnValue(false),
    };

    TestBed.configureTestingModule({
      imports: [LoginPage, NoopAnimationsModule],
      providers: [{ provide: AuthService, useValue: authService }, provideRouter([])],
    });

    fixture = TestBed.createComponent(LoginPage);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  function fillForm(email: string, password: string): void {
    const element = fixture.nativeElement as HTMLElement;
    const emailInput: HTMLInputElement = element.querySelector('input[type="email"]')!;
    const passwordInput: HTMLInputElement = element.querySelector('input[type="password"]')!;

    emailInput.value = email;
    emailInput.dispatchEvent(new Event('input'));
    passwordInput.value = password;
    passwordInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function submitForm(): void {
    const form: HTMLFormElement = (fixture.nativeElement as HTMLElement).querySelector('form')!;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('navigates to / after a successful ADMIN login', () => {
    authService.login.mockReturnValue(of(undefined));
    authService.isAdmin.mockReturnValue(true);
    fixture.detectChanges();

    fillForm('admin@example.com', 'password123');
    submitForm();

    expect(authService.login).toHaveBeenCalledWith('admin@example.com', 'password123');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('logs out and shows a rejection message when a non-admin account logs in successfully', () => {
    authService.login.mockReturnValue(of(undefined));
    authService.isAdmin.mockReturnValue(false);
    fixture.detectChanges();

    fillForm('customer@example.com', 'password123');
    submitForm();

    expect(authService.logout).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('This account does not have admin access.');
  });

  it('shows an invalid-credentials message when the login request fails', () => {
    authService.login.mockReturnValue(throwError(() => new Error('401 Unauthorized')));
    fixture.detectChanges();

    fillForm('user@example.com', 'wrong-password');
    submitForm();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(authService.logout).not.toHaveBeenCalled();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Invalid email or password.');
  });

  it('does not call login when the form is empty or invalid', () => {
    fixture.detectChanges();

    submitForm();

    expect(authService.login).not.toHaveBeenCalled();

    fillForm('not-an-email', 'password123');
    submitForm();

    expect(authService.login).not.toHaveBeenCalled();
  });
});
