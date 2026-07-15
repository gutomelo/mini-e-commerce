import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, input, output } from '@angular/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';

/**
 * Column definition for `DataTable`.
 *
 * - `key`: property name read off each row for the default cell rendering.
 * - `label`: column header text.
 * - `cellTemplate`: optional custom cell content (e.g. a status chip, an
 *   inline action button); when omitted, the cell renders `row[key]` as text.
 */
export interface DataTableColumn<T> {
  readonly key: Extract<keyof T, string>;
  readonly label: string;
  readonly cellTemplate?: TemplateRef<{ $implicit: T }>;
}

/**
 * Generic, reusable paginated table wrapper around Material's `MatTable` +
 * `MatPaginator`. Designed to be driven by a parent component/service holding
 * the actual data-fetching logic (list results, total count, current
 * page/limit) — this component only renders and emits page-change requests.
 *
 * Intended for the products/categories/orders list screens: column
 * definitions with a label+key or a custom cell template, an optional row
 * click (for navigating to a detail page), and pagination.
 */
@Component({
  selector: 'app-data-table',
  imports: [MatTableModule, MatPaginatorModule, NgTemplateOutlet],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTable<T> {
  /** Column definitions, in display order. */
  readonly columns = input.required<readonly DataTableColumn<T>[]>();
  /** Rows for the current page. */
  readonly rows = input<readonly T[]>([]);
  /** Total number of rows across all pages (drives the paginator's range label). */
  readonly total = input(0);
  /** Zero-based index of the current page. */
  readonly pageIndex = input(0);
  /** Number of rows per page. */
  readonly pageSize = input(10);
  /** Selectable page sizes shown in the paginator. */
  readonly pageSizeOptions = input<readonly number[]>([10, 25, 50]);
  /** Emitted whenever the user changes page or page size. */
  readonly pageChange = output<PageEvent>();
  /** Emitted when a row is clicked, for navigation to a detail page. */
  readonly rowClick = output<T>();

  protected get displayedColumns(): string[] {
    return this.columns().map((column) => column.key);
  }

  protected onPageChange(event: PageEvent): void {
    this.pageChange.emit(event);
  }

  protected onRowClick(row: T): void {
    this.rowClick.emit(row);
  }

  protected cellValue(row: T, column: DataTableColumn<T>): unknown {
    return row[column.key];
  }
}
