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
} from '@angular/compiler/cjs';
import { UtilsI18n } from 'tnp-core/src';
import {
  canHaveDecorators,
  ClassDeclaration,
  createSourceFile,
  Decorator,
  Expression,
  forEachChild,
  getDecorators,
  isCallExpression,
  isClassDeclaration,
  isIdentifier,
  isObjectLiteralExpression,
  isPropertyAssignment,
  Node,
  ScriptKind,
  ScriptTarget,
} from 'typescript';

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

  export function replaceTranslatePipieDirectiveTContext(
    html: string,
    options?: {
      angularTsWithInlineHtml?: boolean;
    },
  ): string {
    //#region @backendFunc
    if (options?.angularTsWithInlineHtml || isAngularTsWithInlineHtml(html)) {
      return replaceInAngularInlineTemplates(html);
    }

    return replaceTranslatePipieDirectiveTContextInHtml(html);
    //#endregion
  }

  export function isAngularTsWithInlineHtml(content: string): boolean {
    //#region @backendFunc
    if (
      !content ||
      !content.includes('@Component(') ||
      !content.includes('template')
    ) {
      return false;
    }

    return getAngularInlineTemplateRanges(content).length > 0;
    //#endregion
  }

  function replaceInAngularInlineTemplates(content: string): string {
    //#region @backendFunc
    const ranges = getAngularInlineTemplateRanges(content);

    const edits = ranges.map(range => {
      let changed = replaceTranslatePipieDirectiveTContextInHtml(range.html);

      // double-quoted TS string: template: "<h3 translate></h3>"
      // avoid breaking TS string by using single quotes in Angular binding
      if (range.quote === '"') {
        changed = changed.replaceAll(`[translate-t]="t"`, `[translate-t]='t'`);
      }

      return {
        index: range.start,
        end: range.end,
        text: changed,
      };
    });

    return edits
      .sort((a, b) => b.index - a.index)
      .reduce((acc, edit) => {
        return acc.slice(0, edit.index) + edit.text + acc.slice(edit.end);
      }, content);
    //#endregion
  }

  function getAngularInlineTemplateRanges(content: string): Array<{
    start: number;
    end: number;
    html: string;
    quote: '`' | '"' | "'";
  }> {
    //#region @backendFunc
    const sourceFile = createSourceFile(
      'inline-component.ts',
      content,
      ScriptTarget.Latest,
      true,
      ScriptKind.TS,
    );

    const ranges: Array<{
      start: number;
      end: number;
      html: string;
      quote: '`' | '"' | "'";
    }> = [];

    const visit = (node: Node): void => {
      if (isClassDeclaration(node) && hasComponentDecorator(node)) {
        const decorator = getComponentDecorator(node);

        if (decorator) {
          const templateInitializer =
            getComponentTemplateInitializer(decorator);

          if (templateInitializer) {
            const range = getStringLikeInnerRange(content, templateInitializer);

            if (range) {
              ranges.push(range);
            }
          }
        }
      }

      forEachChild(node, visit);
    };

    visit(sourceFile);

    return ranges;
    //#endregion
  }

  function hasComponentDecorator(node: ClassDeclaration): boolean {
    //#region @backendFunc
    return !!getComponentDecorator(node);
    //#endregion
  }

  function getComponentDecorator(
    node: ClassDeclaration,
  ): Decorator | undefined {
    //#region @backendFunc
    const decorators = canHaveDecorators(node)
      ? getDecorators(node)
      : undefined;

    return decorators?.find(decorator => {
      const expression = decorator.expression;

      return (
        isCallExpression(expression) &&
        isIdentifier(expression.expression) &&
        expression.expression.text === 'Component'
      );
    });
    //#endregion
  }

  function getComponentTemplateInitializer(
    decorator: Decorator,
  ): Expression | undefined {
    //#region @backendFunc
    const expression = decorator.expression;

    if (!isCallExpression(expression)) {
      return;
    }

    const firstArg = expression.arguments[0];

    if (!firstArg || !isObjectLiteralExpression(firstArg)) {
      return;
    }

    const templateProperty = firstArg.properties.find(prop => {
      return (
        isPropertyAssignment(prop) &&
        isIdentifier(prop.name) &&
        prop.name.text === 'template'
      );
    });

    if (!templateProperty || !isPropertyAssignment(templateProperty)) {
      return;
    }

    return templateProperty.initializer;
    //#endregion
  }

  function getStringLikeInnerRange(
    content: string,
    node: Expression,
  ):
    | {
        start: number;
        end: number;
        html: string;
        quote: '`' | '"' | "'";
      }
    | undefined {
    //#region @backendFunc
    const fullText = node.getText();
    const start = node.getStart();
    const quote = fullText[0] as '`' | '"' | "'";

    if (quote !== '`' && quote !== '"' && quote !== "'") {
      return;
    }

    const end = node.getEnd();

    return {
      start: start + 1,
      end: end - 1,
      html: content.slice(start + 1, end - 1),
      quote,
    };
    //#endregion
  }

  export function replaceTranslatePipieDirectiveTContextInHtml(
    html: string,
  ): string {
    //#region @backendFunc
    const edits: Array<{ index: number; text: string }> = [];
    let parsedSuccessfully = false;

    try {
      const parsed = parseTemplate(html, 'template.html', {
        preserveWhitespaces: true,
      });

      parsedSuccessfully = true;

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

        for (const branch of node.branches ?? []) {
          for (const child of branch.children ?? []) {
            visit(child);
          }
        }
      };

      for (const node of parsed.nodes) {
        visit(node);
      }
    } catch {
      // fallback below
    }

    if (!parsedSuccessfully) {
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

    const tagRegex =
      /<([a-zA-Z0-9-]+)\b(?=[^>]*(?:\s|^|<)translate(?:\s|=|>|\/))[^>]*>/g;

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
