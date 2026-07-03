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

  it('handles @for block with translate directive', () => {
    const html = `
@for (item of items; track item.id) {
  <span translate>Hello</span>
}
`;

    expect(
      UtilsI18nHtml.replaceTranslatePipieDirectiveTContext(html),
    ).toContain(`<span translate [translate-t]="t">`);
  });

  it('handles @else block with translate directive', () => {
    const html = `
@if (ready) {
  <p>Ready</p>
} @else {
  <p translate>Loading</p>
}
`;

    expect(
      UtilsI18nHtml.replaceTranslatePipieDirectiveTContext(html),
    ).toContain(`<p translate [translate-t]="t">`);
  });

  it('handles nested angular blocks', () => {
    const html = `
@if (items.length) {
  @for (item of items; track item.id) {
    <h4 translate>{{ item.title }}</h4>
  }
}
`;

    expect(
      UtilsI18nHtml.replaceTranslatePipieDirectiveTContext(html),
    ).toContain(`<h4 translate [translate-t]="t">`);
  });

  it('does not duplicate translate-t inside angular block', () => {
    const html = `
@if (visible) {
  <p translate [translate-t]="t">Hello</p>
}
`;

    expect(UtilsI18nHtml.replaceTranslatePipieDirectiveTContext(html)).toBe(
      html,
    );
  });

  it('handles translate pipe inside @let', () => {
    const html = `
@let title = 'Hello' | translate;
<h1>{{ title }}</h1>
`;

    expect(
      UtilsI18nHtml.replaceTranslatePipieDirectiveTContext(html),
    ).toContain(`@let title = 'Hello' | translate:t;`);
  });

  it('does not touch translate-looking text in normal attributes', () => {
    const html = `
<div
  data-test="translate"
  aria-label="please translate this"
  class="translate-x-4">
</div>
`;

    expect(UtilsI18nHtml.replaceTranslatePipieDirectiveTContext(html)).toBe(
      html,
    );
  });

  it('handles multiple translate directives', () => {
    const html = `
<p translate>One</p>
<span translate>Two</span>
`;

    const result = UtilsI18nHtml.replaceTranslatePipieDirectiveTContext(html);

    expect(result.match(/\[translate-t\]="t"/g)?.length).toBe(2);
  });

  it('handles translate directive with other attributes after it', () => {
    const html = `<p translate class="text-lg">Hello</p>`;

    expect(UtilsI18nHtml.replaceTranslatePipieDirectiveTContext(html)).toBe(
      `<p translate class="text-lg" [translate-t]="t">Hello</p>`,
    );
  });
});
