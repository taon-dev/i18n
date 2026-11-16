import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslationManager } from '@taon-dev/i18n/src';
import { ExampleTranslateComponent } from './example-translate.component';

describe('ExampleTranslateComponent translations', () => {
  beforeAll(async () => {
    await TranslationManager.Instance.setOneLanguagePernament('pl-PL');
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExampleTranslateComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it.each([
    ['.from-t', 't.gettext()'],
    ['.from-directive', 'the translate directive'],
  ])('renders Polish in %s through %s', async selector => {
    const fixture = TestBed.createComponent(ExampleTranslateComponent);
    await fixture.componentInstance.t.changeFileLang('pl-PL');
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.detectChanges();

    const element = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLElement>(selector);

    expect(element?.textContent?.trim()).toBe('to naprawde działa');
  });
});
