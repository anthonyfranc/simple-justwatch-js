# simple‑justwatch‑js

`simple‑justwatch‑js` is an unofficial JavaScript/TypeScript client for the public JustWatch GraphQL API.  It is loosely modelled on the Python library [simple‑justwatch‑python‑api](https://electronic-mango.github.io/simple-justwatch-python-api/) and provides a small set of high‑level functions to query JustWatch data—searching for titles, retrieving popular content, fetching detailed information, listing seasons and episodes, obtaining offers across multiple countries, and enumerating available streaming providers.

**Important:** The JustWatch GraphQL API is undocumented and may change without notice.  The queries embedded in this library are based on reverse‑engineering and may stop working if JustWatch updates their schema.  Use this library at your own risk and be prepared to adjust the GraphQL documents as needed.

## Installation

Install the package using npm or yarn:

```bash
npm install simple-justwatch-js
# or
yarn add simple-justwatch-js
```

This library has no runtime dependencies.  It relies on a global `fetch` implementation, which is available in modern Node.js versions (≥18) and browsers.  In older environments you may need to supply a custom `fetch` implementation (e.g. [node‑fetch](https://github.com/node-fetch/node-fetch) or [undici](https://github.com/nodejs/undici)) via the constructor.

## Usage

```js
const { SimpleJustWatch } = require('simple-justwatch-js');

// Create a client instance.  You can override the endpoint or supply
// custom headers and a custom fetch implementation here.
const jw = new SimpleJustWatch();

// Search for titles.  Returns a connection with edges and pageInfo.
const searchResults = await jw.search('The Matrix', {
  country: 'US',
  language: 'en',
  count: 5,
  objectTypes: ['MOVIE'],
  providers: ['nfx', 'hbo']
});
for (const edge of searchResults.edges) {
  const item = edge.node;
  console.log(item.title, item.objectType, item.originalReleaseYear);
}

// Fetch popular titles.  Pagination works the same as search.
const popular = await jw.popular({ country: 'US', language: 'en', count: 10 });

// Get detailed information about a title by its current JustWatch node ID.
// Search and popular results expose this value as `node.id` (for example: tm10).
const details = await jw.details('tm10', { country: 'US', language: 'en' });
console.log(details.title, details.offers.edges.length);

// List seasons of a show and fetch episodes of a season.
const seasons = await jw.seasons('ts389', { country: 'US' });
const episodes = await jw.episodes(seasons[0].id, { country: 'US' });

// Get offers for a title across multiple countries.
const offersByCountry = await jw.offersForCountries('tm10', ['US', 'GB'], { language: 'en' });
console.log(offersByCountry.US);

// List available providers in a country.
const providers = await jw.providers({ country: 'US', language: 'en' });
console.log(providers.map(p => p.shortName));
```

## API

### `new SimpleJustWatch(options?: ClientOptions)`

Create a new client.  `options` may include:

| Option      | Type                              | Default                          | Description                                                                      |
|------------|-----------------------------------|----------------------------------|----------------------------------------------------------------------------------|
| `endpoint` | `string`                          | `https://apis.justwatch.com/graphql` | The GraphQL endpoint to call.                                                    |
| `headers`  | `Record<string, string>`          | `{ 'Content‑Type': 'application/json' }` | Additional HTTP headers to include with every request.                           |
| `fetch`    | `typeof fetch`                    | `globalThis.fetch` (fallback to `node‑fetch`/`undici` if available) | A custom fetch implementation.                                                     |

### `search(title: string, options?: SearchOptions): Promise<SearchResultConnection>`

Search for titles matching `title`.  `SearchOptions` may include:

| Option              | Type            | Description                                                                                                                                      |
|--------------------|-----------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| `country`           | `string`        | Two‑letter country code (e.g. `US`).  Defaults to `US`.                                                                                          |
| `language`          | `string`        | ISO 639‑1 language code (e.g. `en`).  Defaults to `en`.                                                                                          |
| `count`             | `number`        | Number of results to return per request.  Defaults to `20`.                                                                                      |
| `cursor`            | `string|number|null` | Cursor or numeric offset for pagination.  JustWatch currently uses offset-based pagination, so base64 numeric cursors are decoded to offsets. |
| `objectTypes`       | `string[]`      | Filter results by object type (e.g. `['MOVIE','SHOW']`).  Optional.                                                                             |
| `providers`         | `string[]`      | Filter results by provider IDs (e.g. `['nfx','apv']`).  Optional.                                                                               |
| `minReleaseYear`    | `number`        | Filter results by minimum release year.  Optional.                                                                                              |
| `maxReleaseYear`    | `number`        | Filter results by maximum release year.  Optional.                                                                                              |
| `packages`          | `string[]`      | Only include titles available via the specified packages.  Optional.                                                                            |
| `excludePackages`   | `string[]`      | Deprecated: JustWatch’s current public GraphQL schema no longer accepts this filter, so it is ignored.                                         |
| `raw`               | `boolean`       | When `true`, return the raw GraphQL data instead of just the connection.  Optional.                                                             |

Returns a connection object with `edges` (an array of search results) and `pageInfo` for pagination.

### `popular(options?: PopularOptions): Promise<PopularResultConnection>`
Retrieve currently popular titles.  `PopularOptions` accepts many of the same properties as `SearchOptions` (minus the search string) and adds optional sorting and filtering options:

| Option            | Type          | Description                                                                                                                                                     |
|------------------|--------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `country`         | `string`      | Two‑letter country code (e.g. `US`).  Defaults to `US`.                                                                                                        |
| `language`        | `string`      | ISO 639‑1 language code (e.g. `en`).  Defaults to `en`.                                                                                                        |
| `count`           | `number`      | Number of results to return per request.  Defaults to `20`.                                                                                                    |
| `cursor`          | `string|number|null` | Cursor or numeric offset for pagination.  JustWatch currently uses offset-based pagination, so base64 numeric cursors are decoded to offsets.              |
| `objectTypes`     | `string[]`    | Filter results by object type (e.g. `['MOVIE','SHOW']`).  Optional.                                                                                           |
| `providers`       | `string[]`    | Filter results by provider IDs.  Optional.                                                                                                                    |
| `packages`        | `string[]`    | Only include titles available via the specified packages.  Optional.                                                                                        |
| `excludePackages` | `string[]`    | Deprecated: JustWatch’s current public GraphQL schema no longer accepts this filter, so it is ignored.                                                       |
| `sortBy`          | `string`      | Criteria for sorting.  Valid values include `'POPULAR'`, `'TRENDING'`, `'IMDB_SCORE'`, `'TMDB_POPULARITY'`, `'RELEASE_YEAR'` and `'ALPHABETICAL'`.  Defaults to `'POPULAR'`. |
| `sortOrder`       | `string`      | Deprecated: JustWatch’s current public GraphQL schema no longer accepts this option, so it is ignored.                                                         |
| `raw`             | `boolean`     | When `true`, return the raw GraphQL data instead of just the connection.  Optional.                                                                             |

The returned value is a connection object containing `edges` (popular results) and `pageInfo` for pagination.

### `details(id: string, options?: DetailsOptions): Promise<DetailsResult>`

Fetch detailed information about a title by its current JustWatch node ID (for example `tm10` for a movie or `ts389` for a show).  Includes offers, scoring data and seasons for shows.  `DetailsOptions` can specify `country` and `language` (both default to `US` and `en`). Numeric legacy IDs are no longer accepted by JustWatch’s public GraphQL endpoint.

### `seasons(showId: string, options?: DetailsOptions): Promise<Season[]>`

Convenience wrapper around `details()` that extracts the season list for a show.  If the ID refers to a movie, an empty array is returned.

### `episodes(seasonId: string, options?: DetailsOptions): Promise<Episode[]>`

Fetch all episodes for a given season.

### `offersForCountries(titleId: string, countries: string[], options?: { language?: string }): Promise<Record<string, Offer[]>>`

Retrieve offers for a title across multiple countries.  Internally this method calls `details()` once per country and extracts the offers.  The result is an object keyed by country code.

### `providers(options?: ProvidersOptions): Promise<Provider[]>`

Fetch a list of streaming providers available in a given country.  `ProvidersOptions` can specify `country`.

### `newTitles(options?: NewTitlesOptions): Promise<PopularResultConnection>`

Fetch the newest titles by release year.  This helper wraps the `popularTitles` query with `sortBy: 'RELEASE_YEAR'` and accepts all the same options as `popular()` (such as `country`, `language`, `objectTypes`, `providers`, `packages`, `count`, `cursor` and `raw`).  It returns a paginated connection or, when `raw` is `true`, the full GraphQL response.

```js
// Example: get the latest 10 movies released on Netflix in the US
const newest = await jw.newTitles({
  country: 'US',
  language: 'en',
  count: 10,
  objectTypes: ['MOVIE'],
  providers: ['nfx']
});
```

### `titlesByProvider(providerId: string, options?: TitlesByProviderOptions): Promise<PopularResult[]>`

Retrieve all titles offered by a specific streaming provider.  This helper repeatedly calls `popular()` with the given provider ID until all pages have been fetched or a maximum number of titles (`maxCount`, default: `2000`) has been reached.  The `options` object accepts `country`, `language`, `objectTypes`, `packages` and `maxCount`.  It returns an array of title nodes.

```js
// Example: fetch up to 500 titles available on HBO in the US
const hboTitles = await jw.titlesByProvider('hbo', { country: 'US', maxCount: 500 });
console.log(hboTitles.length);
```

## Caveats

- **Unofficial API:** This library uses JustWatch’s publicly exposed GraphQL endpoint, which is not officially documented.  The schema may change without notice.  When in doubt, inspect network requests from the JustWatch web app to adjust the queries.
- **Rate Limits:** There are no published rate limits for the GraphQL endpoint, but excessive usage could lead to throttling or blocking.  Respect the service and cache results whenever possible.
- **Missing Data:** Not all providers expose pricing information through JustWatch.  Some fields may be `null` or omitted.

## Development

```bash
npm test          # offline mocked regression tests
npm run check     # syntax check plus offline tests
npm run test:live # live JustWatch smoke/regression test
```

Live tests call the public JustWatch endpoint and are intentionally not run by CI.

## License

MIT.  See [LICENSE](./LICENSE) for details.
