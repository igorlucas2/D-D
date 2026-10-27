/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS fora do bundle */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const committed = path.join(root, 'src', 'lib', 'openapi.d.ts');
const temp = path.join(root, '.openapi.generated.d.ts');
const cli = path.join(
  root,
  'node_modules',
  'openapi-typescript',
  'bin',
  'cli.js',
);
const spec = path.join(root, '..', 'docs', 'openapi.json');

try {
  execFileSync(process.execPath, [cli, spec, '-o', temp], {
    stdio: 'inherit',
    cwd: root,
  });

  const normalize = (value) => value.replace(/\r\n/g, '\n');
  const expected = normalize(fs.readFileSync(committed, 'utf8'));
  const actual = normalize(fs.readFileSync(temp, 'utf8'));

  if (expected !== actual) {
    console.error(
      'src/lib/openapi.d.ts está desatualizado. Rode `npm run api:types` e commite o resultado.',
    );
    process.exit(1);
  }
  console.log('Tipos do OpenAPI em dia.');
} finally {
  fs.rmSync(temp, { force: true });
}
