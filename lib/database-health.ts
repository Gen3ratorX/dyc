export function databaseFailureCode(error:unknown){
 const code=error&&typeof error==='object'&&'code'in error?String(error.code):'';
 if(['28P01','28000'].includes(code))return 'DATABASE_AUTHENTICATION_FAILED';
 if(['42501'].includes(code))return 'DATABASE_PERMISSION_DENIED';
 if(['42P01','3F000'].includes(code))return 'DATABASE_SCHEMA_MISSING';
 if(['SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE','CERT_HAS_EXPIRED','ERR_TLS_CERT_ALTNAME_INVALID'].includes(code))return 'DATABASE_TLS_ERROR';
 if(['ENOTFOUND','EAI_AGAIN'].includes(code))return 'DATABASE_HOST_NOT_FOUND';
 if(['CONNECT_TIMEOUT','ETIMEDOUT','ECONNREFUSED','ECONNRESET','CONNECTION_CLOSED'].includes(code))return 'DATABASE_CONNECTION_FAILED';
 if(code==='ERR_INVALID_URL')return 'DATABASE_URL_INVALID';
 return 'DATABASE_UNAVAILABLE';
}
