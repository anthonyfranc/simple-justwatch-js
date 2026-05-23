/*
 * simple-justwatch-js
 *
 * A minimal, unofficial JavaScript/TypeScript client for the public
 * JustWatch GraphQL endpoint.  This module is inspired by the
 * simple‑justwatch‑python‑api project and exposes a handful of
 * convenience functions—search, popular, details, seasons,
 * episodes, offersForCountries and providers—that wrap GraphQL
 * operations.  Because the JustWatch GraphQL API is undocumented
 * and may change at any time, the queries included here are
 * approximate and might require adjustment if the API schema
 * evolves.  Use at your own risk.
 *
 * Example usage:
 *
 * const { SimpleJustWatch } = require('simple-justwatch-js');
 * const client = new SimpleJustWatch();
 * client.search('Dune', { country: 'US', language: 'en', count: 5 })
 *   .then(results => console.log(results))
 *   .catch(err => console.error(err));
 */

// Check for a native fetch implementation.  Node.js versions >=18
// include fetch globally.  If it does not exist, attempt to lazily
// require the undici polyfill.  We defer the require so that users
// who provide their own fetch implementation via options are not
// forced to install an extra dependency.
let _fetch = globalThis.fetch;
async function ensureFetch() {
  if (_fetch) return _fetch;
  try {
    // node-fetch is widely used but may not be available in all
    // environments.  undici is a modern alternative that also
    // implements fetch.  If neither exist, throw an error.
    _fetch = require('node-fetch');
    return _fetch;
  } catch (ex) {
    try {
      _fetch = require('undici').fetch;
      return _fetch;
    } catch (ex2) {
      throw new Error('No native fetch implementation found. Provide a custom fetch via options or install node-fetch/undici.');
    }
  }
}

class SimpleJustWatch {
  /**
   * Create a new client instance.
   *
   * @param {object} [options]
   * @param {string} [options.endpoint] Override the GraphQL endpoint.  Defaults to
   *   `https://apis.justwatch.com/graphql`.
   * @param {object} [options.headers] Additional HTTP headers to send with
   *   every request.  You can use this to set User‑Agent or other
   *   metadata as required by your environment.
   * @param {Function} [options.fetch] A custom fetch implementation.  If
   *   omitted, this client will attempt to use the native global
   *   `fetch`, falling back to require('node-fetch') or require('undici').
   */
  constructor(options = {}) {
    this.endpoint = options.endpoint || 'https://apis.justwatch.com/graphql';
    this.headers = Object.assign({
      'Content-Type': 'application/json'
    }, options.headers || {});
    // Accept a custom fetch implementation to aid testing or
    // compatibility in environments without a global fetch.
    this._fetch = options.fetch || null;
  }

