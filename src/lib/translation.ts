//#region imports
import { ChangeDetectorRef, inject, signal } from '@angular/core'; // @browser
import type { WritableSignal as WritableSignalType } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { UtilsI18n } from 'tnp-core/src';

import { TranslationManager } from './translation-manager';
import {
  TaonTranslationsMapImport,
  TranslationBinding,
  TranslationParams,
} from './translation.models';
//#endregion

type Locale = UtilsI18n.CommonLocaleCode;
type CatalogLoader = () => Promise<UtilsI18n.GettextFile>;

interface CatalogLookup {
  exact: Map<string, string>;
  breaks: Map<string, string>;
  html: Map<string, string>;
}

interface Catalog {
  loader: CatalogLoader;
  lookup?: CatalogLookup;
  loading?: Promise<void>;
}

//#region translation class
export class Translation {
  static manager = TranslationManager.Instance;

  private static readonly catalogs = new Map<Locale, Map<string, Catalog>>();

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

  private readonly loadingSubjectSrc = new BehaviorSubject(false);

  public readonly isLoadingLang$ = this.loadingSubjectSrc.asObservable();

  private readonly bindings = new Set<TranslationBinding>();
  private readonly fileCatalogs = new Map<Locale, Catalog>();

  private useGlobalLangFile = true;
  private loadVersion = 0;
  private active = false;
  //#endregion

  //#region constructor
  private constructor(
    protected fileRelativePath: string,
    public localFileLang: Locale,
    protected langImportMap: TaonTranslationsMapImport,
    public debug = false,
  ) {
    this.registerCatalogs();
    Translation.manager.instances.add(this);
  }
  //#endregion

  //#region for
  for(_classThis: object): Translation {
    //#region @browser
    try {
      this.cdr = inject(ChangeDetectorRef);
    } catch {
      // This method can also be called outside Angular's injection context.
    }
    //#endregion

    void this.ensureLoaded();

    return this;
  }
  //#endregion

  //#region language selection
  async changeFileLang(lang: Locale): Promise<void> {
    this.useGlobalLangFile = false;
    this.localFileLang = lang;
    await this.ensureLoaded();
  }

