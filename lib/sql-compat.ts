// A bounded compatibility layer for the app's existing parameterised queries.
// Values stay separate from SQL; only trusted query templates are translated.
export function postgresQuery(template:string,lastChanges=0){
 let sql=template.replace(/\bchanges\(\)/g,String(lastChanges)).replace(/\bwindow\b/g,'"window"')
  .replace(/json_extract\(payload,'\$\.slot'\)/g,"(payload::jsonb ->> 'slot')");
 const ignore=/^INSERT OR IGNORE INTO /i.test(sql);
 if(ignore)sql=sql.replace(/^INSERT OR IGNORE INTO /i,'INSERT INTO ')+' ON CONFLICT DO NOTHING';
 let output='',quoted=false,index=0;
 for(let i=0;i<sql.length;i++){
  const char=sql[i];
  if(char==="'"){output+=char;if(quoted&&sql[i+1]==="'"){output+=sql[++i];continue;}quoted=!quoted;}
  else output+=char==='?'&&!quoted?'$'+(++index):char;
 }
 return output;
}
