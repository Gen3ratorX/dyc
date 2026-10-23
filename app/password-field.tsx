'use client';
import {useId,useState} from 'react';
import {Eye,EyeOff} from 'lucide-react';
export function PasswordField({label,name,current=false}:{label:string;name:string;current?:boolean}){
 const id=useId(),[visible,setVisible]=useState(false);
 return <label className="form-label" htmlFor={id}><span>{label}</span><div className="access-password"><input id={id} name={name} type={visible?'text':'password'} autoComplete={current?'current-password':'new-password'} minLength={current?undefined:12} maxLength={current?1024:72} required/><button className="password-toggle" type="button" aria-label={`${visible?'Hide':'Show'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={()=>setVisible(value=>!value)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>;
}
