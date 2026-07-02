//#region imports
import {
  ChangeDetectorRef,
  inject,
  signal,
  WritableSignal,
} from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { GlobalStorage, UtilsI18n, _ } from 'tnp-core/src';

import { TranslationManager } from './translation-manager';
import {
  TaonTranslationsMapImport,
  TranslationBinding,
  TranslationLookup,
  TranslationParams,
} from './translation.models';
import type { UtilsPoFile } from './utils-po-file';

//#endregion

//#region translation class
export class Translation {
  static manager = TranslationManager.Instance;

  //#region static for
  static for(
    fileRelativePath: string,
    langImportMap: TaonTranslationsMapImport,
  ): Translation {
    return new Translation(
      fileRelativePath,
      Translation.manager.currentGlobalLanguage,
      langImportMap,
    );
  }
  //#endregion

  //#region fields

  //#region @browser
  private cdr?: ChangeDetectorRef;

  //#endregion

  private lookup: TranslationLookup = {};

  private readonly loadingSubject = new BehaviorSubject(false);

  public readonly isLoadingLang$ = this.loadingSubject.asObservable();

  private loading?: Promise<void>;

  private loadedLang?: UtilsI18n.CommonLocaleCode;

  private readonly bindings = new Set<TranslationBinding>();

  private useGlobalLangFile = true;
  //#endregion

  //#region constructor
  private constructor(
    protected fileRelativePath: string,
    protected localFileLang: UtilsI18n.CommonLocaleCode,
    protected langImportMap: TaonTranslationsMapImport,
  ) {
    if (!Translation.manager.instances.has(this)) {
      Translation.manager.instances.add(this);
    }
  }
  //#endregion

  //#region for
  for(_classThis: object): Translation {
    //#region @browser
    if (this.useGlobalFileLang) {
      this.localFileLang = Translation.manager.currentGlobalLanguage;
      console.log(`Update on t.for() ${this.localFileLang}`)
    }
    try {
      this.cdr = inject(ChangeDetectorRef);
    } catch {
      // non-angular class/backend-safe
    }
    //#endregion
    void this.ensureLoaded();

    return this;
  }
  //#endregion

  //#region change file lang
  async changeFileLang(lang: UtilsI18n.CommonLocaleCode): Promise<void> {
    this.useGlobalLangFile = false;
    this.localFileLang = lang;
    await this.ensureLoaded(true);
    //#region @browser
    this.cdr?.markForCheck();
    //#endregion
  }
  //#endregion

  //#region use global file lang
  async useGlobalFileLang(lang: UtilsI18n.CommonLocaleCode): Promise<void> {
    this.useGlobalLangFile = true;
    await this.ensureLoaded(true);
    //#region @browser
    this.cdr?.markForCheck();
    //#endregion
  }
  //#endregion

  //#region gettext
  gettext = (
    text: string,
    params?: TranslationParams,
    context = '',
  ): string => {
    const key = this.key(text, context);
    const translated = this.lookup[key] ?? text;

    return this.interpolate(translated, params);
  };
  //#endregion

  //#region signal

  private createSignal(
    text: string,
    params?: TranslationParams,
    context = '',
  ): WritableSignal<string> {
    const s = signal<string>(this.gettext(text, params, context));

    this.bindings.add({
      text,
      params,
      context,
      update: value => s.set(value),
    });

    return s;
  }

  readonly signal = {
    gettext: (text: string, params?: TranslationParams, context?: string) =>
      this.createSignal(text, params, context),
  };
  //#endregion

  //#region $ obserable
  private createObservable(
    text: string,
    params?: TranslationParams,
    context = '',
  ): Observable<string> {
    const subject = new BehaviorSubject<string>(
      this.gettext(text, params, context),
    );

    this.bindings.add({
      text,
      params,
      context,
      update: value => subject.next(value),
    });

    return subject.asObservable();
  }

  readonly $ = {
    gettext: (text: string, params?: TranslationParams, context?: string) =>
      this.createObservable(text, params, context),
  };
  //#endregion

