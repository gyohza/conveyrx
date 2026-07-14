import { Component, OnInit, inject } from '@angular/core';
import { GameCanvasComponent } from './features/game-canvas/game-canvas.component';
import { HelpDialogComponent } from './features/help/help-dialog.component';
import { StatusStripComponent } from './features/hud/status-strip.component';
import { TopBarComponent } from './features/hud/top-bar.component';
import { RxSidebarComponent } from './features/rx-sidebar/rx-sidebar.component';
import { ToolbarComponent } from './features/toolbar/toolbar.component';
import { SimClockService } from './core/services/sim-clock.service';
import { UiStateService } from './core/services/ui-state.service';

@Component({
  selector: 'app-root',
  imports: [
    GameCanvasComponent,
    HelpDialogComponent,
    StatusStripComponent,
    RxSidebarComponent,
    ToolbarComponent,
    TopBarComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly clock = inject(SimClockService);
  protected readonly ui = inject(UiStateService);

  ngOnInit(): void {
    this.clock.start();
  }
}
