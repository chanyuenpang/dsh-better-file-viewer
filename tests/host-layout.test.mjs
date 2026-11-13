import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { FILE_SCROLLER, HOST_LAYOUT_RULES, hostLayoutCss } from '../src/host-layout.mjs';
import { layoutStyle } from '../src/core.mjs';
const root=new URL('../',import.meta.url);
function declarations(css,selector){const result={};css.walkRules(rule=>{if(rule.selector===selector)rule.walkDecls(d=>result[d.prop]=d.value);});return result;}
test('host layout rules require our immediate View root in the same Conversation occurrence',()=>{
  assert.equal(HOST_LAYOUT_RULES.length,3);
  for(const {selector}of HOST_LAYOUT_RULES){
    assert.ok(selector.startsWith(FILE_SCROLLER));
    assert.match(selector,/:has\(> \[data-slot="conversation\.session"\] > \* > \[data-slot="conversation\.view"\] > \.bfv-view\)/);
    assert.doesNotMatch(selector,/body|html|sidebar|data-conversation-session=/);
    assert.doesNotThrow(()=>selectorParser().astSync(selector));
  }
});
test('only the matching resident composer is visually hidden and its editor is not disposed',async()=>{
  const hidden=HOST_LAYOUT_RULES.filter(r=>r.declarations.display==='none');
  assert.equal(hidden.length,1);
  assert.equal(hidden[0].selector,`${FILE_SCROLLER} > [data-composer-seat]`);
  const source=await readFile(new URL('src/client.jsx',root),'utf8');
  assert.match(source,/className="bfv-view"/);
  assert.doesNotMatch(source,/inputActions\.(clear|setDraft|setText)|ctx\.sidebarRight|(?:composer|editor)\.remove\(|\.innerHTML\s*=/);
});
test('file View overrides transcript auto-sizing rather than merely adding overflow to its Grid',()=>{
  const css=postcss.parse(hostLayoutCss());
  assert.equal(declarations(css,FILE_SCROLLER).overflow,'hidden');
  const area=HOST_LAYOUT_RULES.find(r=>r.declarations.flex);
  assert.equal(area.declarations.flex,'1 1 0');
  assert.equal(area.declarations['min-height'],'0');
  assert.equal(area.declarations.overflow,'hidden');
});
test('view/frame/Grid are shrinkable and tree/folder own separate scrollports',async()=>{
  const css=postcss.parse(await readFile(new URL('src/styles.css',root),'utf8'));
  for(const selector of ['.bfv-view','.bfv-root','.bfv-panes']){
    const d=declarations(css,selector);assert.equal(d.flex,'1 1 0');assert.equal(d['min-height'],'0');assert.equal(d.overflow,'hidden');assert.notEqual(d.height,'100%');
  }
  assert.equal(declarations(css,'.bfv-tree').overflow,'auto');
  assert.equal(declarations(css,'.bfv-tree')['overscroll-behavior'],'contain');
  assert.equal(declarations(css,'.bfv-folder').overflow,'auto');
  assert.equal(declarations(css,'.bfv-preview').overflow,'hidden');
});
test('all four orientations use zero-min tracks and a fixed divider',()=>{
  for(const direction of ['left','right','top','bottom']){
    const tracks=layoutStyle(direction,27)[['left','right'].includes(direction)?'gridTemplateColumns':'gridTemplateRows'];
    assert.match(tracks,/^minmax\(0, \d+fr\) 6px minmax\(0, \d+fr\)$/);
  }
});
