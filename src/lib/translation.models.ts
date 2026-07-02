import { UtilsI18n } from 'tnp-core/src';

import type { Translation } from './translation';

export type TranslationLookup = Record<string, string>;

export type TranslationParams = Record<string, unknown> | null;

type FileRelativeLocation = string;
export type TaonTranslationsMapImport = Record<
  FileRelativeLocation,
  {
    [lang in UtilsI18n.CommonLocaleCode]?: () => Promise<UtilsI18n.GettextFile>;
  }
>;

/**
 * Searching all tags with each gettext probably not a good idea.. maybe some
 * kind of object/map can be created/use
 */
export type TaonTranslationsMap = Record<
  FileRelativeLocation,
  {
    [lang in UtilsI18n.CommonLocaleCode]?: UtilsI18n.GettextFile;
  }
>;

export interface TranslationBinding {
  text: string;
  params?: TranslationParams;
  context?: string;
  update(value: string): void;
}

export interface Translatable {
  t: Translation;
}
