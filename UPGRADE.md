# Future: upgrading search to Typesense

TradeCode Pro launches with PostgreSQL search. To switch providers:

1. Provision a Typesense instance and persistent storage.
2. Set `SEARCH_PROVIDER=typesense`, `TYPESENSE_HOST`, and `TYPESENSE_API_KEY`.
3. Run `npm run index`.
4. Deploy the API.

No route or UI changes are required. Re-evaluate hosting and pricing before provisioning.
