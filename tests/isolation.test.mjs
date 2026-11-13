import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { adaptPreview, factoryBody, UPSTREAM } from '../scripts/fork-preview.mjs';
const root=new URL('../',import.meta.url);
const raw=await readFile(new URL('vendor/dsh/dsh-client-ui-sidebar-documentpreview/package/lib/client.js',root),'utf8');
test('fork is an isolated Factory and never registers or controls sidebar types',()=>{
  const fork=adaptPreview(raw);
  assert.match(fork,/name: "betterFiles\.preview"/);
  assert.match(fork,/scope: "session"/);
  assert.match(fork,/hooks: \{ previewInfo: previewInfoFactory \}/);
  assert.match(fork,/hooks: \{ betterFilesPreviews: source \}/);
  assert.match(fork,/useBetterFilesPreviews/);
  assert.match(fork,/betterFiles\.document\.office\.pdf/);
  assert.doesNotMatch(fork,/ctx\.sidebarRight|name: "sidebar\.|ctx\.documentPreviews/);
  assert.doesNotMatch(fork,/provide\("documentPreviews"/);
  assert.doesNotMatch(fork,/useTabInfo/);
  const namespaces=[...raw.matchAll(/(?:locale\.(?:register|bind)\(|const NS(?:\$\d+)? = )"([^"]+)"/g)].map(m=>m[1]);
  for(const namespace of new Set(namespaces))assert.ok(fork.includes(`"betterFiles.${namespace}"`),`locale namespace ${namespace} must be isolated`);
  assert.doesNotThrow(()=>new vm.Script(`(function(require){${factoryBody(fork)}})`));
});
test('upstream adapter fails closed when its pinned registration anchor changes',()=>{
  assert.throws(()=>adaptPreview(raw.replace('ctx.sidebarRightTabs.register(textDefinition())','ctx.changed.register(textDefinition())')),/anchor changed/);
});
test('browser entry only registers one independent module and keeps React external',async()=>{
  const source=await readFile(new URL('client.js',root),'utf8');const modules=[];
  vm.runInNewContext(source,{window:{__ModuleLoader__:{load:r=>modules.push(r)}}});
  assert.deepEqual(modules.map(m=>m.id),['dsh-better-file-viewer']);
  assert.equal(typeof modules[0].factory,'function');
  assert.doesNotMatch(source,/require\(["']@deepseek-ai\/dsh-client-/);
  assert.doesNotMatch(source,/ctx\.sidebarRight(?:Tabs)?\./);
  assert.match(source,/require\("react"\)/);
});
test('lazy format chunks are self contained and namespaced',async()=>{
  for(const name of ['client.frontmatter-fields.js','client.pdf.js','client.excel.js']){
    const source=await readFile(new URL(name,root),'utf8');const modules=[];
    vm.runInNewContext(source,{window:{__ModuleLoader__:{load:r=>modules.push(r)}}});
    assert.equal(modules[0].id,'dsh-better-file-viewer');assert.equal(modules[0].chunk,name);
    assert.doesNotMatch(source,/require\(["']@deepseek-ai\/dsh-client-/);
    assert.doesNotMatch(source,new RegExp(UPSTREAM.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
});
test('bundle patch inserts only its own row without overrides',async()=>{
  const patch=await readFile(new URL('cordis.patch.yml',root),'utf8');
  assert.doesNotMatch(patch,/override|disabled|sidebar/);assert.match(patch,/name: dsh-better-file-viewer/);
});
