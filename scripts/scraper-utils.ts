import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
export const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export async function retry<T>(fn:()=>Promise<T>){let last:unknown;for(const ms of [1000,2000,4000]){try{return await fn()}catch(e){last=e;await sleep(ms)}}throw last}
export const validCode=(value:string)=>/^\d{8}$/.test(value);
export const validRate=(value:string|number)=>Number.isFinite(Number(value));
export async function appendCsv(path:string,headers:string[],rows:Record<string,unknown>[]){await mkdir(dirname(path),{recursive:true});let exists=true;try{await readFile(path)}catch{exists=false}const escape=(v:unknown)=>`"${String(v??"").replaceAll('"','""')}"`;await appendFile(path,(exists?"":headers.map(escape).join(",")+"\n")+rows.map(r=>headers.map(h=>escape(r[h])).join(",")).join("\n")+(rows.length?"\n":""))}
export async function logInvalid(source:string,row:unknown,reason:string){await appendCsv("data/scrape-errors.csv",["source","reason","row"],[{source,reason,row:JSON.stringify(row)}])}
