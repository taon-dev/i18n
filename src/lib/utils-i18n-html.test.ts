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
        params: null,
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
        params: {
          size: 'dialogData.applicationsOidsToRemove.length',
        },
        context: undefined,
      },
    ]);
  });

  it('extracts static strings from conditional translate pipe', () => {
    const html = `
    <span>{{ row.cutOffAtDaymax ? 'Yes' : 'No' | translate }}</span>
  `;

    expect(UtilsI18nHtml.extractGettextTranslateFromHtml(html).map(m => m.gettextString)).toEqual([
      'No',
    ]);
  });

  it('extracts both strings when translate pipe wraps conditional expression', () => {
    const html = `
      <span>{{ (row.cutOffAtDaymax ? 'Yes' : 'No') | translate }}</span>
    `;

    expect(UtilsI18nHtml.extractGettextTranslateFromHtml(html).map(m => m.gettextString)).toEqual([
      'Yes',
      'No',
    ]);
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
        params: null,
        context: undefined,
      },
    ]);
  });
});
