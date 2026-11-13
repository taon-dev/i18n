import {
  AfterViewInit,
  booleanAttribute,
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

  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input({ alias: 'translate-html', transform: booleanAttribute })
  translateHtml = false;

  private readonly element = inject(ElementRef<HTMLElement>);

  private readonly destroyRef = inject(DestroyRef);

  private readonly sanitizer = inject(DomSanitizer);

  private initialized = false;

  private originalText = '';

  private originalHtml = '';

  private originalNodes: Node[] = [];

  private renderedHtml = false;

  private get useHtml(): boolean {
    return this.translateHtml || this.htmlKey !== undefined;
  }

  ngAfterViewInit(): void {
    const host = this.element.nativeElement;

    // Independently marked descendants own their translations.
    if (host.querySelector('[translate]')) {
      return;
    }

    if (host.children.length > 0 && !this.useHtml) {
      return;
    }

    if (!this.t) {
      throw new Error('[@taon-dev/i18n] [translate] requires [translate-t].');
    }

    this.originalText = (host.textContent ?? '').replace(/\s+/g, ' ').trim();

    if (this.useHtml) {
      this.originalNodes = Array.from(host.childNodes);

      const source = host.cloneNode(true) as HTMLElement;

      source.querySelectorAll('*').forEach(child => {
        for (const name of child.getAttributeNames()) {
          if (name.startsWith('_ngcontent-')) {
            child.removeAttribute(name);
          }
        }
      });

      this.originalHtml = source.innerHTML.trim();
    }

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
    const useHtml = this.useHtml;
    const key =
      this.htmlKey ?? (useHtml ? this.originalHtml : this.originalText);
    const translation = useHtml
      ? this.t.translateHtml(key, this.params, this.translateContext)
      : this.t.translate(key, this.params, this.translateContext);

    if (!useHtml) {
      if (host.textContent !== translation) {
        host.textContent = translation;
      }
      return;
    }

    if (translation === key) {
      if (this.renderedHtml) {
        host.replaceChildren(...this.originalNodes);
        this.renderedHtml = false;
      }
      return;
    }

    const sanitizedHtml = this.sanitizer.sanitize(
      SecurityContext.HTML,
      translation,
    );

    if (sanitizedHtml !== null && host.innerHTML !== sanitizedHtml) {
      host.innerHTML = sanitizedHtml;
      this.renderedHtml = true;
    }
  }
}
