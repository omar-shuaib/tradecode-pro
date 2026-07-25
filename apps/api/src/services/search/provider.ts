import type { CodeResult,Country } from "@tradecode/shared-types";
export interface SearchProvider{search(q:string,country:Country,limit:number):Promise<CodeResult[]>}
