// UPGRADE PATH ONLY - not active in v1. Switch by setting SEARCH_PROVIDER=typesense and provisioning a Typesense instance. See UPGRADE.md.
import type { SearchProvider } from "./provider.js"; import type { CodeResult,Country } from "@tradecode/shared-types";
export class TypesenseSearchProvider implements SearchProvider{constructor(private host:string){}async search(_q:string,_country:Country,_limit:number):Promise<CodeResult[]>{throw new Error(`Typesense adapter at ${this.host} requires an indexed provisioned service`)}} 
