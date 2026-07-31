import {
  crossPlatformPath,
  dotTaonFolder,
  UtilsI18n,
  UtilsOs,
  _,
  Helpers,
} from 'tnp-core/src';

export interface TranslationOptions {
  text: string;
  from: UtilsI18n.CommonLocaleCode;
  to: UtilsI18n.CommonLocaleCode;

  /**
   * Nearby source-language text.
   */
  context?: string;

  glossary?: Record<string, string>;
}

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

const MODEL_ID = 'Xenova/nllb-200-distilled-600M';

const nllbLanguageCodes: Partial<
  Record<UtilsI18n.CommonLocaleCode, string>
> = {
  'en-US': 'eng_Latn',
  'pl-PL': 'pol_Latn',
  'de-DE': 'deu_Latn',
};

export class LocalTranslationService {
  private translatorPromise?: Promise<any>;

  private aiReady = false;

  private warmupPromise?: Promise<void>;

  private progressListeners = new Set<
    (progress: AiDownloadProgress) => void
  >();

  /**
   * Downloads, caches and loads the translation model.
   *
   * Multiple simultaneous calls share the same initialization promise.
   * After this resolves, translate() reuses the already loaded model.
   */
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

  /**
   * True only in this process after pipeline initialization succeeded.
   */
  isAiReady(): boolean {
    return this.aiReady;
  }

  private getTranslator(): Promise<any> {
    this.translatorPromise ??= this.createTranslator().catch(error => {
      // Allow a later call to retry after a network or disk failure.
      this.translatorPromise = undefined;
      this.aiReady = false;

      throw error;
    });

    return this.translatorPromise;
  }

  private async createTranslator(): Promise<any> {
    //#region @backendFunc
    const { env, pipeline } = await import(
      '@huggingface/transformers'
    );

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
  }

  private emitProgress(progress: AiDownloadProgress): void {
    for (const listener of this.progressListeners) {
      try {
        listener(progress);
      } catch {
        // A UI callback must not break model initialization.
      }
    }
  }

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
      throw new Error(
        `Unsupported source translation locale: ${fromOrg}`,
      );
    }

    if (!tgtLang) {
      throw new Error(
        `Unsupported target translation locale: ${toOrg}`,
      );
    }

    const input = context?.trim()
      ? `${context.trim()}\n\n${text.trim()}`
      : text;

    const protectedInput = this.protectGlossary(input, glossary);
    const translator = await this.getTranslator();

    const result = await translator(protectedInput.preparedText, {
      src_lang: srcLang,
      tgt_lang: tgtLang,
    });

    const translatedText =
      result[0]?.translation_text ?? '';

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

        preparedText = preparedText.replaceAll(
          sourceValue,
          placeholder,
        );

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

    Helpers.mkdirp(cachePath);

    return cachePath;
  }
}
