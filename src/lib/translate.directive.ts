import {
  AfterViewInit,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  Input,
  OnChanges,
} from '@angular/core';
// @ts-ignore
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Translation } from './translation';

@Directive({
  selector: '[translate]',
  standalone: true,
})
export class TranslateDirective implements AfterViewInit, OnChanges {
  private static readonly selector = '[translate]';

  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input('translate-t') t!: Translation;

  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input('translate-params') params?: Record<string, unknown>;

  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input('translate-context') translateContext?: string;

  private initialized = false;

  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  private originalText = '';

  ngAfterViewInit(): void {
    const nativeElement = this.element.nativeElement;

    this.validateContent();

    this.originalText = nativeElement.textContent?.trim() ?? '';

    this.initialized = true;

    this.render();

    this.t.isLoadingLang$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.render();
      });
  }

  ngOnChanges(): void {
    if (!this.initialized) {
      return;
    }

    this.render();
  }

  private validateContent(): void {
    const element = this.element.nativeElement;
    // console.log('validating ', element);

    if (element.children.length > 0) {
      console.error(
        `[@taon-dev/i18n] ${TranslateDirective.selector} should only be used ` +
          `with plain text. HTML/content elements detected inside:`,

        element,
      );
    }
  }

  private render(): void {
    if (!this.t) {
      throw (
        `Directive ${TranslateDirective.selector} applied on component ` +
        `without implemented Translatable interface`
      );
    }

    this.element.nativeElement.textContent = this.t.translate(
      this.originalText,
      this.params,
      this.translateContext,
    );
  }
}
