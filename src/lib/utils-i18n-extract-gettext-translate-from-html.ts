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
//#endregion

export namespace UtilsI18nExtractGettextTranslateFromHtml {
  export function extractGettextTranslateFromHtml(
    html: string,
    fileName = 'template.html',
  ): UtilsI18n.GettextExtracted[] {
    //#region @backendFunc
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

    messages.push(...extractGettextCallsFromSource(html));

    return uniqueMessages(messages);
    //#endregion
  }

  function extractGettextCallsFromSource(
    html: string,
  ): UtilsI18n.GettextExtracted[] {
    //#region @backendFunc
    const messages: UtilsI18n.GettextExtracted[] = [];

    const regex = /(?:^|[\s([{?:=])(?:[a-zA-Z_$][\w$]*\.)*gettext\s*\(/g;

    for (const match of html.matchAll(regex)) {
      const matchIndex = match.index ?? 0;
      const openParenIndex = matchIndex + match[0].lastIndexOf('(');

      const argsSource = readBalancedParenthesesContent(html, openParenIndex);
      if (!argsSource) continue;

      const args = splitTopLevel(argsSource, ',');

      const gettextString = readStaticStringArg(args[0]);
      if (!gettextString) continue;

      const context = readStaticStringArg(args[2]);

      messages.push({
        lineNumber: html.slice(0, matchIndex).split(/\r?\n/).length,
        gettextString,
        context,
      });
    }

    return messages;
    //#endregion
  }

  function extractGettextCallsFromHtmlExpression(source: string): Array<{
    gettextString: string;
    context?: string;
  }> {
    //#region @backendFunc
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
    //#endregion
  }

  function readBalancedParenthesesContent(
    source: string,
    openParenIndex: number,
  ): string | null {
    //#region @backendFunc
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
    //#endregion
  }

  function readStaticStringArg(arg: string | undefined): string | undefined {
    //#region @backendFunc
    if (!arg) return undefined;

    const trimmed = arg.trim();

    const match = trimmed.match(/^(['"`])([\s\S]*)\1$/);
    if (!match) return undefined;

    const quote = match[1];
    const value = match[2];

    if (quote === '`' && value.includes('${')) {
      return undefined;
    }

    return value;
    //#endregion
  }

  function extractTranslateParamsFromSource(
    source: string,
  ): Record<string, string> | null {
    //#region @backendFunc
    const match = source.match(/\[translate-params\]\s*=\s*"([\s\S]*?)"/);

    if (!match) return null;

    return extractObjectLiteralParams(match[1]);
    //#endregion
  }

  function extractObjectLiteralParams(
    raw: string,
  ): Record<string, string> | null {
    //#region @backendFunc
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
    //#endregion
  }

  function splitTopLevel(input: string, separator: string): string[] {
    //#region @backendFunc
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
    //#endregion
  }

  function extractTranslatePipeStringsFromSource(source: string): string[] {
    //#region @backendFunc
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
    //#endregion
  }

  function extractStringLiterals(source: string): string[] {
    //#region @backendFunc
    const result: string[] = [];

    for (const match of source.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g)) {
      const value = match[2].trim();
      if (value) result.push(value);
    }

    return result;
    //#endregion
  }

  function getNodeAttributes(node: any): any[] {
    //#region @backendFunc
    return [
      ...(node.attributes ?? []),
      ...(node.templateAttrs ?? []).filter((a: any) => a.name),
    ];
    //#endregion
  }

  function getNodeInputs(node: any): TmplAstBoundAttribute[] {
    //#region @backendFunc
    return [
      ...(node.inputs ?? []),
      ...(node.templateAttrs ?? []).filter((a: any) => a.value),
    ];
    //#endregion
  }

  function isText(node: any): boolean {
    //#region @backendFunc
    return (
      node?.constructor?.name === 'Text' || typeof node?.value === 'string'
    );
    //#endregion
  }

  function isBoundText(node: any): boolean {
    //#region @backendFunc
    return node?.constructor?.name === 'BoundText' && node?.value;
    //#endregion
  }

  function collectText(nodes: any[]): string {
    //#region @backendFunc
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
    //#endregion
  }

  function extractTranslateDirectiveFromSource(
    html: string,
  ): UtilsI18n.GettextExtracted[] {
    //#region @backendFunc
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
    //#endregion
  }

  function stripHtml(html: string): string {
    //#region @backendFunc
    return html.replace(/<[^>]+>/g, '');
    //#endregion
  }

  function extractTranslateParams(
    inputs: TmplAstBoundAttribute[],
  ): Record<string, string> | null {
    //#region @backendFunc
    const input = inputs.find(
      (i: any) => i.name === 'translate-params' || i.name === 'translateParams',
    );

    if (!input?.value) return null;

    return extractObjectLiteralFromAst(input.value);
    //#endregion
  }

  function extractObjectLiteralFromAst(
    ast: any,
  ): Record<string, string> | null {
    //#region @backendFunc
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
    //#endregion
  }

  function extractTranslatePipeStrings(ast: AST | any): string[] {
    //#region @backendFunc
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
    //#endregion
  }

  function extractStaticStringsFromExpression(ast: any): string[] {
    //#region @backendFunc
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
    //#endregion
  }

  function astToSource(ast: any): string {
    //#region @backendFunc
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
    //#endregion
  }

  function normalizeHtmlText(text: string): string {
    //#region @backendFunc
    return text.replace(/\s+/g, ' ').trim();
    //#endregion
  }

  function uniqueMessages(
    messages: UtilsI18n.GettextExtracted[],
  ): UtilsI18n.GettextExtracted[] {
    //#region @backendFunc
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
    //#endregion
  }
  //#endregion
}
