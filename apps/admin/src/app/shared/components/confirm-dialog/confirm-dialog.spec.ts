import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ConfirmDialog, ConfirmDialogData } from './confirm-dialog';

describe('ConfirmDialog', () => {
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  const data: ConfirmDialogData = {
    title: 'Delete product',
    message: 'This cannot be undone.',
    confirmLabel: 'Delete',
  };

  beforeEach(() => {
    dialogRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ConfirmDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
  });

  it('renders the title, message, and confirm label', () => {
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain(data.title);
    expect(text).toContain(data.message);
    expect(text).toContain('Delete');
  });

  it('closes with true when the confirm button is clicked', () => {
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    );
    buttons[buttons.length - 1].click();

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('closes with false when the cancel button is clicked', () => {
    const fixture = TestBed.createComponent(ConfirmDialog);
    fixture.detectChanges();

    const cancelButton: HTMLButtonElement = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    )!;
    cancelButton.click();

    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });
});
