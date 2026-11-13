import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseFileFocus, revealFile, consumeFileRequest, sameFilePath, filePathKey } from '../src/navigation.mjs';
import { fileAddress, createPreviewInstance } from '../src/core.mjs';
const session='session #1',cwd='G:\\Projects\\Work';
test('resource focus opens the encoded file with the current Session authority',()=>{
  const address=fileAddress(session,'G:/Projects/Work/docs/A B#1.md');
  assert.deepEqual(parseFileFocus(address,session,cwd),{path:'G:/Projects/Work/docs/A B#1.md',params:undefined});
  assert.throws(()=>parseFileFocus(fileAddress('other','x.md'),session,cwd),/another session/);
});
test('native, relative, file URL and documented JSON focus envelopes resolve safely',()=>{
  assert.equal(parseFileFocus('docs/readme.md',session,cwd).path,'G:/Projects/Work/docs/readme.md');
  assert.equal(parseFileFocus('file:///G:/Projects/Work/A%20B.md#L12',session,cwd).path,'G:/Projects/Work/A B.md');
  const payload=JSON.stringify({sessionId:session,path:'docs/readme.md',line:7});
  assert.deepEqual(parseFileFocus(payload,session,cwd).params,{line:7});
  assert.throws(()=>parseFileFocus('https://example.com/file.md',session,cwd),/not a local file/);
  assert.throws(()=>parseFileFocus('dsh-resource://file/session/bad%ZZ/x.md',session,cwd),/Malformed/);
  assert.throws(()=>parseFileFocus('{bad',session,cwd),/Invalid file navigation/);
});
test('nested file reveal expands and lists only its ancestor directories',()=>{
  const target=revealFile('G:/Projects/Work/docs/sub/readme.md',cwd);
  assert.deepEqual(target.ancestors,[cwd,cwd+'/docs',cwd+'/docs/sub']);
  assert.equal(target.folder,cwd+'/docs/sub');assert.equal(target.path,cwd+'/docs/sub/readme.md');
});
test('outside-workspace files can be previewed without listing external directories',()=>{
  const target=revealFile('G:/private/notes.md',cwd);
  assert.equal(target.insideWorkspace,false);assert.equal(target.path,'G:/private/notes.md');
  assert.deepEqual(target.ancestors,[cwd]);assert.equal(target.folder,cwd);
  assert.equal(revealFile('G:/Projects/Work-other/f.md',cwd).insideWorkspace,false);
});
test('path keys handle Windows casing, UNC and separator differences but preserve POSIX case',()=>{
  assert.equal(sameFilePath('G:\\Projects\\Work\\x.md','g:/projects/work/x.md'),true);
  assert.equal(filePathKey('\\\\server\\share\\x.md'),'//server/share/x.md');
  assert.equal(sameFilePath('/a/File.md','/a/file.md'),false);
  assert.equal(revealFile('/work/file.md','/').insideWorkspace,true);
  assert.equal(parseFileFocus(fileAddress(session,'../other/f.md'),session,cwd).path,'G:/Projects/other/f.md');
});
test('identical file clicks are consumed per request identity, not suppressed by path',()=>{
  const a={view:'better-files',focus:fileAddress(session,'docs/readme.md')};
  const b={...a};
  assert.ok(consumeFileRequest(a,null,session,cwd));
  assert.equal(consumeFileRequest(a,a,session,cwd),null);
  assert.ok(consumeFileRequest(b,a,session,cwd));
  assert.equal(consumeFileRequest({view:'chat',focus:a.focus},null,session,cwd),null);
});
test('line anchors reach the independently forked official preview navigation',()=>{
  const target=parseFileFocus(fileAddress(session,'docs/readme.md')+'#L24-L30',session,cwd);
  const instance=createPreviewInstance(fileAddress(session,target.path),2,target.params);
  assert.deepEqual(instance.usePreviewInfo().occurrence.navigation,{revision:2,params:{line:24}});instance.dispose();
});
test('view forwards and acknowledges focus requests, without global scrollIntoView',async()=>{
  const source=await readFile(new URL('../src/client.jsx',import.meta.url),'utf8');
  assert.match(source,/viewRequest=\{request\}/);
  assert.match(source,/completeViewRequest=\{completeRequest\}/);
  assert.match(source,/const request=props\.viewRequest\|\|/);
  assert.match(source,/if\(props\.viewRequest\)props\.completeViewRequest\(\)/);
  assert.match(source,/completeViewRequest\(\)/);
  assert.match(source,/target\.ancestors\.map\(filePathKey\)/);
  assert.match(source,/port\.scrollTop\s*\+=/);
  assert.doesNotMatch(source,/scrollIntoView\(/);
});
