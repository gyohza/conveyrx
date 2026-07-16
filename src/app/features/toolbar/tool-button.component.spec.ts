import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ToolButtonComponent } from './tool-button.component';

function setInputs(
  fixture: ReturnType<typeof TestBed.createComponent<ToolButtonComponent>>,
  inputs: Partial<{
    label: string;
    detail: string;
    cost: number | null;
    hotkey: string;
    affordable: boolean;
    docsUrl: string;
  }>,
): void {
  fixture.componentRef.setInput('label', inputs.label ?? 'map');
  fixture.componentRef.setInput('detail', inputs.detail ?? 'transforms items in a stream');
  fixture.componentRef.setInput('hotkey', inputs.hotkey ?? 'm');
  if (inputs.cost !== undefined) fixture.componentRef.setInput('cost', inputs.cost);
  if (inputs.affordable !== undefined)
    fixture.componentRef.setInput('affordable', inputs.affordable);
  if (inputs.docsUrl !== undefined) fixture.componentRef.setInput('docsUrl', inputs.docsUrl);
}

describe('ToolButtonComponent', () => {
  it('shows the label, detail, cost, and hotkey', () => {
    const fixture = TestBed.createComponent(ToolButtonComponent);
    setInputs(fixture, {
      label: 'map',
      detail: 'transforms items in a stream',
      cost: 70,
      hotkey: 'm',
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('map');
    expect(text).toContain('transforms items in a stream');
    expect(text).toContain('Ƶ70');
    expect(text).toContain('m');
  });

  it('keeps cost out of the truncated detail text so a long description never clips it', () => {
    const fixture = TestBed.createComponent(ToolButtonComponent);
    setInputs(fixture, { detail: 'starts a stream from an iterable', cost: 25 });
    fixture.detectChanges();

    const truncated = fixture.nativeElement.querySelector('.truncate') as HTMLElement;
    expect(truncated.textContent?.trim()).toBe('starts a stream from an iterable');
    expect(fixture.nativeElement.textContent).toContain('Ƶ25');
  });

  it('emits picked when the main button is clicked', () => {
    const fixture = TestBed.createComponent(ToolButtonComponent);
    setInputs(fixture, {});
    fixture.detectChanges();
    let pickedCount = 0;
    fixture.componentInstance.picked.subscribe(() => pickedCount++);

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();

    expect(pickedCount).toBe(1);
  });

  it('does not render a docs link when no docsUrl is given', () => {
    const fixture = TestBed.createComponent(ToolButtonComponent);
    setInputs(fixture, {});
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('a')).toBeNull();
  });

  it('renders a docs link pointing at the given URL, opening in a new tab', () => {
    const fixture = TestBed.createComponent(ToolButtonComponent);
    setInputs(fixture, { docsUrl: 'https://rxjs.dev/api/index/function/map' });
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.href).toBe('https://rxjs.dev/api/index/function/map');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });

  it("clicking the docs link doesn't also select the tool", () => {
    const fixture = TestBed.createComponent(ToolButtonComponent);
    setInputs(fixture, { docsUrl: 'https://rxjs.dev/api/index/function/map' });
    fixture.detectChanges();
    let pickedCount = 0;
    fixture.componentInstance.picked.subscribe(() => pickedCount++);

    (fixture.nativeElement.querySelector('a') as HTMLAnchorElement).click();

    expect(pickedCount).toBe(0);
  });

  it('disables the main button when unaffordable', () => {
    const fixture = TestBed.createComponent(ToolButtonComponent);
    setInputs(fixture, { affordable: false });
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('button') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });
});
