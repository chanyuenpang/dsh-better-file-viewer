import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import postcss from 'postcss';
import {scopeSjeStyles} from '../scripts/scope-sje-styles.mjs';
const root=new URL('../',import.meta.url);
const upstream=await readFile(new URL('vendor/super-json-editor/upstream-styles.css',root),'utf8');
const scoped=postcss.parse(scopeSjeStyles(upstream));
const original=postcss.parse(upstream);
function values(css,selector){const found=[];css.walkRules(rule=>{if(rule.selectors.includes(selector))found.push(Object.fromEntries(rule.nodes.filter(n=>n.type==='decl').map(d=>[d.prop,d.value])));});return found;}
test('SJE default object/table/control declarations are preserved without restyling',()=>{
  for(const selector of ['.property-block','.node-page--object .property-list','.node-page--object .detail-property-item','.detail-input','.nested-entry-button','.data-table','.data-table th','.data-table td','.toolbar']){
    assert.deepEqual(values(scoped,'.bfv-json '+selector),values(original,selector),selector);
  }
});
test('default root palette, fonts and responsive layout variables survive local scoping',()=>{
  const roots=values(scoped,'.bfv-json');
  for(const defaults of values(original,':root'))assert.ok(roots.some(value=>Object.entries(defaults).every(([key,v])=>value[key]===v)));
  assert.ok(roots.some(r=>r['--surface-base']==='#ffffff'));
  assert.ok(roots.some(r=>r['--stack-overlay-left']));
});
test('default selectors and keyframe names cannot leak into the host',()=>{
  scoped.walkRules(rule=>{if(rule.parent.type==='atrule'&&/keyframes/i.test(rule.parent.name))return;for(const selector of rule.selectors)assert.match(selector,/^\.bfv-json/);});
  scoped.walkAtRules(/keyframes$/i,rule=>assert.match(rule.params,/^bfv-/));
});
test('embedding overrides only constrain geometry, never object/array controls or appearance',async()=>{
  const embedding=postcss.parse(await readFile(new URL('src/json-base.css',root),'utf8'));
  const allowed=new Set(['flex','position','inset','min-width','min-height','height','overflow','margin']);
  embedding.walkDecls(d=>assert.ok(allowed.has(d.prop),d.prop));
  const application=await readFile(new URL('src/client.jsx',root),'utf8');
  assert.doesNotMatch(application,/showDocumentTitle=\{false\}|leftPageFullscreen|compactBreakpoint=\{Number.MAX_SAFE_INTEGER\}/);
  const outer=await readFile(new URL('src/styles.css',root),'utf8');
  assert.doesNotMatch(outer,/\.bfv-json \.(property|detail|nested|data-table|node-page|stack-page)/);
  assert.match(outer,/button:not\(\.bfv-json \*\)/);
});