  /**
   * Internal helper to execute a GraphQL operation.
   *
   * @param {string} operationName The name of the operation.
   * @param {string} query The GraphQL document (query or mutation).
   * @param {object} variables A variables object for the operation.
   * @returns {Promise<any>} Resolves with the `data` field of the GraphQL response.
   */
  async _request(operationName, query, variables) {
    const fetchImpl = this._fetch || (await ensureFetch());
    const body = { operationName, query, variables };
    const response = await fetchImpl(this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body)
    });
    const json = await response.json();
    if (json.errors) {
      const error = new Error('GraphQL request failed');
      error.errors = json.errors;
      throw error;
    }
    return json.data;
  }

  /**
   * Search for titles.  This function queries the JustWatch
   * `searchTitles` connection and returns a paginated result set.
   *
   * @param {string} title The search string.
   * @param {object} [options]
   * @param {string} [options.country='US'] Two‑letter country code (ISO 3166‑1 alpha‑2).  For example, 'US'.
   * @param {string} [options.language='en'] Language code (ISO 639‑1).  For example, 'en'.
   * @param {number} [options.count=20] Number of entries to request.  The API may cap this value.
   * @param {string|null} [options.cursor=null] Cursor for pagination.  Pass the `endCursor` from a previous response to fetch the next page.
   * @param {string[]} [options.objectTypes] Limit the search to specific object types (e.g. ['MOVIE','SHOW']).
   * @param {string[]} [options.providers] Limit results to specific provider IDs (e.g. ['nfx','apv']).  Leave undefined to search all providers.
   * @param {number} [options.minReleaseYear] Minimum release year filter.
   * @param {number} [options.maxReleaseYear] Maximum release year filter.
   * @returns {Promise<object>} Resolves with a connection object containing `edges` and `pageInfo`.
   */
  async search(title, options = {}) {
    if (!title || typeof title !== 'string') {
      throw new TypeError('The search title must be a non‑empty string');
    }
    const {
      country = 'US',
      language = 'en',
      count = 20,
      cursor = null,
      objectTypes = undefined,
      providers = undefined,
      minReleaseYear = undefined,
      maxReleaseYear = undefined,
      // Filter results by availability on specific packages (e.g. packages used for offers).
      packages: availableToPackages = undefined,
      // Exclude results that are available through specific packages.
      excludePackages = undefined,
      // If true, return the raw GraphQL data instead of just the
      // searchTitles connection.  Useful when you need to inspect
      // the complete JSON structure.
      raw = false
    } = options;
    const variables = {
      searchTitleString: title,
      first: count,
      after: cursor,
      country,
      language,
      objectTypes,
      providers,
      minReleaseYear,
      maxReleaseYear,
      availableToPackages,
      excludePackages
    };
    const query = `query GetSearchTitles(
      $searchTitleString: String!,
      $first: Int,
      $after: String,
      $country: Country!,
      $language: Language,
      $objectTypes: [ObjectTypeEnum!],
      $providers: [StreamingProvider!],
      $minReleaseYear: Int,
      $maxReleaseYear: Int,
      $availableToPackages: [String!],
      $excludePackages: [String!]
    ) {
      searchTitles(
        searchTitleString: $searchTitleString,
        first: $first,
        after: $after,
        country: $country,
        language: $language,
        objectTypes: $objectTypes,
        providers: $providers,
        minReleaseYear: $minReleaseYear,
        maxReleaseYear: $maxReleaseYear,
        availableToPackages: $availableToPackages,
        excludePackages: $excludePackages
      ) {
        edges {
          cursor
          node {
            id
            objectType
            title
            fullPath
            originalReleaseYear
            posterUrl
            posterBlurryImageUrl
            shortDescription
            scoring {
              imdbScore
              tmdbScore
            }
            offers {
              edges {
                node {
                  monetizationType
                  presentationType
                  retailPrice
                  currency
                  standardWebURL
                  provider {
                    id
                    shortName
                    clearName
                  }
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }`;
    const data = await this._request('GetSearchTitles', query, variables);
    // If the caller requested the raw data structure, return the
    // complete data object.  Otherwise return just the searchTitles
    // connection.
    return raw ? data : data.searchTitles;
  }

  /**
   * Fetch currently popular titles.  This wraps the `popularTitles` connection.
   *
   * @param {object} [options]
   * @param {string} [options.country='US'] Two‑letter country code.
   * @param {string} [options.language='en'] Language code.
   * @param {number} [options.count=20] Number of results to return.
   * @param {string|null} [options.cursor=null] Cursor for pagination.
   * @param {string[]} [options.objectTypes] Limit results to specific object types.
   * @param {string[]} [options.providers] Limit results to specific providers.
   * @returns {Promise<object>} Resolves with a connection object containing `edges` and `pageInfo`.
   */
  async popular(options = {}) {
    const {
      country = 'US',
      language = 'en',
      count = 20,
      cursor = null,
      objectTypes = undefined,
      providers = undefined,
      // Filter results by offers available through specific packages.
      packages: availableToPackages = undefined,
      // Exclude results that are available through specific packages.
      excludePackages = undefined,
      // Specify sorting for the popular titles.  Valid values for
      // `sortBy` include: 'POPULAR', 'TRENDING', 'IMDB_SCORE',
      // 'TMDB_POPULARITY', 'RELEASE_YEAR' and 'ALPHABETICAL'.  The
      // default is 'POPULAR'.
      sortBy = 'POPULAR',
      // Sort order, either 'ASC' or 'DESC'.  The default is 'DESC'.
      sortOrder = 'DESC',
      // If true, return the raw GraphQL data instead of just the
      // popularTitles connection.
      raw = false
    } = options;
    const variables = {
      country,
      language,
      first: count,
      after: cursor,
      objectTypes,
      providers,
      availableToPackages,
      excludePackages,
      sortBy,
      sortOrder
    };
    const query = `query GetPopularTitles(
      $first: Int,
      $after: String,
      $country: Country!,
      $language: Language,
      $objectTypes: [ObjectTypeEnum!],
      $providers: [StreamingProvider!],
      $availableToPackages: [String!],
      $excludePackages: [String!],
      $sortBy: PopularSortBy!,
      $sortOrder: SortOrder!
    ) {
      popularTitles(
        first: $first,
        after: $after,
        country: $country,
        language: $language,
        objectTypes: $objectTypes,
        providers: $providers,
        availableToPackages: $availableToPackages,
        excludePackages: $excludePackages,
        sortBy: $sortBy,
        sortOrder: $sortOrder
      ) {
        edges {
          cursor
          node {
            id
            objectType
            title
            fullPath
            originalReleaseYear
            posterUrl
            posterBlurryImageUrl
            shortDescription
            scoring {
              imdbScore
              tmdbScore
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }`;
    const data = await this._request('GetPopularTitles', query, variables);
    return raw ? data : data.popularTitles;
  }

  /**
   * Fetch detailed information about a title by its JustWatch ID.  The
   * returned data includes offers, scoring information and seasons for
   * shows.  Note that JustWatch IDs are integers.
   *
   * @param {number|string} id The JustWatch title ID.
   * @param {object} [options]
   * @param {string} [options.country='US'] Two‑letter country code.
   * @param {string} [options.language='en'] Language code.
   * @returns {Promise<object>} Resolves with the title object.
   */
  async details(id, options = {}) {
    if (!id) {
      throw new TypeError('An ID must be provided to fetch details');
    }
    const { country = 'US', language = 'en' } = options;
    const variables = { id: String(id), country, language };
    const query = `query GetTitleDetails($id: ID!, $country: Country!, $language: Language) {
      title(id: $id, country: $country, language: $language) {
        id
        objectType
        title
        fullPath
        originalReleaseYear
        runtime
        shortDescription
        fullDescription
        posterUrl
        posterBlurryImageUrl
        productionCountries
        genres {
          edges {
            node {
              id
              shortName
              technicalName
            }
          }
        }
        scoring {
          imdbScore
          tmdbScore
        }
        offers {
          edges {
            node {
              monetizationType
              presentationType
              retailPrice
              currency
              standardWebURL
              provider {
                id
                shortName
                clearName
              }
            }
          }
        }
        seasons {
          edges {
            node {
              id
              title
              seasonNumber
            }
          }
        }
      }
    }`;
    const data = await this._request('GetTitleDetails', query, variables);
    return data.title;
  }

  /**
   * Retrieve all seasons for a given show.  This is a convenience
   * wrapper around the `title` query; if the provided ID refers to
   * a movie, an empty array is returned.
   *
   * @param {number|string} showId The JustWatch ID of the show.
   * @param {object} [options]
   * @param {string} [options.country='US'] Two‑letter country code.
   * @param {string} [options.language='en'] Language code.
   * @returns {Promise<object[]>} List of season objects with id, title and seasonNumber.
   */
  async seasons(showId, options = {}) {
    const details = await this.details(showId, options);
    if (!details || !details.seasons) return [];
    return details.seasons.edges.map(e => e.node);
  }

  /**
   * Retrieve all episodes for a given season.  Queries the `season` type
   * directly.
   *
   * @param {number|string} seasonId The ID of the season.
   * @param {object} [options]
   * @param {string} [options.country='US'] Two‑letter country code.
   * @param {string} [options.language='en'] Language code.
   * @returns {Promise<object[]>} List of episodes with id, title and episodeNumber.
   */
  async episodes(seasonId, options = {}) {
    if (!seasonId) {
      throw new TypeError('A season ID must be provided');
    }
    const { country = 'US', language = 'en' } = options;
    const variables = { id: String(seasonId), country, language };
    const query = `query GetEpisodes($id: ID!, $country: Country!, $language: Language) {
      season(id: $id, country: $country, language: $language) {
        id
        title
        episodes {
          edges {
            node {
              id
              title
              episodeNumber
            }
          }
        }
      }
    }`;
    const data = await this._request('GetEpisodes', query, variables);
    const season = data.season;
    if (!season || !season.episodes) return [];
    return season.episodes.edges.map(e => e.node);
  }

  /**
   * Get offers for a title across multiple countries.  The API does not
   * natively support querying multiple countries in a single call, so
   * this helper issues multiple requests internally and aggregates
   * results keyed by country code.
   *
   * @param {number|string} titleId The title ID.
   * @param {string[]} countries An array of two‑letter country codes.
   * @param {object} [options]
   * @param {string} [options.language='en'] Language code.
   * @returns {Promise<object>} An object mapping each country code to
   *   its list of offers.
   */
  async offersForCountries(titleId, countries, options = {}) {
    if (!titleId) {
      throw new TypeError('A title ID must be provided');
    }
    if (!Array.isArray(countries) || countries.length === 0) {
      throw new TypeError('You must provide an array of country codes');
    }
    const results = {};
    for (const country of countries) {
      const details = await this.details(titleId, { country, language: options.language });
      results[country] = details && details.offers ? details.offers.edges.map(e => e.node) : [];
    }
    return results;
  }

  /**
   * Fetch all streaming providers available in a given country.  This
   * wraps the `popularProviders` connection.  Providers include
   * metadata such as their ID, shortName and clearName.
   *
   * @param {object} [options]
   * @param {string} [options.country='US'] Two‑letter country code.
   * @param {string} [options.language='en'] Language code.
   * @returns {Promise<object[]>} List of providers.
   */
  async providers(options = {}) {
    const { country = 'US', language = 'en' } = options;
    const variables = { country, language };
    const query = `query GetProviders($country: Country!, $language: Language) {
      popularProviders(country: $country, language: $language) {
        edges {
          node {
            id
            shortName
            clearName
            technicalName
            displayName
            priority
          }
        }
      }
    }`;
    const data = await this._request('GetProviders', query, variables);
    const providers = data.popularProviders;
    if (!providers || !providers.edges) return [];
    return providers.edges.map(e => e.node);
  }

  /**
   * Fetch the newest titles by release year.  This function sorts the
   * popular titles list by `RELEASE_YEAR` (descending) and supports
   * the same filtering options as {@link popular}.  It returns a
   * connection object or the raw GraphQL data when `options.raw` is
   * truthy.
   *
   * @param {object} [options]
   * @param {string} [options.country='US'] Two‑letter country code.
   * @param {string} [options.language='en'] Language code.
   * @param {number} [options.count=20] Number of results to return.
   * @param {string|null} [options.cursor=null] Cursor for pagination.
   * @param {string[]} [options.objectTypes] Limit results to specific object types.
   * @param {string[]} [options.providers] Limit results to specific providers.
   * @param {string[]} [options.packages] Only include titles that are available to the given packages (similar to providers).
   * @param {string[]} [options.excludePackages] Exclude titles that are available via the given packages.
   * @param {boolean} [options.raw=false] When true, return the raw GraphQL data instead of just the connection.
   * @returns {Promise<object>} Resolves with a connection object or full GraphQL data.
   */
  async newTitles(options = {}) {
    const {
      country = 'US',
      language = 'en',
      count = 20,
      cursor = null,
      objectTypes = undefined,
      providers = undefined,
      packages: availableToPackages = undefined,
      excludePackages = undefined,
      raw = false
    } = options;
    const variables = {
      country,
      language,
      first: count,
      after: cursor,
      objectTypes,
      providers,
      availableToPackages,
      excludePackages,
      sortBy: 'RELEASE_YEAR',
      sortOrder: 'DESC'
    };
    const query = `query GetNewTitles(
      $first: Int,
      $after: String,
      $country: Country!,
      $language: Language,
      $objectTypes: [ObjectTypeEnum!],
      $providers: [StreamingProvider!],
      $availableToPackages: [String!],
      $excludePackages: [String!],
      $sortBy: PopularSortBy!,
      $sortOrder: SortOrder!
    ) {
      popularTitles(
        first: $first,
        after: $after,
        country: $country,
        language: $language,
        objectTypes: $objectTypes,
        providers: $providers,
        availableToPackages: $availableToPackages,
        excludePackages: $excludePackages,
        sortBy: $sortBy,
        sortOrder: $sortOrder
      ) {
        edges {
          cursor
          node {
            id
            objectType
            title
            fullPath
            originalReleaseYear
            posterUrl
            posterBlurryImageUrl
            shortDescription
            scoring {
              imdbScore
              tmdbScore
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }`;
    const data = await this._request('GetNewTitles', query, variables);
    return raw ? data : data.popularTitles;
  }

  /**
   * Retrieve all titles provided by a specific streaming service.  This
   * helper repeatedly calls {@link popular} until all pages have been
   * exhausted or a maximum number of titles has been reached.  Note
   * that requesting too many pages may hit rate limits or complex
   * query limits on the JustWatch API.  The provider ID should be a
   * short code such as `'nfx'` or `'hbo'`.
   *
   * @param {string} providerId The provider short code (e.g. 'nfx' for Netflix).
   * @param {object} [options]
   * @param {string} [options.country='US'] Two‑letter country code.
   * @param {string} [options.language='en'] Language code.
   * @param {string[]} [options.objectTypes] Limit results to specific object types.
   * @param {string[]} [options.packages] Only include titles available to the given packages.
   * @param {string[]} [options.excludePackages] Exclude titles available via given packages.
   * @param {number} [options.maxCount=2000] Maximum number of titles to fetch.
   * @returns {Promise<object[]>} Array of title nodes.
   */
  async titlesByProvider(providerId, options = {}) {
    if (!providerId || typeof providerId !== 'string') {
      throw new TypeError('A provider ID must be a non‑empty string');
    }
    const {
      country = 'US',
      language = 'en',
      objectTypes = undefined,
      packages: availableToPackages = undefined,
      excludePackages = undefined,
      maxCount = 2000
    } = options;
    let remaining = maxCount;
    let cursor = null;
    const results = [];
    do {
      const page = await this.popular({
        country,
        language,
        count: Math.min(50, remaining),
        cursor,
        objectTypes,
        providers: [providerId],
        packages: availableToPackages,
        excludePackages
      });
      const edges = page && page.edges ? page.edges : [];
      for (const edge of edges) {
        results.push(edge.node);
      }
      remaining -= edges.length;
      cursor = page && page.pageInfo ? page.pageInfo.endCursor : null;
    } while (cursor && remaining > 0);
    return results;
  }
}

module.exports = { SimpleJustWatch };