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

export namespace UtilsI18nHtml {
  //#region extract gettext translate from html
  export function extractGettextTranslateFromHtml(
    html: string,
    fileName = 'template.html',
  ): UtilsI18n.GettextExtracted[] {
    const parsed = parseTemplate(html, fileName, {
      preserveWhitespaces: true,
    });

    const messages: UtilsI18n.GettextExtracted[] = [];

    const pushMessage = (
      node: any,
      gettextString: string,
      params?: Record<string, string> | null,
      context?: string,
    ) => {
      const normalized = normalizeHtmlText(gettextString);
      if (!normalized) return;

      messages.push({
        lineNumber: node.sourceSpan.start.line + 1,
        gettextString: normalized,
        // params: params ?? null,
        context,
      });
    };

    const visit = (node: any): void => {
      const attrs = getNodeAttributes(node);
      const inputs = getNodeInputs(node);

      const translateAttr = attrs.find((a: any) => a.name === 'translate');

      if (translateAttr) {
        const params =
          extractTranslateParams(inputs) ??
          extractTranslateParamsFromSource(node.sourceSpan.toString());

        // pushMessage(
        //   node,
        //   collectText(node.children ?? []),
        //   extractTranslateParams(inputs),
        //   translateAttr.value || undefined,
        // );

        pushMessage(
          node,
          collectText(node.children ?? []),
          params,
          translateAttr.value || undefined,
        );
      }

      for (const input of inputs) {
        for (const text of extractTranslatePipeStrings(input.value)) {
          pushMessage(node, text);
        }
      }

      if (isBoundText(node)) {
        // for (const text of extractTranslatePipeStrings(node.value)) {
        //   pushMessage(node, text);
        // }

        for (const item of extractGettextCallsFromHtmlExpression(
          node.sourceSpan.toString(),
        )) {
          pushMessage(node, item.gettextString, null, item.context);
        }

        const fromAst = extractTranslatePipeStrings(node.value);
        const fromSource = extractTranslatePipeStringsFromSource(
          node.sourceSpan.toString(),
        );

        for (const text of [...fromAst, ...fromSource]) {
          pushMessage(node, text);
        }
      }

      for (const child of node.children ?? []) {
        visit(child);
      }
    };

    for (const node of parsed.nodes) {
      visit(node);
    }

    if (messages.length === 0) {
      messages.push(...extractTranslateDirectiveFromSource(html));
    }

    return uniqueMessages(messages);
  }
  //#endregion

  //#region helpers

