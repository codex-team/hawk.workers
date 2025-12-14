import { JavaScriptAddons } from '@hawk.so/types';
import useragent from 'useragent';
import { extname } from 'path';

/**
 * Converts userAgent to strict format for: browser browserVersion / OS OsVersion
 *
 * @param userAgent - user agent
 */
export function beautifyUserAgent(userAgent: string): JavaScriptAddons['beautifiedUserAgent'] {
  let beautifiedAgent: JavaScriptAddons['beautifiedUserAgent'] = {
    os: '',
    osVersion: '',
    browser: '',
    browserVersion: '',
  };

  try {
    const agent = useragent.parse(userAgent);

    beautifiedAgent = {
      os: agent.os.family,
      osVersion: agent.os.toVersion(),
      browser: agent.family,
      browserVersion: agent.toVersion(),
    };
  } catch {
    console.error('Cannot parse user-agent ' + userAgent);
  }

  return beautifiedAgent;
}

/**
 * Count line breaks in the provided string.
 *
 * @param value - string to inspect
 */
export function countLineBreaks(value: string): number {
  if (!value) {
    return 0;
  }

  const matches = value.match(/\r\n|\r|\n/g);

  return matches ? matches.length : 0;
}

/**
 * Strip query and hash fragments from a source path.
 *
 * @param sourcePath - path that may contain query/hash suffix
 */
export function cleanSourcePath(sourcePath: string): string {
  return sourcePath.split('?')[0].split('#')[0];
}

/**
 * Method that extracts source code and target line from the source code related to js frameworks
 * It is used to extract inner part of the <script> tag with its lang specifier
 *
 * @param sourceCode - content of the source file
 * @param originalLine - number of the line from the stack trace where the error occurred
 * @param sourcePath - original source path from the source map (used to pick parser plugins)
 * @returns - object with source code, target line and if it has TypeScript language specifier
 */
export function extractScriptFromSFC(
  sourceCode: string,
  originalLine: number,
  sourcePath?: string
): { code: string; targetLine: number; hasTypeScriptLang: boolean } {
  const defaultResult = {
    code: sourceCode,
    targetLine: originalLine,
    hasTypeScriptLang: false,
  };

  if (!sourcePath) {
    return defaultResult;
  }

  const cleanPath = cleanSourcePath(sourcePath);
  const ext = extname(cleanPath).toLowerCase();
  const frameworkExtensions = new Set(['.vue', '.svelte']);

  if (!frameworkExtensions.has(ext)) {
    return defaultResult;
  }

  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(sourceCode)) !== null) {
    const attrs = match[1] ?? '';
    const content = match[2] ?? '';
    const before = sourceCode.slice(0, match.index);
    const startLine = countLineBreaks(before) + 1;
    const linesInBlock = countLineBreaks(content) + 1;
    const endLine = startLine + linesInBlock - 1;

    if (originalLine >= startLine && originalLine <= endLine) {
      const relativeLine = originalLine - startLine + 1;
      const hasTypeScriptLang = /lang\s*=\s*["']?(ts|typescript)["']?/i.test(attrs);

      return {
        code: content,
        targetLine: relativeLine,
        hasTypeScriptLang,
      };
    }
  }

  return defaultResult;
}

/**
 * Choose babel parser plugins based on source file extension
 *
 * @param sourcePath - original file path from source map (e.g. "src/App.tsx")
 * @param hasTypeScriptLang
 */
export function getBabelParserPluginsForFile(sourcePath?: string, hasTypeScriptLang?: boolean): any[] {
  const basePlugins: string[] = [
    'classProperties',
    'decorators',
    'optionalChaining',
    'nullishCoalescingOperator',
    'dynamicImport',
    'bigInt',
    'topLevelAwait',
  ];

  let enableTypeScript = Boolean(hasTypeScriptLang);
  let enableJSX = false;

  if (sourcePath) {
    const cleanPath = cleanSourcePath(sourcePath);
    const ext = extname(cleanPath).toLowerCase();

    const isTypeScript = ext === '.ts' || ext === '.d.ts';
    const isTypeScriptWithJsx = ext === '.tsx';
    const isJavaScriptWithJsx = ext === '.jsx';
    const isFrameworkFile = ext === '.vue' || ext === '.svelte';
    const isJavaScript = ext === '.js' || ext === '.mjs' || ext === '.cjs';

    if (isTypeScriptWithJsx) {
      enableTypeScript = true;
      enableJSX = true;
    } else {
      enableTypeScript = enableTypeScript || isTypeScript;

      if (!enableTypeScript && (isJavaScriptWithJsx || isJavaScript || isFrameworkFile)) {
        enableJSX = true;
      }
    }
  } else {
    enableTypeScript = true;
  }

  if (enableTypeScript) {
    basePlugins.push('typescript');
  }

  if (enableJSX) {
    basePlugins.push('jsx');
  }

  return basePlugins;
}