import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TutorialLogComponent } from './tutorial-log.component';
import { OnboardingService } from '../../core/services/onboarding.service';
import { UiStateService } from '../../core/services/ui-state.service';

describe('TutorialLogComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lists only milestones that have actually triggered', () => {
    const fixture = TestBed.createComponent(TutorialLogComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Welcome');
    expect(text).toContain('Pick your source');
    expect(text).not.toContain('Transform it');
  });

  it('expanding an entry shows its body and marks it seen', () => {
    const onboarding = TestBed.inject(OnboardingService);
    const fixture = TestBed.createComponent(TutorialLogComponent);
    fixture.detectChanges();

    const entryButton: HTMLButtonElement = fixture.nativeElement.querySelector(
      'button[data-milestone-id="welcome"]',
    );
    entryButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('automated extraction rig');
    expect(onboarding.log().find((m) => m.id === 'welcome')?.seen).toBe(true);
  });

  it('closes via the close button', () => {
    const ui = TestBed.inject(UiStateService);
    ui.tutorialLogOpen.set(true);
    const fixture = TestBed.createComponent(TutorialLogComponent);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[aria-label="Close"]').click();

    expect(ui.tutorialLogOpen()).toBe(false);
  });
});
