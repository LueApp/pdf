import { cp, mkdir, rm } from 'node:fs/promises';

const files = ['index.html', 'styles.css', 'app.js'];

await rm('dist', { recursive: true, force: true });
await mkdir('dist/vendor', { recursive: true });

await Promise.all([
  ...files.map((file) => cp(file, `dist/${file}`)),
  cp('vendor/pdf-lib.min.js', 'dist/vendor/pdf-lib.min.js'),
]);
