import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A bordered, definite-height frame for a live calendar.
 *
 * Every example needs this because the calendar fills the height it is given and does not
 * grow to fit its content — drop it in a container with `height: auto` and the grid
 * collapses to nothing. Giving each demo an explicit box makes the examples work and puts
 * the constraint somewhere a reader can see it.
 */
@Component({
  selector: 'demo-frame',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="frame">
      @if (label()) {
        <figcaption>
          <span>{{ label() }}</span>
          <ng-content select="[frame-actions]" />
        </figcaption>
      }
      <div class="body" [style.height.px]="height()">
        <ng-content />
      </div>
    </figure>
  `,
  styles: [
    `
      .frame {
        margin: 1.25rem 0;
        border: 1px solid var(--sc-border);
        border-radius: var(--doc-radius);
        overflow: hidden;
        background: var(--sc-bg);
      }
      figcaption {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
        padding: 0.45rem 0.75rem;
        background: var(--sc-bg-alt);
        border-bottom: 1px solid var(--sc-border-light);
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--sc-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .body {
        padding: 0 0.65rem;
        min-height: 0;
      }
    `,
  ],
})
export class DemoFrameComponent {
  readonly label = input<string>('Live');
  readonly height = input<number>(520);
}
