//#region import
import { BehaviorSubject, filter, map, tap } from 'rxjs';
import { GlobalStorage, UtilsI18n, _ } from 'tnp-core/src';

import type { Translation } from './translation';
//#endregion

//#region constants
const globalStorageKeyMainLanguage = 'taon-gettext-main-language';
const globalTaonLanguageLocalKeyLocalStor = 'taon-language-local';

//#endregion

export class TranslationManager {
  public instances = new Set<Translation>();

  constructor() {
    // console.log(`[i18] Default lang: ${this.defaultLangLocale}`);
  }

  //#region current global language
  private defaultLangLocale: UtilsI18n.CommonLocaleCode = (() => {
    //#region @browser
    return (
      (localStorage.getItem(
        globalTaonLanguageLocalKeyLocalStor,
      ) as UtilsI18n.CommonLocaleCode) ||
      (UtilsI18n.detectLocale() as UtilsI18n.CommonLocaleCode)
    );
    //#endregion
    return UtilsI18n.defaultLangLocale;
  })();

  private _currentGlobalLanguage = this
    .defaultLangLocale as UtilsI18n.CommonLocaleCode;

  public get currentGlobalLanguage(): UtilsI18n.CommonLocaleCode {
    return this._currentGlobalLanguage;
  }

  public set currentGlobalLanguage(v: UtilsI18n.CommonLocaleCode) {
    this._currentGlobalLanguage = v;
    this.currentGlobalLanguageSrc.next(v);
  }

  private currentGlobalLanguageSrc = new BehaviorSubject(
    this.currentGlobalLanguage,
  );

  public readonly currentGlobalLanguage$ = this.currentGlobalLanguageSrc
    .asObservable()
    .pipe(
      tap(currentGlobalLanguage => {
        GlobalStorage.set<UtilsI18n.CommonLocaleCode>(
          globalStorageKeyMainLanguage,
          currentGlobalLanguage,
        );
        // console.log(`Update from subject ${currentGlobalLanguage}`);
      }),
    );
  //#endregion

  //#region available langs
  public availableLangs = _.cloneDeep(UtilsI18n.LangOptionArr);

  private availableLangsSrc = new BehaviorSubject(this.availableLangs);

  public readonly availableLangs$ = this.availableLangsSrc.asObservable().pipe(
    map(f => {
      if (this.visibleLanguages.length > 0) {
        console.log('Filtering langs')
        return f.filter(a => this.visibleLanguages.includes(a.code));
      }
      return f;
    }),
  );
  //#endregion

  //#region visible langs
  public _visibleLanguages: UtilsI18n.CommonLocaleCode[] = [];

  public get visibleLanguages(): UtilsI18n.CommonLocaleCode[] {
    return this._visibleLanguages;
  }

  public set visibleLanguages(v: UtilsI18n.CommonLocaleCode[]) {
    if (this.pernamentLanguage) {
      v = v.filter(a =>
        [this.pernamentLanguage].includes(a),
      );
    }

    this._visibleLanguages = v;
    this.visibleLanguagesSrc.next(v);
    this.availableLangsSrc.next(this.availableLangs);
  }

  private visibleLanguagesSrc = new BehaviorSubject(this.visibleLanguages);

  public readonly visibleLanguages$ = this.visibleLanguagesSrc.asObservable();
  //#endregion

  //#region loading langs subject
  /**
   * TODO
   */
  private loadingLangsSubjectSrc = new BehaviorSubject(false);

  /**
   * TODO
   */
  public readonly isLoadingLangs$ = this.loadingLangsSubjectSrc.asObservable();
  //#endregion

  //#region global singleton
  private static _instance: TranslationManager;

  static get Instance(): TranslationManager {
    if (!this._instance) {
      this._instance = new TranslationManager();
    }
    return this._instance;
  }
  //#endregion

  public readonly pernamentLanguage: UtilsI18n.CommonLocaleCode | null = null;

  public setOneLanguagePernament(lang: UtilsI18n.CommonLocaleCode): void {
    console.info(`Setting pernament language to ${lang}`);
    if (this.pernamentLanguage) {
      console.log('You are trying to set again pernament language');
      return;
    }
    this.visibleLanguages = [lang];
    // @ts-ignore
    this.pernamentLanguage = lang;
    void this.changeGlobalLang(lang);
  }

  //#region change global lang
  async changeGlobalLang(lang: UtilsI18n.CommonLocaleCode): Promise<void> {
    this.loadingLangsSubjectSrc.next(true);

    this.currentGlobalLanguage = lang;
    localStorage.setItem(globalTaonLanguageLocalKeyLocalStor, lang);
    try {
      await Promise.all(
        [...this.instances].map(c => c.useGlobalFileLang(lang)),
      );
    } catch (error) {
      console.error(error);
    }
    this.loadingLangsSubjectSrc.next(false);
    // console.info('Done changing language');
  }
  //#endregion
}
