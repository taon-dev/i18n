import { UtilsI18nHtml } from './utils-i18n-html';

describe('UtilsI18nHtml.extractFromHtml', () => {
  it('extracts element with translate attribute', () => {
    const html = `
      <span translate>
        You have errors in this form. Please click 'Edit incorrect data' to jump to the section and input correct data.
      </span>
    `;

    expect(UtilsI18nHtml.extractGettextTranslateFromHtml(html)).toEqual([
      {
        lineNumber: 2,
        gettextString:
          "You have errors in this form. Please click 'Edit incorrect data' to jump to the section and input correct data.",
        // params: null,
        context: undefined,
      },
    ]);
  });

  it('extracts translate attribute with translate params', () => {
    const html = `
      <p
        *ngSwitchDefault
        translate
        [translate-params]="{
          size: dialogData.applicationsOidsToRemove.length
        }"
      >
        Do you want to remove [[ size ]] applications?
      </p>
    `;

    expect(UtilsI18nHtml.extractGettextTranslateFromHtml(html)).toEqual([
      {
        lineNumber: 2,
        gettextString: 'Do you want to remove [[ size ]] applications?',
        // params: {
        //   size: 'dialogData.applicationsOidsToRemove.length',
        // },
        context: undefined,
      },
    ]);
  });

  it('extracts static strings from conditional translate pipe', () => {
    const html = `
    <span>{{ row.cutOffAtDaymax ? 'Yes' : 'No' | translate }}</span>
  `;

    expect(
      UtilsI18nHtml.extractGettextTranslateFromHtml(html).map(
        m => m.gettextString,
      ),
    ).toEqual(['No']);
  });

  it('extracts both strings when translate pipe wraps conditional expression', () => {
    const html = `
      <span>{{ (row.cutOffAtDaymax ? 'Yes' : 'No') | translate }}</span>
    `;

    expect(
      UtilsI18nHtml.extractGettextTranslateFromHtml(html).map(
        m => m.gettextString,
      ),
    ).toEqual(['Yes', 'No']);
  });

  it('skips variable-only translate pipe', () => {
    const html = `
      <input placeholder="{{ repsTextFilterPlaceholder | translate }}">
    `;

    expect(UtilsI18nHtml.extractGettextTranslateFromHtml(html)).toEqual([]);
  });

  it('extracts static string translate pipe', () => {
    const html = `
      <span>{{ 'something to tranlaste ' | translate }}</span>
    `;

    expect(UtilsI18nHtml.extractGettextTranslateFromHtml(html)).toEqual([
      {
        lineNumber: 2,
        gettextString: 'something to tranlaste',
        // params: null,
        context: undefined,
      },
    ]);
  });
});

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
});

