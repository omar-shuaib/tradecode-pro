if(process.env.SEARCH_PROVIDER!=="typesense")console.log("PostgreSQL search is active; Typesense indexing skipped. See UPGRADE.md.");
else if(!process.env.TYPESENSE_HOST)throw new Error("TYPESENSE_HOST is required to index the optional Typesense provider");
else throw new Error("Provision the optional Typesense service before implementing the provider-specific index request. See UPGRADE.md.");
