import type {CodeResult,Country,DutyRequest,DutyResponse,SearchResponse} from "./shared-types";
const base=process.env.NEXT_PUBLIC_API_URL??"http://localhost:4000";
async function request<T>(path:string,init?:RequestInit):Promise<T>{const r=await fetch(base+path,{...init,headers:{"content-type":"application/json",...init?.headers}});if(!r.ok)throw new Error(await r.text());return r.json()}
export type ChapterInfo={code:string;name:string};
export type BrowseResponse={results:CodeResult[];total:number;page:number;limit:number;chapters:ChapterInfo[]};
export const api={
  search:(q:string,country:Country="BOTH")=>request<SearchResponse>(`/api/v1/search?q=${encodeURIComponent(q)}&country=${country}`),
  autocomplete:(q:string,country:Country="BOTH")=>request<SearchResponse>(`/api/v1/autocomplete?q=${encodeURIComponent(q)}&country=${country}`),
  code:(country:"CN"|"IN"|"AE",code:string)=>request<CodeResult>(`/api/v1/code/${country}/${code}`),
  duty:(body:DutyRequest)=>request<DutyResponse>("/api/v1/duty-calculate",{method:"POST",body:JSON.stringify(body)}),
  classify:(body:unknown)=>request<any>("/api/v1/classify",{method:"POST",body:JSON.stringify(body)}),
  match:(code:string,from:"CN"|"IN"|"AE")=>request<any[]>(`/api/v1/match/${code}?from=${from}`),
  browse:(country:"CN"|"IN"|"AE",opts:{page?:number;limit?:number;chapter?:string;q?:string;sort?:string;order?:string}={})=>{
    const p=new URLSearchParams();
    if(opts.page)p.set("page",String(opts.page));
    if(opts.limit)p.set("limit",String(opts.limit));
    if(opts.chapter)p.set("chapter",opts.chapter);
    if(opts.q)p.set("q",opts.q);
    if(opts.sort)p.set("sort",opts.sort);
    if(opts.order)p.set("order",opts.order);
    return request<BrowseResponse>(`/api/v1/browse/${country}?${p}`);
  },
  logError:(body:unknown)=>fetch(base+"/api/v1/log-error",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
};
