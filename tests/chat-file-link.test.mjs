import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {exposeNativeLinkCollector} from '../scripts/native-link-collector.mjs';
import {resolveChatFileLink,createChatLinkSources} from '../src/chat-file-link.mjs';
import {fileFocusFromClick} from '../src/file-click-bridge.mjs';
import {consumeFileRequest} from '../src/navigation.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const native=fileURLToPath(new URL('../vendor/dsh/dsh-client-ui-primitives/package/lib/index.js',import.meta.url));
const source=await readFile(native,'utf8');
const bundled=await build({absWorkingDir:root,stdin:{contents:exposeNativeLinkCollector(source)+'\nexport {collectNativeFileLinks as collect};',resolveDir:fileURLToPath(new URL('../vendor/dsh/dsh-client-ui-primitives/package/lib/',import.meta.url)),sourcefile:'native-link-collector.js'},bundle:true,platform:'node',format:'cjs',write:false,outfile:root+'/.build/test-native-collector.js',external:['react','react-dom','react/jsx-runtime'],alias:{'@deepseek-ai/dsh-client-store':fileURLToPath(new URL('../vendor/dsh/dsh-client-store/package/lib/index.js',import.meta.url))},loader:{'.css':'empty','.woff2':'dataurl','.woff':'dataurl','.ttf':'dataurl'},logLevel:'silent'});
const module={exports:{}};new Function('require','module','exports',bundled.outputFiles.find(f=>f.path.endsWith('.js')).text)(createRequire(import.meta.url),module,module.exports);
const collect=module.exports.collect;
const markdown='[same](<assets/A%20B.png>) [same](other.png) [doc](docs/a.md#L24-L30) [external](https://example.com/x.png) ![inline](not-a-file-link.png)';
const node={key:'assistant-step:1',kind:'assistant-step',data:{status:'settled',blocks:[{kind:'reasoning',text:'reasoning'},{kind:'text',text:markdown}]}};
const position={nodeKey:node.key,blockIndex:0,blockCount:1,linkIndex:1,linkCount:3,checks:[{index:2,path:'docs/a.md'}]};
test('actual pinned parser collects native local links, not captions or inline/external images',()=>{
 assert.deepEqual(collect(markdown),[{path:'assets/A B.png'},{path:'other.png'},{path:'docs/a.md',line:24}]);
});
test('native references, linked thumbnails, code, math and footnotes keep rendered link order',()=>{
 const text='[same][pic]\n\n[![thumb](thumb.png)](full.png) `not.png` $x$ [body](body.png)[^note]\n\n[pic]: <assets/reference%20one.png>\n[^note]: [foot](foot.png)\n\n```md\n[not](code.png)\n```';
 assert.deepEqual(collect(text).map(file=>file.path),['assets/reference one.png','full.png','body.png','foot.png']);
});
test('same-caption image links resolve by exact node, Markdown block and rendered ordinal',()=>{
 assert.equal(resolveChatFileLink(position,node,collect).file.path,'other.png');
 const changed={...node,data:{...node.data,blocks:[...node.data.blocks,{kind:'text',text:'[last](last.png)'}]}};
 assert.equal(resolveChatFileLink({...position,blockIndex:1,blockCount:2,linkIndex:0,linkCount:1,checks:[]},changed,collect).file.path,'last.png');
});
test('missing or changed node/block/link identities and parsing failures never guess a file',()=>{
 for(const patch of [{nodeKey:'other'},{blockCount:2},{blockIndex:-1},{linkCount:2},{linkIndex:99},{checks:[{index:0,path:'wrong.png'}]}])assert.ok(resolveChatFileLink({...position,...patch},node,collect).error);
 assert.ok(resolveChatFileLink(position,{...node,data:{...node.data,status:'running'}},collect).error);
 assert.ok(resolveChatFileLink(position,node,()=>{throw Error('parser');}).error);
});
test('model sources are Session-scoped, unregistered on teardown and reject different generations',()=>{
 const sources=createChatLinkSources(),reader={nodes:new Map([[node.key,node]])};const dispose=sources.register('a',reader);
 assert.equal(sources.resolve('a',position,collect).file.path,'other.png');assert.ok(sources.resolve('b',position,collect).error);
 const other=sources.register('a',{nodes:new Map([[node.key,{...node}]])});assert.ok(sources.resolve('a',position,collect).error);other();
 dispose();assert.ok(sources.resolve('a',position,collect).error);
});
test('validated image targets enter the original focus consumer with the clicked Session and line',()=>{
 const facts={sessionId:'a',inConversation:true,tag:'BUTTON',fileButton:true,title:null,button:0,derivedFile:{path:'G:/Project/A B.png',line:24}};
 const focus=fileFocusFromClick(facts),target=consumeFileRequest({view:'better-files',focus},null,'a','G:/Project');
 assert.equal(target.path,'G:/Project/A B.png');assert.deepEqual(target.params,{line:24});
 assert.equal(fileFocusFromClick({...facts,ctrlKey:true}),null);assert.equal(fileFocusFromClick({...facts,derivedFile:{path:'https://evil/image.png'}}),null);
});
test('collector adaptation fails closed on a changed pinned implementation',()=>{
 assert.throws(()=>exposeNativeLinkCollector(source.replace('function MarkdownFileLink(', 'function ChangedFileLink(')),/anchor changed/);
});
test('Chat source is a nonvisual additive header entry, not a Chat/sidebar replacement',async()=>{
 const code=await readFile(new URL('../src/client.jsx',import.meta.url),'utf8');
 assert.match(code,/name:'conversation.session.header.utilities',id:'better-files-chat-source'/);
 assert.match(code,/useChat\(snapshot=>snapshot.nodes\)/);assert.doesNotMatch(code,/name:'conversation.chat.node'|id:'chat'|ctx\.sidebarRight/);
});
