import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDiagnostics, registerDiagnostics, DIAGNOSTIC_BUILD } from '../src/diagnostics.mjs';
test('diagnostics retain request evidence across acknowledgement and unmount',()=>{
 const d=createDiagnostics();d.record('a','view-mounted',{mounted:true});d.record('a','workspace-request',{request:{view:'better-files',focus:'G:/x.md'}});d.record('a','preview-state',{selected:'G:/x.md'});d.record('a','view-props',{request:null});d.record('a','view-unmounted',{mounted:false});
 const result=d.snapshot('a');assert.equal(result.state.mounted,false);assert.equal(result.state.selected,'G:/x.md');assert.equal(result.events[1].request.focus,'G:/x.md');assert.equal(d.snapshot('b').observed,false);
});
test('diagnostic retention and sensitive fields are bounded',()=>{
 const d=createDiagnostics();for(let i=0;i<20;i++)d.record('a','event',{index:i,secret:'hide'});
 assert.equal(d.snapshot('a').events.length,12);assert.equal(d.snapshot('a').state.secret,'[redacted]');
 for(let i=0;i<20;i++)d.record('s'+i,'event');assert.equal(d.snapshot('a').observed,false);
});
test('optional Inspect provider reads Session state and page-local metadata without changing either',()=>{
 const d=createDiagnostics();d.record('current','view-props',{request:null});let registration;
 const scope={get:()=>({register:r=>{registration=r;return()=>{};}}),effect:fn=>fn()};registerDiagnostics({inject:(_keys,fn)=>fn(scope)},d);
 assert.equal(registration.manifest.id,'BetterFilesDiagnostics');
 const before=d.snapshot('current');assert.deepEqual(registration.query('snapshot',{}, {sessionId:'current'}),before);assert.deepEqual(d.snapshot('current'),before);
 assert.equal(registration.query('snapshot',{sessionId:'other'}, {sessionId:'current'}).observed,false);
});
test('recent image metadata is discoverable across Sessions and unscoped portals',()=>{
 const d=createDiagnostics();d.record('image-session','chat-image-click',{imageClick:{sourceKind:'host-file',localPath:'/a.png'}});
 assert.equal(d.snapshot('agent-session').observed,false);assert.equal(d.snapshot('agent-session').lastImageClick.sessionId,'image-session');
 assert.deepEqual(d.snapshot('agent-session').observedSessions,['image-session']);
 d.record(null,'chat-image-click',{imageClick:{sourceKind:'blob',region:null}});
 assert.equal(d.snapshot('agent-session').lastImageClick.sessionId,null);assert.equal(d.snapshot('agent-session').lastImageClick.sourceKind,'blob');
 assert.deepEqual(d.snapshot('agent-session').observedSessions,['image-session']);
});
test('reported diagnostic build matches the installed package version',async()=>{
 const p=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));assert.equal(p.version,DIAGNOSTIC_BUILD);
});
