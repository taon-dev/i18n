import { UtilsI18nHtml } from './utils-i18n-html';

describe('UtilsI18nHtml.replaceTranslatePipieDirectiveTContext', () => {
  it('adds translate-t to translate directive', () => {
    const html = `
<p translate>
  translation-app works!
</p>
`;

    expect(
      UtilsI18nHtml.replaceTranslatePipieDirectiveTContext(html),
    ).toContain(`<p translate [translate-t]="t">`);
  });

  it('does not duplicate translate-t', () => {
    const html = `
<p translate [translate-t]="t">
  translation-app works!
</p>
`;

    expect(UtilsI18nHtml.replaceTranslatePipieDirectiveTContext(html)).toBe(
      html,
    );
  });

  it('adds t to translate pipe', () => {
    const html = `
{{ 'translation-app works!' | translate }}
`;

    expect(
      UtilsI18nHtml.replaceTranslatePipieDirectiveTContext(html),
    ).toContain(`{{ 'translation-app works!' | translate:t }}`);
  });

  it('does not modify translate pipe with existing args', () => {
    const html = `
{{ 'translation-app works!' | translate:t }}
{{ 'hello' | translate:t:{ a: 1 } }}
`;

    expect(UtilsI18nHtml.replaceTranslatePipieDirectiveTContext(html)).toBe(
      html,
    );
  });

  it('handles directive and pipe together', () => {
    const html = `
<code>
  <p
    translate>
    translation-app works!
  </p>
</code>
TRANSLATE PIPIE<br />
<code> {{ 'translation-app works!' | translate }} </code>
`;

    const result = UtilsI18nHtml.replaceTranslatePipieDirectiveTContext(html);

    expect(result).toContain(`translate [translate-t]="t">`);
    expect(result).toContain(`| translate:t`);
  });

  it('handles self closing tags', () => {
    const html = `<input translate />`;

    expect(UtilsI18nHtml.replaceTranslatePipieDirectiveTContext(html)).toBe(
      `<input translate  [translate-t]="t"/>`,
    );
  });

  it('Should handle angular stuff', () => {
    const html = `

    <ng-template #loadingVideos>
  @if (stateService.isLoadingVideos$ | async) {
    <div class="p-4">
      <h3
        class="w-full"
        translate>
        Please wait...
      </h3>
      <mat-progress-bar mode="indeterminate" />
    </div>
  }
</ng-template>

    `;

    expect(
      UtilsI18nHtml.replaceTranslatePipieDirectiveTContext(html),
    ).to.includes(`[translate-t]="t"`);
  });

  it('Should not replace when in class', () => {
    const html = ` <button
    mat-icon-button
    class="absolute right-4 top-1/2 z-20 -translate-y-1/2 text-white"
    (click)="next()">
    <mat-icon>chevron_right</mat-icon>
  </button>`;

    expect(UtilsI18nHtml.replaceTranslatePipieDirectiveTContext(html)).to.be.eq(
      html,
    );
  });
});
