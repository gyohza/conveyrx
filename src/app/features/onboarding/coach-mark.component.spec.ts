import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachMarkComponent } from './coach-mark.component';
import { BuildToolService } from '../../core/services/build-tool.service';
import { GameViewportService } from '../../core/services/game-viewport.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { SimEngineService } from '../../core/services/sim-engine.service';
import { STAGE1_MINES } from '../../../sim/content/stage1-layout';

describe('CoachMarkComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the active milestone title and body', () => {
    const fixture = TestBed.createComponent(CoachMarkComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Welcome');
    expect(text).toContain('automated extraction rig');
  });

  it('renders nothing once every milestone has been dismissed', () => {
    const onboarding = TestBed.inject(OnboardingService);
    for (const milestone of onboarding.log()) {
      onboarding.dismiss(milestone.id);
    }
    const fixture = TestBed.createComponent(CoachMarkComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
  });

  it('dismissing the active milestone advances to the next pending one', () => {
    const fixture = TestBed.createComponent(CoachMarkComponent);
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    button.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Pick your source');
  });

  it("positions itself and cuts a spotlight hole against the starting mine's on-screen rect", () => {
    const viewport = TestBed.inject(GameViewportService);
    const rect = new DOMRect(200, 300, 40, 40);
    vi.spyOn(viewport, 'gridCellRect').mockReturnValue(rect);
    const fixture = TestBed.createComponent(CoachMarkComponent);

    fixture.detectChanges();

    const bubble: HTMLElement = fixture.nativeElement.querySelector('[role="status"]');
    expect(parseFloat(bubble.style.top)).toBeGreaterThan(rect.bottom - 1);
    const bands = fixture.nativeElement.querySelectorAll('.bg-black\\/70');
    expect(bands.length).toBe(4);
  });

  it('renders no spotlight bands when the anchor cannot be resolved', () => {
    const onboarding = TestBed.inject(OnboardingService);
    onboarding.dismiss('welcome');
    const fixture = TestBed.createComponent(CoachMarkComponent);

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(onboarding.active()?.id).toBe('select-source-tool');
    expect(fixture.nativeElement.querySelectorAll('.bg-black\\/70').length).toBe(0);
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
  });

  it('shows "Got it" for a dismissible, information-only milestone', () => {
    const fixture = TestBed.createComponent(CoachMarkComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button')?.textContent).toContain('Got it');
  });

  it('hides "Got it" for a scripted step that must be completed by acting, not by dismissing', () => {
    const onboarding = TestBed.inject(OnboardingService);
    onboarding.dismiss('welcome');
    const fixture = TestBed.createComponent(CoachMarkComponent);

    fixture.detectChanges();

    expect(onboarding.active()?.id).toBe('select-source-tool');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('renders no darkened bands for a { spotlight: false } milestone, even though its anchor resolves', () => {
    const onboarding = TestBed.inject(OnboardingService);
    const tools = TestBed.inject(BuildToolService);
    const engine = TestBed.inject(SimEngineService);
    const viewport = TestBed.inject(GameViewportService);
    vi.spyOn(viewport, 'gridCellRect').mockReturnValue(new DOMRect(200, 300, 40, 40));
    onboarding.dismiss('welcome');
    tools.select('source');
    TestBed.flushEffects();
    engine.place({ type: 'source' }, STAGE1_MINES[0].position);
    TestBed.flushEffects();
    onboarding.dismiss('subscriber-intro');
    tools.select('conveyor');
    TestBed.flushEffects();
    expect(onboarding.active()?.id).toBe('connect-source-to-subscriber');

    const fixture = TestBed.createComponent(CoachMarkComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.bg-black\\/70').length).toBe(0);
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeTruthy();
  });
});
