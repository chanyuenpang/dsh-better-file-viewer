import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = process.argv[2] ?? 'G:/Projects/super-json-editor';
const target = path.join(root, 'vendor/super-json-editor');
await mkdir(path.join(target, 'src'), { recursive: true });
for (const part of ['core', 'editor']) await cp(path.join(source, 'src', part), path.join(target, 'src', part), { recursive: true });
await cp(path.join(source, 'src/styles.css'), path.join(target, 'upstream-styles.css'));
await cp(path.join(source, 'package.json'), path.join(target, 'upstream-package.json'));
const hashes = {};
async function record(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name);
    if (e.isDirectory()) await record(file);
    else hashes[path.relative(target, file).replaceAll('\\', '/')] = createHash('sha256').update(await readFile(file)).digest('hex');
  }
}
await record(path.join(target, 'src'));
await writeFile(path.join(target, 'provenance.json'), JSON.stringify({ source, capturedAt: new Date().toISOString(), files: hashes }, null, 2) + '\n');
console.log(`Snapshotted ${Object.keys(hashes).length} editor files without modifying source`);
