import {
  AfterViewInit,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  Input,
  OnChanges,
  SecurityContext,
} from '@angular/core';
// @ts-ignore
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';

import { Translation } from './translation';

@Directive({
  selector: '[translate]',
  standalone: true,
})
export class TranslateDirective implements AfterViewInit, OnChanges {
  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input('translate-t') t!: Translation;

  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input('translate-params') params?: Record<string, unknown>;

  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input('translate-context') translateContext?: string;

  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input('translate-html-key') htmlKey?: string;

  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);

  private initialized = false;
  private originalText = '';

  ngAfterViewInit(): void {
    const host = this.element.nativeElement;

    // Independently marked descendants own their translations.
    if (host.querySelector('[translate]')) {
      return;
    }

    if (host.children.length > 0 && this.htmlKey === undefined) {
      return;
    }

    if (!this.t) {
      throw new Error('[@taon-dev/i18n] [translate] requires [translate-t].');
    }

    this.originalText = (host.textContent ?? '').replace(/\s+/g, ' ').trim();
    this.initialized = true;

    this.render();

    this.t.isLoadingLang$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.render());
  }

  ngOnChanges(): void {
    if (this.initialized) {
      this.render();
    }
  }

  private render(): void {
    const host = this.element.nativeElement;
    const inputTranslate = this.htmlKey ?? this.originalText;
    const translation = this.t.translate(
      inputTranslate,
      this.params,
      this.translateContext,
    );
    // console.log(`${inputTranslate} ==== ${translation}`)

    if (this.htmlKey === undefined) {
      host.textContent = translation;
      return;
    }

    const sanitizedHtml = this.sanitizer.sanitize(
      SecurityContext.HTML,
      translation,
    );

    if (sanitizedHtml !== null && host.innerHTML !== sanitizedHtml) {
      host.innerHTML = sanitizedHtml;
    }
  }
}
