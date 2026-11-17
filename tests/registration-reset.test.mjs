import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile=(p,jsx=false)=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:jsx?ts.JsxEmit.ReactJSX:undefined}}).outputText;
const domain={exports:{}};vm.runInNewContext(compile('lib/domain.ts'),{exports:domain.exports,module:domain});
const registration={exports:{}};vm.runInNewContext(compile('lib/registration.ts'),{exports:registration.exports,module:registration,require:()=>domain.exports});
const {blankRegistration}=registration.exports;
for(const walkin of [false,true]){
 const previous={...blankRegistration,name:'Fictional camper',dataConsent:true,photoConsent:true};
 const states=[previous,3,'Previous error',false,'DYC26-TEST-ONLY-0001',true,false];
 const refs=[{current:'old-request'},{current:null},{current:null},{current:true}];let stateIndex=0,refIndex=0;
 const runtime={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
 const react={useState:()=>{const i=stateIndex++;return [states[i],v=>{states[i]=v}]},useRef:()=>refs[refIndex++],useEffect:()=>{}};
 const module={exports:{}};vm.runInNewContext(compile('app/register/registration-form.tsx',true),{exports:module.exports,module,crypto,require:name=>name==='react'?react:name==='react/jsx-runtime'?runtime:name==='lucide-react'?new Proxy({},{get:(_,key)=>key}):registration.exports});
 const tree=module.exports.default({walkin});
 const nodes=[];function visit(n){if(!n||typeof n!=='object')return;nodes.push(n);for(const c of [n.props?.children].flat(Infinity))visit(c)}visit(tree);
 const next=nodes.find(n=>n.type==='button'&&[n.props.children].flat().includes('Register another camper'));
 assert.ok(next,'Every registration confirmation offers a fresh form');next.props.onClick();
 assert.deepEqual({...states[0]},{...blankRegistration});assert.notEqual(states[0],blankRegistration);assert.equal(states[1],0);assert.equal(states[2],'');assert.equal(states[4],'');assert.notEqual(refs[0].current,'old-request');assert.equal(refs[3].current,false);assert.equal(previous.name,'Fictional camper');
}
console.log('Public and walk-in confirmations reset all camper answers, permissions, step, errors and submission identity for the next registration.');
