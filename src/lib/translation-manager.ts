//#region import
import { BehaviorSubject, tap } from 'rxjs';
import { GlobalStorage, UtilsI18n, _ } from 'tnp-core/src';

import type { Translation } from './translation';
//#endregion

//#region constants
const globalStorageKeyMainLanguage = 'taon-gettext-main-language';
export const defaultLangLocale: UtilsI18n.CommonLocaleCode = 'en-US';
//#endregion

export class TranslationManager {
  public instances = new Set<Translation>();

  //#region current global language
  public currentGlobalLanguage = defaultLangLocale;

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
        this.currentGlobalLanguage = currentGlobalLanguage;
      }),
    );
  //#endregion

  //#region available langs
  public availableLangs = _.cloneDeep(UtilsI18n.LangOptionArr);

  private availableLangsSrc = new BehaviorSubject(this.availableLangs);

  public readonly availableLangs$ = this.availableLangsSrc
    .asObservable()
    .pipe(tap(data => (this.availableLangs = data)));
  //#endregion

  //#region visible langs
  public visibleLanguages: UtilsI18n.CommonLocaleCode[] = [];

  private visibleLanguagesSrc = new BehaviorSubject(this.visibleLanguages);

  public readonly visibleLanguages$ = this.visibleLanguagesSrc
    .asObservable()
    .pipe(tap(data => (this.visibleLanguages = data)));
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

  //#region change global lang
  async changeGlobalLang(lang: UtilsI18n.CommonLocaleCode): Promise<void> {
    this.loadingLangsSubjectSrc.next(true);
    try {
      await Promise.all([...this.instances].map(c => c.changeFileLang(lang)));
    } catch (error) {
      console.error(error);
    }
    this.loadingLangsSubjectSrc.next(false);
  }
  //#endregion

  //#region get default file lang locale
  getGlobalFileLang = (): UtilsI18n.CommonLocaleCode => {
    let mainLocale: UtilsI18n.CommonLocaleCode = GlobalStorage.get(
      globalStorageKeyMainLanguage,
    );
    if (!mainLocale) {
      GlobalStorage.set<UtilsI18n.CommonLocaleCode>(
        globalStorageKeyMainLanguage,
        defaultLangLocale,
      );
      mainLocale = defaultLangLocale;
    }
    return mainLocale;
  };
  //#endregion
}
