import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { FooterComponent, isBetaVersion } from './footer.component';
import { version } from '../../../../package.json';

describe('isBetaVersion', () => {
  it('treats a 0.x version as beta', () => {
    expect(isBetaVersion('0.4.0')).toBe(true);
  });

  it('treats a 1.x+ version as not beta', () => {
    expect(isBetaVersion('1.0.0')).toBe(false);
  });
});

describe('FooterComponent', () => {
  it('shows the current package version', () => {
    const fixture = TestBed.createComponent(FooterComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(version);
  });

  it('labels a beta version explicitly', () => {
    const fixture = TestBed.createComponent(FooterComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('beta');
  });
});
