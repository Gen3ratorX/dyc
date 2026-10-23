import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync('lib/navigation.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {destinations,workspaceHref,readWorkspaceRoute}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
for(const [tab,path] of Object.entries(destinations)){
 assert.equal(workspaceHref({tab}),path);assert.deepEqual(readWorkspaceRoute(path),{tab,group:undefined});
 assert.deepEqual(readWorkspaceRoute(path+'/','?group=Group%20C'),{tab,group:'Group C'});
}
assert.equal(readWorkspaceRoute('/').tab,'Overview');
const record={tab:'Warrior',warrior:'DYC-TEST 01',group:'Group B'};
const url=new URL(workspaceHref(record),'https://camp.test');assert.deepEqual(readWorkspaceRoute(url.pathname,url.search),record);
for(const path of ['/unknown','/api/camp','/settings/extra','/warriors/a/b','/warriors/%2f','/warriors/%00','/warriors/%zz'])assert.equal(readWorkspaceRoute(path),null);
assert.equal(readWorkspaceRoute('/overview','?group=Group%20Z').group,undefined);
assert.equal(workspaceHref({tab:'Overview',group:'arbitrary'}),'/overview');
console.log('Workspace URLs round-trip all sidebar destinations, group shortcuts and encoded profile IDs; unknown paths and invalid groups are rejected.');
