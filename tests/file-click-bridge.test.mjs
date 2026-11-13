import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileFocusFromClick,createPendingFileRequests } from '../src/file-click-bridge.mjs';
import { consumeFileRequest } from '../src/navigation.mjs';
const facts={sessionId:'session-a',inConversation:true,inFilesView:false,inComposer:false,tag:'BUTTON',fileButton:true,title:'G:\\Project\\docs\\readme.md',button:0};
test('the shipped file-button path reaches the existing file request consumer',()=>{
 const focus=fileFocusFromClick(facts);const queue=createPendingFileRequests();const origin={};
 queue.capture('session-a',focus,origin);const entry=queue.peek('session-a',origin);
 const target=consumeFileRequest(entry.request,null,'session-a','G:\\Project');
 assert.equal(target.path,'G:\\Project/docs/readme.md');assert.deepEqual(target.ancestors,['G:\\Project','G:\\Project/docs']);
});
test('local anchor hrefs retain encoded spaces and line anchors',()=>{
 const focus=fileFocusFromClick({...facts,tag:'A',href:'G:/Project/docs/A%20B.md#L24-L30'});
 const target=consumeFileRequest({view:'better-files',focus},null,'session-a','G:/Project');
 assert.equal(target.path,'G:/Project/docs/A B.md');assert.deepEqual(target.params,{line:24});
});
test('capture excludes external links, modifiers, composer, other surfaces and generic buttons',()=>{
 for(const patch of [{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1},{defaultPrevented:true},{inComposer:true},{inFilesView:true},{inConversation:false},{sessionId:''},{fileButton:false},{tag:'A',href:'https://example.com/x.md'},{tag:'A',href:'#heading'},{tag:'A',href:'mailto:x@example.com'}])assert.equal(fileFocusFromClick({...facts,...patch}),null,JSON.stringify(patch));
});
test('handoff is Session/occurrence scoped, bounded in time and safe to peek twice',()=>{
 let time=100;const queue=createPendingFileRequests({now:()=>time,ttl:5000});const origin={};
 const captured=queue.capture('session-a','file.md',origin);
 assert.equal(queue.peek('session-a',origin),captured);assert.equal(queue.peek('session-a',origin),captured);
 assert.equal(queue.peek('session-a',{}),null);assert.equal(queue.peek('session-b',origin),null);
 time=5101;assert.equal(queue.peek('session-a',origin),null);
});
test('repeat clicks create distinct requests and acknowledging an old one cannot erase the next',()=>{
 const queue=createPendingFileRequests(),origin={};const first=queue.capture('session-a','file.md',origin);const second=queue.capture('session-a','file.md',origin);
 assert.notEqual(first.request,second.request);queue.acknowledge('session-a',first.sequence);assert.equal(queue.peek('session-a',origin),second);
 queue.acknowledge('session-a',second.sequence);assert.equal(queue.peek('session-a',origin),null);
 queue.capture('session-a','file.md',origin);queue.clear();assert.equal(queue.peek('session-a',origin),null);
});
test('observer preserves host navigation and owns listener cleanup',async()=>{
 const source=await readFile(new URL('../src/file-click-bridge.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\.preventDefault\(|\.stopPropagation\(|\.stopImmediatePropagation\(|\.sidebarRight|\.openView\(|\.click\(/);
 for(const event of ['pointerdown','click']){assert.ok(source.includes(`addEventListener('${event}'`));assert.ok(source.includes(`removeEventListener('${event}'`));}
 assert.match(source,/if\(!event\.isTrusted\)return/);
});
test('the pinned upstream markup really exposes a file-path title and fileLink class',async()=>{
 const source=await readFile(new URL('../vendor/dsh/dsh-client-ui-primitives/package/lib/index.js',import.meta.url),'utf8');
 const from=source.indexOf('function MarkdownFileLink('),to=source.indexOf('function inlineCodeHttpUrl(',from);const code=source.slice(from,to);
 assert.match(code,/markdownCss\.fileLink/);assert.match(code,/title: src === void 0 \? file\.path/);assert.match(code,/openFile\(file\.path/);
});
