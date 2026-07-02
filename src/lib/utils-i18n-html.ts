//#region imports
import {
  AST,
  Binary,
  BindingPipe,
  Conditional,
  Interpolation,
  LiteralPrimitive,
  parseTemplate,
  TmplAstBoundAttribute,
  TmplAstBoundText,
  TmplAstElement,
  TmplAstNode,
  TmplAstTemplate,
  TmplAstText,
} from '@angular/compiler';
import { UtilsI18n } from 'tnp-core/src';
import { UtilsI18nExtractGettextTranslateFromHtml } from './utils-i18n-extract-gettext-translate-from-html';
//#endregion

export namespace UtilsI18nHtml {
  export function extractGettextTranslateFromHtml(
    html: string,
    fileName = 'template.html',
  ): UtilsI18n.GettextExtracted[] {
    return UtilsI18nExtractGettextTranslateFromHtml.extractGettextTranslateFromHtml(
      html,
      fileName,
    );
  }

  export function replaceTranslatePipieDirectiveTContext(html: string): string {
    //#region @backendFunc
    const edits: Array<{ index: number; text: string }> = [];

    try {
      const parsed = parseTemplate(html, 'template.html', {
        preserveWhitespaces: true,
      });

      const visit = (node: any): void => {
        if (hasTranslateDirective(node) && !hasTranslateTInput(node)) {
          const opening = node.startSourceSpan?.toString?.();

          if (opening) {
            const start = node.startSourceSpan.start.offset;
            const insertAt = findOpenTagInsertPosition(
              html,
              start,
              opening.length,
            );

            if (insertAt !== -1) {
              edits.push({
                index: insertAt,
                text: ` [translate-t]="t"`,
              });
            }
          }
        }

        for (const child of node.children ?? []) {
          visit(child);
        }
      };

      for (const node of parsed.nodes) {
        visit(node);
      }
    } catch {
      // fallback below
    }

    if (edits.length === 0) {
      edits.push(...findTranslateDirectiveEditsFromSource(html));
    }

    let result = applyEdits(html, edits);

    result = result.replace(
      /\|\s*translate(?!\s*:)(?=[\s)}\]"';<]|$)/g,
      '| translate:t',
    );

    return result;
    //#endregion
  }

  function findTranslateDirectiveEditsFromSource(
    html: string,
  ): Array<{ index: number; text: string }> {
    //#region @backendFunc
    const edits: Array<{ index: number; text: string }> = [];

    const tagRegex = /<([a-zA-Z0-9-]+)\b[^>]*\btranslate\b[^>]*>/g;

    for (const match of html.matchAll(tagRegex)) {
      const tag = match[0];
      const start = match.index ?? 0;

      if (/\[translate-t\]\s*=/.test(tag) || /\btranslateT\b/.test(tag)) {
        continue;
      }

      const closeIndex = tag.lastIndexOf('>');
      if (closeIndex === -1) continue;

      const beforeClose = tag.slice(0, closeIndex);
      const insertAt = beforeClose.trimEnd().endsWith('/')
        ? start + beforeClose.lastIndexOf('/')
        : start + closeIndex;

      edits.push({
        index: insertAt,
        text: ` [translate-t]="t"`,
      });
    }

    return edits;
    //#endregion
  }

  function hasTranslateDirective(node: any): boolean {
    //#region @backendFunc
    return [...(node.attributes ?? []), ...(node.templateAttrs ?? [])].some(
      (attr: any) => attr.name === 'translate',
    );
    //#endregion
  }

  function hasTranslateTInput(node: any): boolean {
    //#region @backendFunc
    return [
      ...(node.inputs ?? []),
      ...(node.templateAttrs ?? []),
      ...(node.attributes ?? []),
    ].some(
      (attr: any) => attr.name === 'translate-t' || attr.name === 'translateT',
    );
    //#endregion
  }

  function findOpenTagInsertPosition(
    html: string,
    start: number,
    length: number,
  ): number {
    //#region @backendFunc
    const end = start + length;
    const openingTag = html.slice(start, end);

    const closeIndex = openingTag.lastIndexOf('>');
    if (closeIndex === -1) return -1;

    const beforeClose = openingTag.slice(0, closeIndex);

    if (beforeClose.trimEnd().endsWith('/')) {
      return start + beforeClose.lastIndexOf('/');
    }

    return start + closeIndex;
    //#endregion
  }

  function applyEdits(
    input: string,
    edits: Array<{ index: number; text: string }>,
  ): string {
    //#region @backendFunc
    return [...edits]
      .sort((a, b) => b.index - a.index)
      .reduce((acc, edit) => {
        return acc.slice(0, edit.index) + edit.text + acc.slice(edit.index);
      }, input);
    //#endregion
  }
}
