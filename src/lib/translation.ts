//#region imports
import { ChangeDetectorRef, inject, signal } from '@angular/core'; // @browser
import type { WritableSignal as WritableSignalType } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { UtilsI18n, _ } from 'tnp-core/src';

import { TranslationManager } from './translation-manager';
import {
  TaonTranslationsMapImport,
  TranslationBinding,
  TranslationLookup,
  TranslationParams,
} from './translation.models';
//#endregion

//#region translation class
export class Translation {
  static manager = TranslationManager.Instance;

  //#region static for
  static for(
    fileRelativePath: string,
    langImportMap: TaonTranslationsMapImport,
    opt?: { debug?: boolean },
  ): Translation {
    return new Translation(
      fileRelativePath,
      Translation.manager.currentGlobalLanguage,
      langImportMap,
      !!opt?.debug,
    );
  }
  //#endregion

  //#region fields
  //#region @browser
  public cdr?: ChangeDetectorRef;
  //#endregion

  private lookup: TranslationLookup = {};

  private lookupIgnoringBreakNewlines: TranslationLookup = {};

  private lookupNormalizedHtml = new Map<string, string | null>();

  private readonly loadingSubjectSrc = new BehaviorSubject(false);

  public readonly isLoadingLang$ = this.loadingSubjectSrc.asObservable();

  private loading?: Promise<void>;

  private loadedLang?: UtilsI18n.CommonLocaleCode;

  private readonly bindings = new Set<TranslationBinding>();

  private useGlobalLangFile = true;
  //#endregion

  //#region constructor
  private constructor(
    protected fileRelativePath: string,
    public localFileLang: UtilsI18n.CommonLocaleCode,
    protected langImportMap: TaonTranslationsMapImport,
    public debug = false,
  ) {
    Translation.manager.instances.add(this);
  }
  //#endregion

  //#region for
  for(_classThis: object): Translation {
    if (this.useGlobalLangFile) {
      this.localFileLang = Translation.manager.currentGlobalLanguage;
    }

    //#region @browser
    try {
      this.cdr = inject(ChangeDetectorRef);
    } catch {
      // This method can also be called outside an Angular injection context.
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
  async useGlobalFileLang(): Promise<void> {
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
    return this.gettextWithoutEnsureLoaded(text, params, context);
  };
  //#endregion

  //#region signal
  private createSignal(
    text: string,
    params?: TranslationParams,
    context = '',
  ): WritableSignalType<string> {
    //#region @browser
    const s = signal<string>(this.gettext(text, params, context));

    this.bindings.add({
      text,
      params,
      context,
      update: value => s.set(value),
    });

    return s;
    //#endregion
    return void 0;
  }

  readonly signal = {
    gettext: (text: string, params?: TranslationParams, context?: string) =>
      this.createSignal(text, params, context),
  };
  //#endregion

  //#region observable
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

  //#region refresh bindings
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

  //#region translation lookup
  translate(text: string, params?: TranslationParams, context = ''): string {
    return this.gettextWithoutEnsureLoaded(text, params, context);
  }

  translateHtml(
    text: string,
    params?: TranslationParams,
    context = '',
  ): string {
    return this.gettextWithoutEnsureLoaded(text, params, context, true);
  }

  private gettextWithoutEnsureLoaded(
    text: string,
    params?: TranslationParams,
    context = '',
    html = false,
  ): string {
    const key = this.key(text, context);
    const exact = this.lookup[key];
    let translated = exact ?? text;

    if (exact === undefined) {
      const normalizedHtml = html
        ? this.lookupNormalizedHtml.get(
            this.key(this.normalizeHtmlKey(text), context),
          )
        : undefined;

      // A null entry means different translations share this normalized key.
      if (normalizedHtml !== null) {
        translated =
          normalizedHtml ??
          this.lookupIgnoringBreakNewlines[
            this.key(this.normalizeBreakNewlines(text), context)
          ] ??
          text;
      }
    }

    if (this.debug) {
      console.log(
        `Translate: "${text}" to "${translated}", key="${key}" params:${
          _.isObject(params) ? JSON.stringify(params) : params
        } localFileLang: ${this.localFileLang}`,
        this,
      );
    }

    return this.interpolate(translated, params);
  }
  //#endregion

  //#region load
  private async load(): Promise<void> {
    this.loadingSubjectSrc.next(true);

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
    this.debug && console.log(`${this.localFileLang}`, files, this.lookup);

    this.refreshBindings();

    //#region @browser
    this.cdr?.markForCheck();
    //#endregion

    this.loadingSubjectSrc.next(false);
  }
  //#endregion

  //#region ensure loaded
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

  //#region create lookup
  private createLookup(files: UtilsI18n.GettextFile[]): TranslationLookup {
    const lookup: TranslationLookup = {};
    const lookupIgnoringBreakNewlines: TranslationLookup = {};
    const lookupNormalizedHtml = new Map<string, string | null>();

    for (const file of files) {
      for (const tag of file.tags ?? []) {
        if (!tag.translation) {
          continue;
        }

        const context = tag.context ?? '';
        const text = tag.gettextString;

        lookup[this.key(text, context)] = tag.translation;
        lookupIgnoringBreakNewlines[
          this.key(this.normalizeBreakNewlines(text), context)
        ] = tag.translation;

        if (/<[a-z][\s\S]*?>/i.test(text)) {
          const htmlKey = this.key(this.normalizeHtmlKey(text), context);
          const existing = lookupNormalizedHtml.get(htmlKey);

          if (existing === undefined) {
            lookupNormalizedHtml.set(htmlKey, tag.translation);
          } else if (existing !== tag.translation) {
            lookupNormalizedHtml.set(htmlKey, null);
          }
        }
      }
    }

    this.lookupIgnoringBreakNewlines = lookupIgnoringBreakNewlines;
    this.lookupNormalizedHtml = lookupNormalizedHtml;

    return lookup;
  }
  //#endregion

  //#region lookup keys
  private key(text: string, context = ''): string {
    return `${context}\u0004${text}`;
  }

  private normalizeBreakNewlines(text: string): string {
    return text.replace(/<br\s*\/?>(?:[ \t]*\r?\n[ \t]*)*/gi, '<br>');
  }

  private normalizeHtmlKey(html: string): string {
    return html
      .replace(/&#(?:0*64|x0*40);/gi, '@')
      .replace(/<br\s*\/?>/gi, '<br>')
      .replace(
        /<a\b((?:"[^"]*"|'[^']*'|[^"'<>])*)>/gi,
        (tag: string, attributes: string) => {
          const entries: string[] = [];

          const remaining = attributes
            .replace(
              /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g,
              (
                _match: string,
                name: string,
                doubleQuoted?: string,
                singleQuoted?: string,
              ) => {
                const value = doubleQuoted ?? singleQuoted;
                entries.push(`${name.toLowerCase()}=${JSON.stringify(value)}`);
                return '';
              },
            )
            .trim();

          if (remaining) {
            return tag;
          }

          return entries.length ? `<a ${entries.sort().join(' ')}>` : '<a>';
        },
      )
      .replace(/[ \t\r\n\f]+/g, ' ')
      .replace(/ *<br> */g, '<br>')
      .replace(/(<strong>) +(?=<a\b)/gi, '$1')
      .replace(/(<\/a>) +(?=<\/strong>)/gi, '$1')
      .replace(/[ \t\r\n\f]+/g, ' ')
      .replace(/ *> */g, '>')
      .replace(/ *< */g, '<')
      .trim();
  }
  //#endregion

  //#region interpolate
  private interpolate(text: string, params?: Record<string, unknown>): string {
    if (!params) {
      return text;
    }

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

