//#region imports
import {
  crossPlatformPath,
  dotTaonFolder,
  UtilsI18n,
  UtilsOs,
  _,
  Helpers,
} from 'tnp-core/src';
//#endregion

//#region translation options
export interface TranslationOptions {
  text: string;
  from: UtilsI18n.CommonLocaleCode;
  to: UtilsI18n.CommonLocaleCode;

  /**
   * Nearby source-language text used only to give the translator
   * additional context.
   *
   * Context is never returned from translate().
   */
  context?: string;

  /**
   * Source terms that should be replaced with specific translated terms.
   */
  glossary?: Record<string, string>;
}
//#endregion

//#region ai download progress
export interface AiDownloadProgress {
  /**
   * General loading stage reported by Transformers.js.
   */
  status:
    | 'initiate'
    | 'download'
    | 'progress'
    | 'progress_total'
    | 'done'
    | 'ready'
    | string;

  /**
   * Current filename, when progress concerns an individual file.
   */
  file?: string;

  /**
   * Progress from 0 to 100.
   */
  progress?: number;

  /**
   * Downloaded bytes, when provided by Transformers.js.
   */
  loaded?: number;

  /**
   * Total bytes, when provided by Transformers.js.
   */
  total?: number;
}
//#endregion

//#region make sure ai downloaded options
export interface MakeSureAiDownloadedOptions {
  onProgress?: (progress: AiDownloadProgress) => void;

  /**
   * Run one tiny translation after loading.
   *
   * This removes most of the delay from the first real translation,
   * but it performs a small amount of additional inference work.
   */
  warmup?: boolean;
}
//#endregion

//#region constants
const MODEL_ID = 'Xenova/nllb-200-distilled-600M';

const nllbLanguageCodes: Partial<Record<UtilsI18n.CommonLocaleCode, string>> = {
  'en-US': 'eng_Latn',
  'pl-PL': 'pol_Latn',
  'de-DE': 'deu_Latn',
};

const CONTEXT_SEPARATOR = '→';
//#endregion

export class LocalTranslationService {
  //#region fields & getters
  private translatorPromise?: Promise<any>;

  private aiReady = false;

  private warmupPromise?: Promise<void>;

  private progressListeners = new Set<(progress: AiDownloadProgress) => void>();
  //#endregion

  /**
   * Downloads, caches and loads the translation model.
   *
   * Multiple simultaneous calls share the same initialization promise.
   * After this resolves, translate() reuses the already loaded model.
   */
  //#region methods / make sure ai downloaded
  async makeSureAiDownloaded(
    options: MakeSureAiDownloadedOptions = {},
  ): Promise<void> {
    //#region @backendFunc
    const { onProgress, warmup = false } = options;

    if (onProgress) {
      this.progressListeners.add(onProgress);
    }

    try {
      const translator = await this.getTranslator();

      if (warmup) {
        await this.warmupTranslator(translator);
      }
    } finally {
      if (onProgress) {
        this.progressListeners.delete(onProgress);
      }
    }
    //#endregion
  }
  //#endregion

  /**
   * True only in this process after pipeline initialization succeeded.
   */
  //#region methods / is ai ready
  isAiReady(): boolean {
    return this.aiReady;
  }
  //#endregion

  //#region methods / get translator
  private getTranslator(): Promise<any> {
    this.translatorPromise ??= this.createTranslator().catch(error => {
      // Allow a later call to retry after a network or disk failure.
      this.translatorPromise = undefined;
      this.aiReady = false;

      throw error;
    });

    return this.translatorPromise;
  }
  //#endregion

  //#region methods / create translator
  private async createTranslator(): Promise<any> {
    //#region @backendFunc
    //#region @esmRemove
    const { env, pipeline } = await import('@huggingface/transformers');

    env.cacheDir = this.getModelsCachePath();

    const translator = await pipeline('translation', MODEL_ID, {
      dtype: 'q8',

      progress_callback: (progress: AiDownloadProgress) => {
        this.emitProgress(progress);
      },
    });

    this.aiReady = true;

    this.emitProgress({
      status: 'ready',
      progress: 100,
    });

    return translator;
    //#endregion
    //#endregion

    return void 0 as any;
  }
  //#endregion

