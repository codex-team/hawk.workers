import { extractScriptFromSFC, getBabelParserPluginsForFile } from '../src/utils';

describe('extractScriptFromSFC', () => {
  it('returns passed source code and line with hasTypeScriptLang false when sourcePath is not provided', () => {
    const sourceCode = `line1\nline2\nline3`;

    expect(extractScriptFromSFC(sourceCode, 2)).toEqual({
      code: sourceCode,
      targetLine: 2,
      hasTypeScriptLang: false,
    });
  });

  it('returns default result when sourcePath is not a framework file (.vue/.svelte)', () => {
    const sourceCode = `<script>console.log(1)</script>`;

    expect(extractScriptFromSFC(sourceCode, 1, 'src/app.ts')).toEqual({
      code: sourceCode,
      targetLine: 1,
      hasTypeScriptLang: false,
    });
  });

  it('extracts the script block that contains the originalLine (Vue) and computes relative line', () => {
    // Line numbers:
    // 1: <template></template>
    // 2: <script>
    // 3: const a = 1;
    // 4: const b = 2;
    // 5: </script>
    const sourceCode =
      `<template></template>\n` +
      `<script>\n` +
      `const a = 1;\n` +
      `const b = 2;\n` +
      `</script>\n`;

    const res = extractScriptFromSFC(sourceCode, 4, 'src/App.vue');

    // startLine = 2 (line with <script>)
    // originalLine = 4 => relativeLine = 4 - 2 + 1 = 3
    expect(res.code).toBe(`\nconst a = 1;\nconst b = 2;\n`);
    expect(res.targetLine).toBe(3);
    expect(res.hasTypeScriptLang).toBe(false);
  });

  it('detects TypeScript lang in script attributes (lang="ts")', () => {
    const sourceCode =
      `<template></template>\n` +
      `<script lang="ts">\n` +
      `let x: number = 1;\n` +
      `</script>\n`;

    const res = extractScriptFromSFC(sourceCode, 3, 'src/App.vue');

    expect(res.hasTypeScriptLang).toBe(true);
  });

  it('detects TypeScript lang in script attributes (lang=typescript, no quotes)', () => {
    const sourceCode =
      `<script lang=typescript>\n` +
      `let y: number = 2;\n` +
      `</script>\n`;

    const res = extractScriptFromSFC(sourceCode, 2, 'src/App.svelte');

    expect(res.hasTypeScriptLang).toBe(true);
  });

  it('picks the script block related to the target line when there are multiple <script> tags', () => {
    const targetLine = 5;
    const startLine = 4;

    // Lines:
    // 1 <script>
    // 2 console.log("first");
    // 3 </script>
    // 4 <script lang="ts">
    // 5 let z: number = 3;
    // 6 </script>
    const sourceCode =
      `<script>\n` +
      `console.log("first");\n` +
      `</script>\n` +
      `<script lang="ts">\n` +
      `let z: number = 3;\n` +
      `</script>\n`;

    const res = extractScriptFromSFC(sourceCode, targetLine, 'src/App.vue');

    expect(res.code).toBe(`\nlet z: number = 3;\n`);
    expect(res.targetLine).toBe(targetLine - startLine + 1);
    expect(res.hasTypeScriptLang).toBe(true);
  });

  it('returns default result when originalLine does not fall inside any script block', () => {
    const sourceCode =
      `<template>\n` +
      `<div>hello</div>\n` +
      `</template>\n` +
      `<script>\n` +
      `console.log("x");\n` +
      `</script>\n`;

    // line 2 is inside template, not script
    const res = extractScriptFromSFC(sourceCode, 2, 'src/App.vue');

    expect(res).toEqual({
      code: sourceCode,
      targetLine: 2,
      hasTypeScriptLang: false,
    });
  });

  it('handles script tag with attributes and inline content', () => {
    const sourceCode = `<script setup lang="ts">const a: number = 1;</script>\n`;
    // originalLine 1 is the line containing <script ...> and content is inline
    const res = extractScriptFromSFC(sourceCode, 1, 'src/App.vue');

    expect(res.code).toBe(`const a: number = 1;`);
    expect(res.targetLine).toBe(1);
    expect(res.hasTypeScriptLang).toBe(true);
  });
});

describe('getBabelParserPluginsForFile', () => {
  const base = [
    'classProperties',
    'decorators',
    'optionalChaining',
    'nullishCoalescingOperator',
    'dynamicImport',
    'bigInt',
    'topLevelAwait',
  ];

  it('enables TypeScript by default when sourcePath is undefined', () => {
    const plugins = getBabelParserPluginsForFile(undefined, false);

    expect(plugins).toEqual([...base, 'typescript']);
  });

  it('for .ts enables TypeScript only', () => {
    const plugins = getBabelParserPluginsForFile('src/App.ts', false);

    expect(plugins).toEqual([...base, 'typescript']);
  });

  it('for .d.ts enables TypeScript only', () => {
    const plugins = getBabelParserPluginsForFile('src/types.d.ts', false);

    expect(plugins).toEqual([...base, 'typescript']);
  });

  it('for .tsx enables TypeScript + JSX', () => {
    const plugins = getBabelParserPluginsForFile('src/App.tsx', false);

    expect(plugins).toEqual([...base, 'typescript', 'jsx']);
  });

  it('for .jsx enables JSX only (no TypeScript)', () => {
    const plugins = getBabelParserPluginsForFile('src/App.jsx', false);

    expect(plugins).toEqual([...base, 'jsx']);
  });

  it('for .vue enables one of JSX or TypeScript based on hasTypeScriptLang value', () => {
    const pluginsNoTs = getBabelParserPluginsForFile('src/App.vue', false);

    expect(pluginsNoTs).toEqual([...base, 'jsx']);

    const pluginsWithTs = getBabelParserPluginsForFile('src/App.vue', true);

    expect(pluginsWithTs).toEqual([...base, 'typescript']);
  });

  it('for .svelte enables one of JSX or TypeScript based on hasTypeScriptLang value', () => {
    const pluginsNoTs = getBabelParserPluginsForFile('src/App.svelte', false);

    expect(pluginsNoTs).toEqual([...base, 'jsx']);

    const pluginsWithTs = getBabelParserPluginsForFile('src/App.svelte', true);

    expect(pluginsWithTs).toEqual([...base, 'typescript']);
  });

  it('for .js enables JSX without TypeScript when hasTypeScriptLang is false', () => {
    const plugins = getBabelParserPluginsForFile('src/App.js', false);

    expect(plugins).toEqual([...base, 'jsx']);
  });
});