  function extractGettextCallsFromHtmlExpression(source: string): Array<{
    gettextString: string;
    context?: string;
  }> {
    const result: Array<{
      gettextString: string;
      context?: string;
    }> = [];

    const expression = source
      .replace(/^\s*\{\{\s*/, '')
      .replace(/\s*\}\}\s*$/, '')
      .trim();

    const gettextCallRegex = /(?:^|[\s(])(?:[a-zA-Z_$][\w$]*\.)*gettext\s*\(/g;

    for (const match of expression.matchAll(gettextCallRegex)) {
      const openParenIndex = match.index! + match[0].lastIndexOf('(');
      const argsSource = readBalancedParenthesesContent(
        expression,
        openParenIndex,
      );

      if (!argsSource) continue;

      const args = splitTopLevel(argsSource, ',');

      const gettextString = readStaticStringArg(args[0]);
      if (!gettextString) continue;

      const context = readStaticStringArg(args[2]);

      result.push({
        gettextString,
        context,
      });
    }

    return result;
  }

  function readBalancedParenthesesContent(
    source: string,
    openParenIndex: number,
  ): string | null {
    let depth = 0;
    let quote: string | null = null;
    let result = '';

    for (let i = openParenIndex; i < source.length; i++) {
      const char = source[i];

      if (quote) {
        if (i !== openParenIndex) result += char;

        if (char === quote && source[i - 1] !== '\\') {
          quote = null;
        }

        continue;
      }

      if (char === '"' || char === "'" || char === '`') {
        quote = char;
        if (i !== openParenIndex) result += char;
        continue;
      }

      if (char === '(') {
        depth++;

        if (depth > 1) result += char;
        continue;
      }

      if (char === ')') {
        depth--;

        if (depth === 0) {
          return result.trim();
        }

        result += char;
        continue;
      }

      if (i !== openParenIndex) {
        result += char;
      }
    }

    return null;
  }

  function readStaticStringArg(arg: string | undefined): string | undefined {
    if (!arg) return undefined;

    const trimmed = arg.trim();

    const match = trimmed.match(/^(['"`])([\s\S]*)\1$/);
    if (!match) return undefined;

    return match[2];
  }

  function extractTranslateParamsFromSource(
    source: string,
  ): Record<string, string> | null {
    const match = source.match(/\[translate-params\]\s*=\s*"([\s\S]*?)"/);

    if (!match) return null;

    return extractObjectLiteralParams(match[1]);
  }

  function extractObjectLiteralParams(
    raw: string,
  ): Record<string, string> | null {
    const body = raw.trim().replace(/^\{/, '').replace(/\}$/, '').trim();

    if (!body) return null;

    const result: Record<string, string> = {};

    for (const part of splitTopLevel(body, ',')) {
      const colonIndex = part.indexOf(':');
      if (colonIndex === -1) continue;

      const key = part
        .slice(0, colonIndex)
        .trim()
        .replace(/^['"]|['"]$/g, '');
      const value = part.slice(colonIndex + 1).trim();

      if (key && value) {
        result[key] = value;
      }
    }

    return Object.keys(result).length ? result : null;
  }

  function splitTopLevel(input: string, separator: string): string[] {
    const result: string[] = [];
    let current = '';
    let depth = 0;
    let quote: string | null = null;

    for (let i = 0; i < input.length; i++) {
      const char = input[i];

      if (quote) {
        current += char;
        if (char === quote && input[i - 1] !== '\\') quote = null;
        continue;
      }

      if (char === '"' || char === "'" || char === '`') {
        quote = char;
        current += char;
        continue;
      }

      if (char === '{' || char === '(' || char === '[') depth++;
      if (char === '}' || char === ')' || char === ']') depth--;

      if (char === separator && depth === 0) {
        result.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    if (current.trim()) result.push(current.trim());

    return result;
  }

  function extractTranslatePipeStringsFromSource(source: string): string[] {
    const expression = source
      .replace(/^\s*\{\{\s*/, '')
      .replace(/\s*\}\}\s*$/, '')
      .trim();

    if (!expression.includes('| translate')) return [];

    // {{ (cond ? 'Yes' : 'No') | translate }}
    const wrappedConditional = expression.match(
      /^\(([\s\S]+)\)\s*\|\s*translate\b/,
    );
    if (wrappedConditional) {
      return extractStringLiterals(wrappedConditional[1]);
    }

    // {{ row.x ? 'Yes' : 'No' | translate }}
    // Angular means only 'No' is translated
    const directStringPipe = expression.match(
      /(['"`])((?:\\.|(?!\1)[\s\S])*)\1\s*\|\s*translate\b/,
    );
    if (directStringPipe) {
      return [directStringPipe[2].trim()];
    }

    return [];
  }

  function extractStringLiterals(source: string): string[] {
    const result: string[] = [];

    for (const match of source.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g)) {
      const value = match[2].trim();
      if (value) result.push(value);
    }

    return result;
  }

  function getNodeAttributes(node: any): any[] {
    return [
      ...(node.attributes ?? []),
      ...(node.templateAttrs ?? []).filter((a: any) => a.name),
    ];
  }

  function getNodeInputs(node: any): TmplAstBoundAttribute[] {
    return [
      ...(node.inputs ?? []),
      ...(node.templateAttrs ?? []).filter((a: any) => a.value),
    ];
  }

  function isText(node: any): boolean {
    return (
      node?.constructor?.name === 'Text' || typeof node?.value === 'string'
    );
  }

  function isBoundText(node: any): boolean {
    return node?.constructor?.name === 'BoundText' && node?.value;
  }

  function collectText(nodes: any[]): string {
    let result = '';

    for (const node of nodes) {
      if (isText(node) && typeof node.value === 'string') {
        result += node.value;
        continue;
      }

      if (isBoundText(node)) {
        result += node.sourceSpan.toString();
        continue;
      }

      if (node.children) {
        result += collectText(node.children);
      }
    }

    return result;
  }

  function extractTranslateDirectiveFromSource(
    html: string,
  ): UtilsI18n.GettextExtracted[] {
    const messages: UtilsI18n.GettextExtracted[] = [];

    const regex =
      /<([a-zA-Z0-9-]+)(?=[^>]*\stranslate(?:\s|>|=))[^>]*>([\s\S]*?)<\/\1>/g;

    for (const match of html.matchAll(regex)) {
      const fullMatch = match[0];
      const innerHtml = match[2];

      const index = match.index ?? 0;
      const lineNumber = html.slice(0, index).split(/\r?\n/).length;

      const text = normalizeHtmlText(stripHtml(innerHtml));
      if (!text) continue;

      const contextMatch = fullMatch.match(
        /\stranslate\s*=\s*["']([^"']+)["']/,
      );

      messages.push({
        lineNumber,
        gettextString: text,
        context: contextMatch?.[1],
      });
    }

    return messages;
  }

  function stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '');
  }

  function extractTranslateParams(
    inputs: TmplAstBoundAttribute[],
  ): Record<string, string> | null {
    const input = inputs.find(
      (i: any) => i.name === 'translate-params' || i.name === 'translateParams',
    );

    if (!input?.value) return null;

    return extractObjectLiteralFromAst(input.value);
  }

  function extractObjectLiteralFromAst(
    ast: any,
  ): Record<string, string> | null {
    if (ast?.constructor?.name !== 'LiteralMap') return null;

    const result: Record<string, string> = {};

    ast.keys.forEach((keyItem: any, index: number) => {
      const key = typeof keyItem === 'string' ? keyItem : keyItem.key;
      const value = ast.values[index];

      if (key && value) {
        result[key] = astToSource(value);
      }
    });

    return Object.keys(result).length ? result : null;
  }

  function extractTranslatePipeStrings(ast: AST | any): string[] {
    const result: string[] = [];

    const visit = (node: any): void => {
      if (!node || typeof node !== 'object') return;

      if (
        node.constructor?.name === 'BindingPipe' &&
        node.name === 'translate'
      ) {
        result.push(...extractStaticStringsFromExpression(node.exp));
        return;
      }

      for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
          for (const item of value) visit(item);
        } else if (value && typeof value === 'object') {
          visit(value);
        }
      }
    };

    visit(ast);

    return result;
  }

  function extractStaticStringsFromExpression(ast: any): string[] {
    if (!ast) return [];

    if (
      ast.constructor?.name === 'LiteralPrimitive' &&
      typeof ast.value === 'string'
    ) {
      return [ast.value];
    }

    if (ast.constructor?.name === 'Conditional') {
      return [
        ...extractStaticStringsFromExpression(ast.trueExp),
        ...extractStaticStringsFromExpression(ast.falseExp),
      ];
    }

    if (ast.constructor?.name === 'BindingPipe' && ast.name === 'translate') {
      return extractStaticStringsFromExpression(ast.exp);
    }

    return [];
  }

  function astToSource(ast: any): string {
    if (!ast) return '';

    if (typeof ast.source === 'string') {
      return ast.source;
    }

    if (ast.constructor?.name === 'PropertyRead') {
      const receiver = astToSource(ast.receiver);
      return receiver ? `${receiver}.${ast.name}` : ast.name;
    }

    if (ast.constructor?.name === 'ImplicitReceiver') {
      return '';
    }

    if (ast.constructor?.name === 'LiteralPrimitive') {
      return typeof ast.value === 'string'
        ? `'${ast.value}'`
        : String(ast.value);
    }

    return ast.toString?.() === '[object Object]' ? '' : String(ast);
  }

  function normalizeHtmlText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  function uniqueMessages(
    messages: UtilsI18n.GettextExtracted[],
  ): UtilsI18n.GettextExtracted[] {
    const seen = new Set<string>();

    return messages.filter(message => {
      const key = JSON.stringify([
        message.lineNumber,
        message.gettextString,
        message.context,
      ]);

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });
  }
  //#endregion

  //#region replace translate pipie directive t context
  export function replaceTranslatePipieDirectiveTContext(html: string): string {
    const edits: Array<{ index: number; text: string }> = [];

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

    let result = applyEdits(html, edits);

    result = result.replace(
      /\|\s*translate(?!\s*:)(?=[\s)}\]"';<]|$)/g,
      '| translate:t',
    );

    return result;
  }
  //#endregion

  //#region helpers
  function hasTranslateDirective(node: any): boolean {
    return [...(node.attributes ?? []), ...(node.templateAttrs ?? [])].some(
      (attr: any) => attr.name === 'translate',
    );
  }

  function hasTranslateTInput(node: any): boolean {
    return [
      ...(node.inputs ?? []),
      ...(node.templateAttrs ?? []),
      ...(node.attributes ?? []),
    ].some(
      (attr: any) => attr.name === 'translate-t' || attr.name === 'translateT',
    );
  }

  function findOpenTagInsertPosition(
    html: string,
    start: number,
    length: number,
  ): number {
    const end = start + length;
    const openingTag = html.slice(start, end);

    const closeIndex = openingTag.lastIndexOf('>');
    if (closeIndex === -1) return -1;

    const beforeClose = openingTag.slice(0, closeIndex);

    if (beforeClose.trimEnd().endsWith('/')) {
      return start + beforeClose.lastIndexOf('/');
    }

    return start + closeIndex;
  }

  function applyEdits(
    input: string,
    edits: Array<{ index: number; text: string }>,
  ): string {
    return [...edits]
      .sort((a, b) => b.index - a.index)
      .reduce((acc, edit) => {
        return acc.slice(0, edit.index) + edit.text + acc.slice(edit.index);
      }, input);
  }
  //#endregion
}
