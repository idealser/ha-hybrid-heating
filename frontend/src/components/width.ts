// The host's width in pixels, for SVG drawn in its own coordinates (redraws when the card resizes).
import type { ReactiveController, ReactiveControllerHost } from 'lit';

export class WidthController implements ReactiveController {
  width = 0;
  private observer: ResizeObserver | undefined;

  constructor(private readonly host: ReactiveControllerHost & HTMLElement) {
    host.addController(this);
  }

  hostConnected(): void {
    this.observer = new ResizeObserver(([entry]) => {
      const w = Math.round(entry?.contentRect.width ?? 0);
      // Redraw on the next frame: redrawing inside the callback changes the height, and the observer
      // would report again in the same frame ("ResizeObserver loop completed with undelivered notifications").
      if (w && w !== this.width)
        requestAnimationFrame(() => {
          this.width = w;
          this.host.requestUpdate();
        });
    });
    this.observer.observe(this.host);
  }

  hostDisconnected(): void {
    this.observer?.disconnect();
  }
}