  //#region methods / emit progress
  private emitProgress(progress: AiDownloadProgress): void {
    for (const listener of this.progressListeners) {
      try {
        listener(progress);
      } catch {
        // A UI callback must not break model initialization.
      }
    }
  }
  //#endregion

  //#region methods / warmup translator
  private warmupTranslator(translator: any): Promise<void> {
    this.warmupPromise ??= translator('Hello.', {
      src_lang: 'eng_Latn',
      tgt_lang: 'pol_Latn',
      max_new_tokens: 16,
    })
      .then(() => undefined)
      .catch(error => {
        this.warmupPromise = undefined;
        throw error;
      });

    return this.warmupPromise;
  }
  //#endregion

  //#region methods / translate
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

    const srcLang = nllbLanguageCodes[fromOrg];
    const tgtLang = nllbLanguageCodes[toOrg];

    if (!srcLang) {
      throw new Error(`Unsupported source translation locale: ${fromOrg}`);
    }

    if (!tgtLang) {
      throw new Error(`Unsupported target translation locale: ${toOrg}`);
    }

    /**
     * Context is included so NLLB can use it while translating,
     * but only content after CONTEXT_SEPARATOR is returned.
     */
    const hasContext = !!context?.trim();

    const input = hasContext
      ? `${context!.trim()}\n\n${CONTEXT_SEPARATOR}\n\n${text.trim()}`
      : text;

    /**
     * Protect [[ ... ]] before doing glossary substitutions.
     *
     * This is intentionally first so glossary entries can never
     * accidentally modify interpolation expressions.
     */
    const protectedInterpolation = this.protectInterpolation(input);

    const protectedGlossary = this.protectGlossary(
      protectedInterpolation.preparedText,
      glossary,
    );

    const translator = await this.getTranslator();

    const result = await translator(protectedGlossary.preparedText, {
      src_lang: srcLang,
      tgt_lang: tgtLang,
    });

    let translatedText = result[0]?.translation_text ?? '';

    /**
     * Restore glossary values first, then interpolation expressions.
     */
    translatedText = protectedGlossary.restore(translatedText);
    translatedText = protectedInterpolation.restore(translatedText);

    /**
     * Remove translated context from the final result.
     */
    if (hasContext) {
      const separatorIndex = translatedText.lastIndexOf('→');

      if (separatorIndex !== -1) {
        translatedText = translatedText.slice(separatorIndex + 1).trim();
      } else {
        // separator disappeared — never return context accidentally
        return this.translate({
          ...options,
          context: undefined,
        });
      }
    }

    return translatedText;
    //#endregion
  }
  //#endregion

  //#region methods / protect glossary
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
  //#endregion

  //#region methods / protect interpolation
  private protectInterpolation(text: string): {
    preparedText: string;
    restore: (translatedText: string) => string;
  } {
    const replacements: Array<{
      placeholder: string;
      originalValue: string;
    }> = [];

    const preparedText = text.replace(/\[\[[\s\S]*?\]\]/g, originalValue => {
      const placeholder = `TAONINTERPOLATION${replacements.length}PLACEHOLDER`;

      replacements.push({
        placeholder,
        originalValue,
      });

      return placeholder;
    });

    return {
      preparedText,

      restore(translatedText: string): string {
        let result = translatedText;

        for (const replacement of replacements) {
          if (!result.includes(replacement.placeholder)) {
            console.error(
              `Translation model removed interpolation placeholder ` +
                `"${replacement.placeholder}" while translating "${text}". ` +
                `Appending "${replacement.originalValue}" manually.`,
            );

            result = `${result.trimEnd()} ${replacement.originalValue}`;
            continue;
          }

          result = result.replaceAll(
            replacement.placeholder,
            replacement.originalValue,
          );
        }

        return result;
      },
    };
  }
  //#endregion

  //#region methods / get models cache path
  private getModelsCachePath(): string {
    const cachePath = crossPlatformPath([
      UtilsOs.getRealHomeDir(),
      dotTaonFolder,
      'ai-models-cache',
    ]);

    Helpers.mkdirp(cachePath);

    return cachePath;
  }
  //#endregion
}
