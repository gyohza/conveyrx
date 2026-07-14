import { Component } from '@angular/core';
import { version } from '../../../../package.json';

export function isBetaVersion(version: string): boolean {
  return version.split('.')[0] === '0';
}

@Component({
  selector: 'app-footer',
  template: `
    <footer
      class="flex h-6 shrink-0 items-center justify-center border-t border-slate-800 bg-slate-950/90 text-[11px] text-slate-500"
    >
      v{{ version }}{{ isBeta ? ' · beta' : '' }}
    </footer>
  `,
})
export class FooterComponent {
  protected readonly version = version;
  protected readonly isBeta = isBetaVersion(version);
}
