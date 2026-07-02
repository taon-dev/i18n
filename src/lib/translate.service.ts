import { Injectable } from '@angular/core';
import { UtilsI18n } from 'tnp-core/src';

import { TranslationManager } from './translation-manager';

@Injectable({ providedIn: 'root' })
export class TranslateService {
  private maanger = TranslationManager.Instance;

  /**
   * TODO
   */
  public readonly isLoadingLangs$ = this.maanger.isLoadingLangs$;

  public readonly availableLangs$ = this.maanger.availableLangs$;

  public readonly currentGlobalLanguage$ = this.maanger.currentGlobalLanguage$;

  //#region change global lang
  async changeGlobalLang(lang: UtilsI18n.CommonLocaleCode): Promise<void> {
    await this.maanger.changeGlobalLang(lang);
  }
  //#endregion
}
