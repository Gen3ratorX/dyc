export function databaseDriverCode(error:unknown,depth=0):string|undefined{
 if(depth>4||!error||typeof error!=='object')return;
 const item=error as {code?:unknown;cause?:unknown;errors?:unknown[]};
 if(typeof item.code==='string'&&/^[A-Z0-9_]{3,64}$/.test(item.code))return item.code;
 const cause=databaseDriverCode(item.cause,depth+1);if(cause)return cause;
 if(Array.isArray(item.errors))for(const nested of item.errors){const code=databaseDriverCode(nested,depth+1);if(code)return code;}
}
export function databaseFailureCode(error:unknown){
 const code=databaseDriverCode(error)||'';
 if(['28P01','28000'].includes(code))return 'DATABASE_AUTHENTICATION_FAILED';
 if(['42501'].includes(code))return 'DATABASE_PERMISSION_DENIED';
 if(['42P01','3F000'].includes(code))return 'DATABASE_SCHEMA_MISSING';
 if(['SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE','UNABLE_TO_GET_ISSUER_CERT_LOCALLY','CERT_HAS_EXPIRED','ERR_TLS_CERT_ALTNAME_INVALID'].includes(code))return 'DATABASE_TLS_ERROR';
 if(['ENOTFOUND','EAI_AGAIN'].includes(code))return 'DATABASE_HOST_NOT_FOUND';
 if(['CONNECT_TIMEOUT','ETIMEDOUT','ECONNREFUSED','ECONNRESET','CONNECTION_CLOSED'].includes(code))return 'DATABASE_CONNECTION_FAILED';
 if(code==='ERR_INVALID_URL')return 'DATABASE_URL_INVALID';
 return 'DATABASE_UNAVAILABLE';
}
