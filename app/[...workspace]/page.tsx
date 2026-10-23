import {notFound} from 'next/navigation';
import Pilot from '../pilot';
import {readWorkspaceRoute} from '../../lib/navigation';
export const dynamic='force-dynamic';
export default async function Workspace({params}:{params:Promise<{workspace:string[]}>}){
 const {workspace}=await params;
 if(!readWorkspaceRoute('/'+workspace.map(encodeURIComponent).join('/')))notFound();
 return <Pilot/>;
}
