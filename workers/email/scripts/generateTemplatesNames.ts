/**
 * Script to generate enum with template names
 */
// tslint:disable-next-line:no-var-requires
const path = require('path');
// tslint:disable-next-line:no-var-requires
const fs = require('fs');

function formatName(name: string): string {
  return name
    .split('-')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
}

const names = fs
  .readdirSync(path.resolve(__dirname, '../src/templates'))// read templates directory
  .filter((name) => !name.endsWith('.ts') && name !== 'blocks');

let generatedEnum = '/**\n * File is auto-generated by scripts/generateTemplatesNames.ts\n */\n';

generatedEnum += 'enum Templates {\n';

generatedEnum += names.map((name) => `  ${formatName(name)} = '${name}',`).join('\n');

generatedEnum += '\n}\n\nexport default Templates;\n';

fs.writeFileSync('../src/templates/names.ts', generatedEnum);
