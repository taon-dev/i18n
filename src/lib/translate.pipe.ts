import {
  ChangeDetectorRef,
  inject,
  OnDestroy,
  Pipe,
  PipeTransform,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { Translation } from './translation';
import { TranslationManager } from './translation-manager';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  private tranlsationManager = TranslationManager.Instance;

  private readonly sub: Subscription;

  constructor() {
    this.sub = this.tranlsationManager.isLoadingLangs$.subscribe(() => {
      this.cdr.markForCheck();
    });
  }

  transform(
    text: string,
    t: Translation,
    params?: Record<string, unknown>,
    context?: string,
  ): string {
    return t?.gettext(text, params, context) ?? text;
    // const translated = t?.gettext(text, params, context) ?? text;
    // console.log(`text t=${!!t} , text=${text} => ${translated}`);
    // return translated;
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
