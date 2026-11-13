import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const version = '0.2.2-rc.1';
const packages = {
  'dsh-client-ui-primitives': 'sha512-6ZUYgZ6XYmh/twuwGzKPA4XH3RSODl4b1W4p1pqoFJ7xLn1EroEmA+E/sqa5Z2+JvFWxfPttsHTHkOyH8uK8Tg==',
  'dsh-client-store': 'sha512-qMqkH1udz0pBjYi/S+KxEb4C70y6akJjdXxldXIy86h7fH+nAnzOC8+ooV8soz3tidCFtgS6MKcKOm1rvPmFSg==',
  'dsh-client-ui-sidebar-documentpreview': 'sha512-Ozkd9K4SRHBenwdD9ULHRNKJ1RiWQmA7vkMvR9eEt4AlBDk8vTCknXvfy+15o+0sMEOvZFbTZvj/r7Kji0Mx+g=='
};
for (const [name, integrity] of Object.entries(packages)) {
  const dir = path.join(root, 'vendor', 'dsh', name);
  await mkdir(dir, { recursive: true });
  const response = await fetch(`https://registry.npmjs.org/@deepseek-ai/${name}/-/${name}-${version}.tgz`);
  if (!response.ok) throw new Error(`Download ${name}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if ('sha512-' + createHash('sha512').update(bytes).digest('base64') !== integrity) throw new Error(`Integrity mismatch: ${name}`);
  const archive = path.join(dir, 'upstream.tgz');
  await writeFile(archive, bytes);
  const result = spawnSync('tar', ['-xzf', archive, '-C', dir], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Extract ${name}: ${result.status}`);
  const manifest = JSON.parse(await readFile(path.join(dir, 'package', 'package.json'), 'utf8'));
  if (manifest.version !== version) throw new Error(`Version mismatch: ${name}`);
  console.log(`Verified ${manifest.name}@${manifest.version}`);
}
