import { Injectable } from '@angular/core';
import { UtilsI18n } from 'tnp-core/src';

import { TranslationManager } from './translation-manager';

@Injectable({ providedIn: 'root' })
export class TranslateService {
  public manager = TranslationManager.Instance;

  public setOneLanguagePernament(lang: UtilsI18n.CommonLocaleCode): void {
    this.manager.setOneLanguagePernament(lang);
  }

  //#region change global lang
  async changeGlobalLang(lang: UtilsI18n.CommonLocaleCode): Promise<void> {
    await this.manager.changeGlobalLang(lang);
  }
  //#endregion
}
