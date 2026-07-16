import { Overlay } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { ConfirmDialogService } from './confirm-dialog.service';

describe('ConfirmDialogService', () => {
  let service: ConfirmDialogService;
  let dialog: MatDialog;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NoopAnimationsModule],
      providers: [Overlay],
    });
    service = TestBed.inject(ConfirmDialogService);
    dialog = TestBed.inject(MatDialog);
  });

  it('resolves true when the dialog is confirmed', async () => {
    vi.spyOn(dialog, 'open').mockReturnValue({
      afterClosed: () => of(true),
    } as unknown as ReturnType<MatDialog['open']>);

    const result = await new Promise((resolve) => {
      service.confirm({ title: 'Delete product', message: 'Are you sure?' }).subscribe(resolve);
    });

    expect(result).toBe(true);
  });

  it('resolves false when the dialog is cancelled or dismissed', async () => {
    vi.spyOn(dialog, 'open').mockReturnValue({
      afterClosed: () => of(undefined),
    } as unknown as ReturnType<MatDialog['open']>);

    const result = await new Promise((resolve) => {
      service.confirm({ title: 'Delete category', message: 'Are you sure?' }).subscribe(resolve);
    });

    expect(result).toBe(false);
  });
});
