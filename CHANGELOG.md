# Changelog

## 1.0.2

- Added dependency-free offline and live regression tests.
- Improved GraphQL request errors with operation name, HTTP status, response text, and parsed GraphQL errors.
- Added local validation for JustWatch node ID inputs.
- Clarified offset-based pagination behavior and deprecated no-op options in docs and comments.
- Tightened TypeScript declarations to better match normalized runtime results.
- Added release checks and GitHub Actions CI for Node.js 18, 20, and 22.

## 1.0.1

- Updated queries for JustWatch's current public GraphQL schema.
- Switched title lookup to `node(id:)`, providers to `packages(...)`, and search/listing calls to `popularTitles(...)`.
- Normalized current response fields back into the existing edge-style API.
- Updated docs and typings for current string node IDs such as `tm10` and `ts389`.

## 1.0.0

- Initial release with search, popular titles, details, seasons, episodes, offers by country, providers, newest titles, and titles by provider.
