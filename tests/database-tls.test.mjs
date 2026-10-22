import assert from 'node:assert/strict';
import {X509Certificate} from 'node:crypto';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(readFileSync('lib/database-tls.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {databaseTLS,supabaseRootCA}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const certificate=new X509Certificate(supabaseRootCA);
assert.equal(certificate.fingerprint256.replaceAll(':','').toLowerCase(),'807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa');
assert(certificate.ca);assert(Date.parse(certificate.validTo)>Date.now());
for(const host of ['aws-0-eu-west-1.pooler.supabase.com','db.lkuzzzbxldetnzlpiben.supabase.co']){const options=databaseTLS('postgres://'+host+'/postgres');assert.equal(options.ca,supabaseRootCA);assert.equal(options.rejectUnauthorized,true);}
for(const host of ['database.example.org','pooler.supabase.com.attacker.test','db.attacker.example.org']){const options=databaseTLS('postgres://'+host+'/postgres');assert.equal(options.ca,undefined);assert.equal(options.rejectUnauthorized,true);}
console.log('Database TLS checks passed: official root fingerprint and expiry, Supabase-only CA scope, certificate verification always enabled.');
