import {
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  Input,
  OnDestroy,
  OnInit,
  OnChanges,
} from '@angular/core';
// @ts-ignore
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TranslateService } from './translate.service';
import { Translation } from './translation';

@Directive({
  selector: '[translate]',
  standalone: true,
})
export class TranslateDirective implements OnInit, OnDestroy, OnChanges {
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

  ngOnInit(): void {
    this.originalText = this.element.nativeElement.textContent?.trim() ?? '';
    this.initialized = true;
    this.render();
    this.t.isLoadingLang$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.render());
  }

  ngOnChanges(): void {
    if (!this.initialized) return;
    this.render();
  }

  ngOnDestroy(): void {}

  private render(): void {
    // console.log('render', this);
    this.element.nativeElement.textContent = this.t.translate(
      this.originalText,
      this.params,
      this.translateContext,
    );
  }
}