describe('UtilsI18nHtml.extractGettextTranslateFromHtml - t.gettext()', () => {
  it('extracts simple t.gettext from interpolation', () => {
    const html = `
      <span>{{ t.gettext('translation-app works!') }}</span>
    `;

    expect(UtilsI18nHtml.extractGettextTranslateFromHtml(html)).toEqual([
      {
        lineNumber: 2,
        gettextString: 'translation-app works!',
        // params: null,
        context: undefined,
      },
    ]);
  });

  it('extracts t.gettext with null params and context', () => {
    const html = `
      <span>{{ t.gettext('translation-app works!', null, 'context jakis') }}</span>
    `;

    expect(UtilsI18nHtml.extractGettextTranslateFromHtml(html)).toEqual([
      {
        lineNumber: 2,
        gettextString: 'translation-app works!',
        // params: null,
        context: 'context jakis',
      },
    ]);
  });

  it('extracts t.gettext with params and context', () => {
    const html = `
      <span>{{ t.gettext('heloo [[ aa ]]!', { aa: somethingFromComponent }, 'context jakis') }}</span>
    `;

    expect(UtilsI18nHtml.extractGettextTranslateFromHtml(html)).toEqual([
      {
        lineNumber: 2,
        gettextString: 'heloo [[ aa ]]!',
        // params: null,
        context: 'context jakis',
      },
    ]);
  });

  it('extracts multiple gettext calls from one interpolation', () => {
    const html = `
      <span>{{ t.gettext('Yes') + ' / ' + t.gettext('No') }}</span>
    `;

    expect(
      UtilsI18nHtml.extractGettextTranslateFromHtml(html).map(
        x => x.gettextString,
      ),
    ).toEqual(['Yes', 'No']);
  });

  it('extracts nested property chain ending with gettext', () => {
    const html = `
      <span>{{ something.deep.t.gettext('Deep hello') }}</span>
    `;

    expect(UtilsI18nHtml.extractGettextTranslateFromHtml(html)).toEqual([
      {
        lineNumber: 2,
        gettextString: 'Deep hello',
        // params: null,
        context: undefined,
      },
    ]);
  });

  it('skips dynamic gettext string', () => {
    const html = `
      <span>{{ t.gettext(dynamicLabel) }}</span>
    `;

    expect(UtilsI18nHtml.extractGettextTranslateFromHtml(html)).toEqual([]);
  });

  it('extracts gettext with double quotes', () => {
    const html = `
      <span>{{ t.gettext("Double quote text") }}</span>
    `;

    expect(UtilsI18nHtml.extractGettextTranslateFromHtml(html)).toEqual([
      {
        lineNumber: 2,
        gettextString: 'Double quote text',
        // params: null,
        context: undefined,
      },
    ]);
  });

  it('extracts gettext with backticks without interpolation', () => {
    const html = `
      <span>{{ t.gettext(\`Backtick text\`) }}</span>
    `;

    expect(UtilsI18nHtml.extractGettextTranslateFromHtml(html)).toEqual([
      {
        lineNumber: 2,
        gettextString: 'Backtick text',
        // params: null,
        context: undefined,
      },
    ]);
  });

  it('should extract select lang', () => {
    const html = `<span>{{ t.gettext('Select Language') }}</span>`;

    expect(UtilsI18nHtml.extractGettextTranslateFromHtml(html)).toEqual([
      {
        lineNumber: 1,
        gettextString: 'Select Language',
        // params: null,
        context: undefined,
      },
    ]);
  });

  it('should extract trasnlated please wait', () => {
    const html = `
     <div class="p-4">
      <h3 class="w-full" translate>Please wait...</h3>
      <mat-progress-bar mode="indeterminate" />
    </div>
    `;

    expect(UtilsI18nHtml.extractGettextTranslateFromHtml(html)).toEqual([
      {
        lineNumber: 3,
        gettextString: 'Please wait...',
        // params: null,
        context: undefined,
      },
    ]);
  });

  it('should extract file with angular syntax', () => {
    const html = `


  @if (stateService.isLoadingVideos$ | async) {
    <div class="p-4">
      <h3 class="w-full" translate >Please wait...</h3>
      <mat-progress-bar mode="indeterminate" />
    </div>
  }

    `;

    expect(UtilsI18nHtml.extractGettextTranslateFromHtml(html).length).be.above(
      0,
    );
  });

  it('should extract file with angular block syntax', () => {
    const html = `
  @if (stateService.isLoadingVideos$ | async) {
    <div class="p-4">
      <h3 class="w-full" translate>Please wait...</h3>
      <mat-progress-bar mode="indeterminate" />
    </div>
  }
`;

    expect(UtilsI18nHtml.extractGettextTranslateFromHtml(html)).toEqual([
      {
        lineNumber: 4,
        gettextString: 'Please wait...',
        context: undefined,
      },
    ]);
  });

  // it('skips gettext with template interpolation', () => {
  //   const html = `
  //     <span>{{ t.gettext(\`Hello \${name}\`) }}</span>
  //   `;

  //   expect(UtilsI18nHtml.extractGettextTranslateFromHtml(html)).toEqual([]);
  // });
});