  async useGlobalFileLang(): Promise<void> {
    this.useGlobalLangFile = true;
    await this.ensureLoaded();
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
  //#endregion

  //#region signal
  private createSignal(
    text: string,
    params?: TranslationParams,
    context = '',
  ): WritableSignalType<string> {
    //#region @browser
    const value = signal<string>(this.gettext(text, params, context));

    this.bindings.add({
      text,
      params,
      context,
      update: translation => value.set(translation),
    });

    return value;
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
    const subject = new BehaviorSubject(this.gettext(text, params, context));

    this.bindings.add({
      text,
      params,
      context,
      update: translation => subject.next(translation),
    });

    return subject.asObservable();
  }

  readonly $ = {
    gettext: (text: string, params?: TranslationParams, context?: string) =>
      this.createObservable(text, params, context),
  };
  //#endregion

  //#region catalog registration
  private registerCatalogs(): void {
    for (const path of Object.keys(this.langImportMap)) {
      const loaders = this.langImportMap[path];

      for (const locale of Object.keys(loaders) as Locale[]) {
        const loader = loaders[locale];

        if (!loader) {
          continue;
        }

        let catalogs = Translation.catalogs.get(locale);

        if (!catalogs) {
          catalogs = new Map<string, Catalog>();
          Translation.catalogs.set(locale, catalogs);
        }

        let catalog = catalogs.get(path);

        if (!catalog) {
          catalog = { loader };
          catalogs.set(path, catalog);
        }

        if (path === this.fileRelativePath) {
          this.fileCatalogs.set(locale, catalog);
        }
      }
    }
  }
  //#endregion

  //#region catalog loading
  private async ensureLoaded(): Promise<void> {
    if (this.useGlobalLangFile) {
      this.localFileLang = Translation.manager.currentGlobalLanguage;
    }

    this.active = true;

    const locale = this.localFileLang;
    const version = ++this.loadVersion;
    const catalogs = Translation.catalogs.get(locale);

    this.loadingSubjectSrc.next(true);

    try {
      if (catalogs) {
        await Promise.all(
          Array.from(catalogs, ([path, catalog]) =>
            this.loadCatalog(path, locale, catalog),
          ),
        );
      }
    } finally {
      if (version === this.loadVersion) {
        this.loadingSubjectSrc.next(false);
      }
    }

    // Newly loaded catalogs can satisfy misses in other active instances.
    for (const instance of Translation.manager.instances) {
      if (instance.active && instance.localFileLang === locale) {
        instance.refreshBindings();

        //#region @browser
        instance.cdr?.markForCheck();
        //#endregion

        if (instance !== this && !instance.loadingSubjectSrc.value) {
          instance.loadingSubjectSrc.next(false);
        }
      }
    }
  }

  private async loadCatalog(
    path: string,
    locale: Locale,
    catalog: Catalog,
  ): Promise<void> {
    if (catalog.lookup) {
      return;
    }

    catalog.loading ??= Promise.resolve()
      .then(() => catalog.loader())
      .then(moduleOrFile => {
        const file =
          (moduleOrFile as { default?: UtilsI18n.GettextFile }).default ??
          moduleOrFile;

        catalog.lookup = this.createLookup(file);
      })
      .catch(error => {
        console.error(
          `[taon-i18n] Error loading ${locale} catalog ${path}`,
          error,
        );
      })
      .finally(() => {
        catalog.loading = undefined;
      });

    await catalog.loading;
  }

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
  private gettextWithoutEnsureLoaded(
    text: string,
    params?: TranslationParams,
    context = '',
    html = false,
  ): string {
    const exactKey = this.key(text, context);
    const breakKey = this.key(this.normalizeBreakNewlines(text), context);
    const htmlKey = html
      ? this.key(this.normalizeHtmlKey(text), context)
      : undefined;

    const fileCatalog = this.fileCatalogs.get(this.localFileLang);
    let translated = this.findInCatalog(
      fileCatalog,
      exactKey,
      breakKey,
      htmlKey,
    );

    if (translated === undefined) {
      const catalogs = Translation.catalogs.get(this.localFileLang);

      if (catalogs) {
        for (const catalog of catalogs.values()) {
          if (catalog === fileCatalog) {
            continue;
          }

          translated = this.findInCatalog(catalog, exactKey, breakKey, htmlKey);

          if (translated !== undefined) {
            break;
          }
        }
      }
    }

    if (this.debug) {
      console.log('[taon-i18n] Translation lookup', {
        path: this.fileRelativePath,
        locale: this.localFileLang,
        context,
        text,
        translated,
      });
    }

    return this.interpolate(translated ?? text, params);
  }

  private findInCatalog(
    catalog: Catalog | undefined,
    exactKey: string,
    breakKey: string,
    htmlKey: string | undefined,
  ): string | undefined {
    const lookup = catalog?.lookup;

    return (
      lookup?.exact.get(exactKey) ??
      (htmlKey === undefined ? undefined : lookup?.html.get(htmlKey)) ??
      lookup?.breaks.get(breakKey)
    );
  }

  private createLookup(file: UtilsI18n.GettextFile): CatalogLookup {
    const lookup: CatalogLookup = {
      exact: new Map(),
      breaks: new Map(),
      html: new Map(),
    };

    for (const tag of file.tags ?? []) {
      if (!tag.translation) {
        continue;
      }

      const text = tag.gettextString;
      const context = tag.context ?? '';

      const keys: [Map<string, string>, string][] = [
        [lookup.exact, this.key(text, context)],
        [lookup.breaks, this.key(this.normalizeBreakNewlines(text), context)],
      ];

      if (/<[a-z][\s\S]*?>/i.test(text)) {
        keys.push([
          lookup.html,
          this.key(this.normalizeHtmlKey(text), context),
        ]);
      }

      for (const [index, key] of keys) {
        if (!index.has(key)) {
          index.set(key, tag.translation);
        }
      }
    }

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
      .replace(/ *> */g, '>')
      .replace(/ *< */g, '<')
      .trim();
  }
  //#endregion

  //#region interpolate
  private interpolate(text: string, params?: TranslationParams): string {
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
