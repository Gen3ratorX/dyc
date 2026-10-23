export const destinations = {
 Overview:'/overview', Warriors:'/warriors', 'Clinical review':'/clinical-reviews',
 Reports:'/reports', 'Sync centre':'/sync', Settings:'/settings',
} as const;
export type Destination=keyof typeof destinations|'Warrior';
export type WorkspaceRoute={tab:Destination;group?:string;warrior?:string};
const validGroup=(value:string|null|undefined)=>value&&/^Group [A-T]$/.test(value)?value:undefined;
export function workspaceHref(route:WorkspaceRoute){
 const path=route.tab==='Warrior'?`/warriors/${encodeURIComponent(route.warrior||'')}`:destinations[route.tab];
 return path+(validGroup(route.group)?`?group=${encodeURIComponent(route.group!)}`:'');
}
export function readWorkspaceRoute(pathname:string,search=''):WorkspaceRoute|null{
 const path=pathname.replace(/\/$/,'')||'/';
 const group=validGroup(new URLSearchParams(search).get('group'));
 const tab=path==='/'?'Overview':(Object.entries(destinations).find(([,value])=>value===path)?.[0] as Destination|undefined);
 if(tab)return {tab,group};
 const match=path.match(/^\/warriors\/([^/]+)$/);
 if(match){try{const warrior=decodeURIComponent(match[1]);if(warrior&&!/[\x00-\x1f/]/.test(warrior))return {tab:'Warrior',warrior,group};}catch{}}
 return null;
}
