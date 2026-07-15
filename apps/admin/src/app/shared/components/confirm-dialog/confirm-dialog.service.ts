import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, map } from 'rxjs';

import { ConfirmDialog, ConfirmDialogData } from './confirm-dialog';

/**
 * Injectable helper that opens `ConfirmDialog` and reduces the result to a
 * plain `Observable<boolean>` (`true` if confirmed, `false` if cancelled or
 * dismissed). Used ahead of destructive actions such as product/category
 * delete.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly dialog = inject(MatDialog);

  confirm(data: ConfirmDialogData): Observable<boolean> {
    const dialogRef = this.dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
      data,
      width: '24rem',
    });

    return dialogRef.afterClosed().pipe(map((confirmed) => confirmed === true));
  }
}
