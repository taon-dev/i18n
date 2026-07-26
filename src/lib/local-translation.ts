import { mkdirSync } from 'node:fs';

import {
  crossPlatformPath,
  dotTaonFolder,
  UtilsI18n,
  UtilsOs,
  _,
} from 'tnp-core/src';

export interface TranslationOptions {
  text: string;
  from: UtilsI18n.CommonLocaleCode;
  to: UtilsI18n.CommonLocaleCode;

  /**
   * Nearby text. For NLLB, context should normally be translated
   * together with the target sentence rather than supplied as a prompt.
   */
  context?: string;

  glossary?: Record<string, string>;
}

const nllbLanguageCodes: Record<UtilsI18n.CommonLocaleCode, string> = {
  'en-US': 'eng_Latn',
  'pl-PL': 'pol_Latn',
  'de-DE': 'deu_Latn',
} as any;

export class LocalTranslationService {
  private translatorPromise?: Promise<any>;

  private getTranslator() {
    this.translatorPromise ??= this.createTranslator();

    return this.translatorPromise;
  }

  private async createTranslator() {
    //#region @backendFunc
    const { env, pipeline } = await import('@huggingface/transformers');

    env.cacheDir = this.getModelsCachePath();

    return pipeline('translation', 'Xenova/nllb-200-distilled-600M', {
      dtype: 'q8',
    });
    //#endregion
  }

  async translate(options: TranslationOptions): Promise<string> {
    //#region @backendFunc
    let { text, context, from, to, glossary } = options;
    const fromOrg = from;
    const toOrg = to;
    from = _.first(from.split('-')) as any;
    to = _.first(to.split('-')) as any;

    if (!text.trim() || from === to) {
      return text;
    }

    const input = context?.trim()
      ? `${context.trim()}\n\n${text.trim()}`
      : text;

    const protectedInput = this.protectGlossary(input, glossary);
    const translator = await this.getTranslator();

    const result = await translator(protectedInput.preparedText, {
      src_lang: nllbLanguageCodes[fromOrg],
      tgt_lang: nllbLanguageCodes[toOrg],
    });

    const translatedText = result[0]?.translation_text ?? '';

    return protectedInput.restore(translatedText);
    //#endregion
  }

  private protectGlossary(
    text: string,
    glossary?: Record<string, string>,
  ): {
    preparedText: string;
    restore: (translatedText: string) => string;
  } {
    if (!glossary || Object.keys(glossary).length === 0) {
      return {
        preparedText: text,
        restore: translatedText => translatedText,
      };
    }

    const replacements: Array<{
      placeholder: string;
      translatedValue: string;
    }> = [];

    let preparedText = text;

    Object.entries(glossary)
      .sort(([left], [right]) => right.length - left.length)
      .forEach(([sourceValue, translatedValue], index) => {
        const placeholder = `TAONTERM${index}PLACEHOLDER`;

        preparedText = preparedText.replaceAll(sourceValue, placeholder);

        replacements.push({
          placeholder,
          translatedValue,
        });
      });

    return {
      preparedText,
      restore(translatedText: string): string {
        let result = translatedText;

        for (const replacement of replacements) {
          result = result.replaceAll(
            replacement.placeholder,
            replacement.translatedValue,
          );
        }

        return result;
      },
    };
  }

  private getModelsCachePath(): string {
    const cachePath = crossPlatformPath([
      UtilsOs.getRealHomeDir(),
      dotTaonFolder,
      'ai-models-cache',
    ]);

    mkdirSync(cachePath, {
      recursive: true,
    });

    return cachePath;
  }
}
