import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import postcss from 'postcss';
import { HOST_LAYOUT_RULES } from '../src/host-layout.mjs';
const root=new URL('../',import.meta.url);
test('all exported metadata and browser artifacts exist',async()=>{
  const manifest=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
  for(const file of ['index.js','client.js','client.pdf.js','client.excel.js','client.frontmatter-fields.js','cordis.patch.yml','icon.svg','LICENSE','THIRD_PARTY_NOTICES.md','THIRD_PARTY_LICENSES.txt'])assert.ok((await stat(new URL(file,root))).isFile());
  for(const locale of ['zh','en']){const data=JSON.parse(await readFile(new URL(`locale/${locale}.json`,root),'utf8'));assert.ok(data.meta.title);assert.ok(data.meta.description);}
  assert.equal(manifest.exports['./icon'],'./icon.svg');
  assert.equal(manifest.dsh.bundle.patch,'./cordis.patch.yml');
  assert.ok((await stat(new URL('icon.svg',root))).size<256*1024);
});
test('JSON stylesheet has no global selectors or keyframe names',async()=>{
  const css=postcss.parse(await readFile(new URL('.build/viewer.css',root),'utf8'));
  css.walkRules(rule=>{
    if(rule.parent.type==='atrule'&&/keyframes/i.test(rule.parent.name))return;
    const guardedHostSelectors=new Set(HOST_LAYOUT_RULES.map(r=>r.selector));
    for(const selector of rule.selectors)assert.ok(/^\.bfv-/.test(selector)||guardedHostSelectors.has(selector),`Unscoped selector: ${selector}`);
  });
  css.walkAtRules(/keyframes$/i,rule=>assert.match(rule.params,/^bfv-/));
});