  //#region private methods / refresh bindings
  private refreshBindings(): void {
    for (const binding of this.bindings) {
      binding.update(
        this.gettextWithoutEnsureLoaded(
          binding.text,
          binding.params,
          binding.context ?? '',
        ),
      );
    }
  }
  //#endregion

  //#region private methods / gettextwithout ensure loadded

  translate(text: string, params?: TranslationParams, context = ''): string {
    return this.gettextWithoutEnsureLoaded(text, params, context);
  }

  private gettextWithoutEnsureLoaded(
    text: string,
    params?: TranslationParams,
    context = '',
  ): string {
    const key = this.key(text, context);
    const translated = this.lookup[key] ?? text;
    return this.interpolate(translated, params);
  }
  //#endregion

  //#region private methods / load
  private async load(): Promise<void> {
    this.loadingSubject.next(true);

    const files: UtilsI18n.GettextFile[] = [];
    const filesForTArr = Object.keys(this.langImportMap);
    for (const fileRelativePath of filesForTArr) {
      try {
        const loader =
          this.langImportMap[fileRelativePath]?.[this.localFileLang];

        if (!loader) {
          continue;
        }

        const modOrFile = await loader();
        const file = (modOrFile as any).default ?? modOrFile;

        files.push(file);
      } catch (err) {
        console.log(
          `[taon-i18n] Error loading language file ${fileRelativePath} `,
          err,
        );
      }
    }
    this.loadedLang = this.localFileLang;
    this.lookup = this.createLookup(files);

    this.refreshBindings();

    //#region @browser
    this.cdr?.markForCheck();
    //#endregion
    this.loadingSubject.next(false);
  }
  //#endregion

  //#region private methods / ensure loaded
  private async ensureLoaded(force = false): Promise<void> {
    if (this.useGlobalLangFile) {
      this.localFileLang = Translation.manager.currentGlobalLanguage;
    }

    if (!force && this.loadedLang === this.localFileLang) {
      return;
    }

    if (!force && this.loading) {
      return this.loading;
    }

    this.loading = this.load();

    try {
      await this.loading;
    } finally {
      this.loading = undefined;
    }
  }
  //#endregion

  //#region private methods / create lookup
  private createLookup(files: UtilsI18n.GettextFile[]): TranslationLookup {
    const lookup: TranslationLookup = {};

    for (const file of files) {
      for (const tag of file.tags ?? []) {
        if (!tag.translation) continue;
        lookup[this.key(tag.gettextString, tag.context ?? '')] =
          tag.translation;
      }
    }

    return lookup;
  }
  //#endregion

  //#region private methods / key
  private key(text: string, context = ''): string {
    return `${context}\u0004${text}`;
  }
  //#endregion

  //#region private methods / interpolate
  private interpolate(text: string, params?: Record<string, unknown>): string {
    // console.log(`Interpolate: ${text}, params:${params} localFileLang: ${this.localFileLang}`)
    if (!params) return text;

    return text.replace(/\[\[\s*([a-zA-Z0-9_$]+)\s*\]\]/g, (_, key) => {
      const value = params[key];
      return value === undefined || value === null ? '' : String(value);
    });
  }
  //#endregion
}
//#endregion

//#region EXMAPLE
/*
// import {Translation} from 'taon'

const t = Translation.for(Taon.__FILE_RELATIVE_PATH, Taon.LANG_IMPORT_MAP); // in runtime replaced with proper stuff

t.gettext('asdasd');

class AnyAngularOrTaonClass {
  t = t.for(this); // probably only usefull for cdr in angular

  isLoading$ = t.isLoadingLang$; // maybe needed sometime

  refreshableSignalLabel$ = t.signal.gettext(t.gettext('welcome'));

  refreshableRxjsLabel$ = t.$.gettext('amazing better place'); // probably even better

  asdsa = this.t.gettext(
    // just sugar syntax
    'This is mamazing',
    {
      asdasd: 'asd',
    },
    'asdas',
  );

  ngOnInit(): void {
    //Called after the constructor, initializing input properties, and the first call to ngOnChanges.
    //Add 'implements OnInit' to the class.
    const lable = t.gettext('hello');
  }
}
  */
//#endregion
