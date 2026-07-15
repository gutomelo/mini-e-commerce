import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { PageEvent } from '@angular/material/paginator';

import { DataTable, DataTableColumn } from './data-table';

interface Product {
  id: string;
  name: string;
  price: number;
}

const products: Product[] = [
  { id: '1', name: 'Widget', price: 9.99 },
  { id: '2', name: 'Gadget', price: 19.99 },
];

const columns: DataTableColumn<Product>[] = [
  { key: 'name', label: 'Name' },
  { key: 'price', label: 'Price' },
];

@Component({
  selector: 'app-data-table-host',
  imports: [DataTable],
  template: `<app-data-table
    [columns]="columns"
    [rows]="rows"
    [total]="total"
    (pageChange)="onPageChange($event)"
    (rowClick)="onRowClick($event)"
  />`,
})
class DataTableHost {
  columns = columns;
  rows = products;
  total = products.length;
  lastPageEvent: PageEvent | undefined;
  lastClickedRow: Product | undefined;

  onPageChange(event: PageEvent): void {
    this.lastPageEvent = event;
  }

  onRowClick(row: Product): void {
    this.lastClickedRow = row;
  }
}

describe('DataTable', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DataTableHost, NoopAnimationsModule],
    });
  });

  it('renders a row per data item', () => {
    const fixture = TestBed.createComponent(DataTableHost);
    fixture.detectChanges();

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tr.data-table-row');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Widget');
    expect(rows[1].textContent).toContain('Gadget');
  });

  it('shows an empty message when there are no rows', () => {
    const fixture = TestBed.createComponent(DataTableHost);
    fixture.componentInstance.rows = [];
    fixture.detectChanges();

    const empty = (fixture.nativeElement as HTMLElement).querySelector('.data-table-empty');
    expect(empty?.textContent).toContain('No records to display.');
  });

  it('emits rowClick when a row is clicked', () => {
    const fixture = TestBed.createComponent(DataTableHost);
    fixture.detectChanges();

    const row: HTMLElement = (fixture.nativeElement as HTMLElement).querySelector(
      'tr.data-table-row',
    )!;
    row.click();

    expect(fixture.componentInstance.lastClickedRow).toEqual(products[0]);
  });

  it('emits pageChange with the Material PageEvent when the paginator advances a page', () => {
    const fixture = TestBed.createComponent(DataTableHost);
    fixture.componentInstance.total = 25;
    fixture.detectChanges();

    const nextPageButton: HTMLButtonElement = (fixture.nativeElement as HTMLElement).querySelector(
      'button[aria-label="Next page"]',
    )!;
    nextPageButton.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.lastPageEvent?.pageIndex).toBe(1);
  });
});
