import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { HelpDialogComponent } from './help-dialog.component';
import { UiStateService } from '../../core/services/ui-state.service';

describe('HelpDialogComponent', () => {
  it('explains the blocks and controls in an accessible dialog', () => {
    const fixture = TestBed.createComponent(HelpDialogComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="dialog"]')).toBeTruthy();
    const text = element.textContent ?? '';
    for (const expected of [
      'pipe',
      'map',
      'Sell',
      'RxJS',
      'backpressure',
      'subscribe',
      'Carbon',
      'Diamond',
      'Ice',
      'Cursor',
      'Delete',
    ]) {
      expect(text).toContain(expected);
    }
    expect(text).not.toContain('rotate');
    expect(text).not.toContain('undefined');
  });

  it('closes when the start button is clicked', () => {
    const ui = TestBed.inject(UiStateService);
    const fixture = TestBed.createComponent(HelpDialogComponent);
    fixture.detectChanges();

    const start = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Start'),
    )!;
    start.click();

    expect(ui.helpOpen()).toBe(false);
  });
});
