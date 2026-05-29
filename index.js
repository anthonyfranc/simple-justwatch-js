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

const IMAGES_URL = 'https://images.justwatch.com';
const DETAILS_URL = 'https://justwatch.com';

const PACKAGE_FRAGMENT = `
fragment PackageDetails on Package {
  id
  packageId
  clearName
  technicalName
  shortName
  slug
  monetizationTypes
  icon(profile: S100, format: $formatOfferIcon)
}`;

const OFFER_FRAGMENT = `
fragment TitleOffer on Offer {
  id
  monetizationType
  presentationType
  retailPrice(language: $language)
  retailPriceValue
  currency
  lastChangeRetailPriceValue
  type
  standardWebURL
  elementCount
  availableTo
  subtitleLanguages
  videoTechnology
  audioTechnology
  audioLanguages
  package {
    ...PackageDetails
  }
}`;

const TITLE_DETAILS_FRAGMENT = `
fragment TitleDetails on MovieOrShowOrSeasonOrEpisode {
  id
  objectId
  objectType
  content(country: $country, language: $language) {
    title
    originalReleaseYear
    originalReleaseDate
    runtime
    shortDescription
    ... on MovieOrShowContent {
      fullPath
      ageCertification
      posterUrl(profile: $profile, format: $formatPoster)
      backdrops(profile: $backdropProfile, format: $formatPoster) {
        backdropUrl
      }
      genres {
        shortName
        technicalName
      }
      externalIds {
        imdbId
        tmdbId
      }
      scoring {
        imdbScore
        imdbVotes
        tmdbPopularity
        tmdbScore
        tomatoMeter
        certifiedFresh
        jwRating
      }
    }
    ... on SeasonContent {
      seasonNumber
    }
    ... on EpisodeContent {
      seasonNumber
      episodeNumber
    }
  }
  offers(country: $country, platform: WEB, filter: $filter) {
    ...TitleOffer
  }
}`;

const SEARCH_QUERY = `
query GetSearchTitles(
  $searchTitlesFilter: TitleFilter!,
  $country: Country!,
  $language: Language!,
  $first: Int!,
  $formatPoster: ImageFormat,
  $formatOfferIcon: ImageFormat,
  $profile: PosterProfile,
  $backdropProfile: BackdropProfile,
  $filter: OfferFilter!,
  $offset: Int = 0
) {
  popularTitles(
    country: $country,
    filter: $searchTitlesFilter,
    first: $first,
    sortBy: POPULAR,
    sortRandomSeed: 0,
    offset: $offset
  ) {
    edges {
      cursor
      node {
        ...TitleDetails
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
${TITLE_DETAILS_FRAGMENT}
${OFFER_FRAGMENT}
${PACKAGE_FRAGMENT}`;

const POPULAR_QUERY = `
query GetPopularTitles(
  $popularTitlesFilter: TitleFilter,
  $country: Country!,
  $language: Language!,
  $first: Int!,
  $sortBy: PopularTitlesSorting!,
  $formatPoster: ImageFormat,
  $formatOfferIcon: ImageFormat,
  $profile: PosterProfile,
  $backdropProfile: BackdropProfile,
  $filter: OfferFilter!,
  $offset: Int = 0
) {
  popularTitles(
    country: $country,
    filter: $popularTitlesFilter,
    first: $first,
    sortBy: $sortBy,
    sortRandomSeed: 0,
    offset: $offset
  ) {
    edges {
      cursor
      node {
        ...TitleDetails
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
${TITLE_DETAILS_FRAGMENT}
${OFFER_FRAGMENT}
${PACKAGE_FRAGMENT}`;

const DETAILS_QUERY = `
query GetTitleNode(
  $nodeId: ID!,
  $country: Country!,
  $language: Language!,
  $formatPoster: ImageFormat,
  $formatOfferIcon: ImageFormat,
  $profile: PosterProfile,
  $backdropProfile: BackdropProfile,
  $filter: OfferFilter!
) {
  node(id: $nodeId) {
    ...TitleDetails
    ... on Show {
      totalSeasonCount
      seasons(sortDirection: ASC) {
        ...TitleDetails
      }
    }
    ... on Season {
      totalEpisodeCount
      episodes(sortDirection: ASC) {
        ...TitleDetails
      }
    }
  }
}
${TITLE_DETAILS_FRAGMENT}
${OFFER_FRAGMENT}
${PACKAGE_FRAGMENT}`;

const PROVIDERS_QUERY = `
query GetProviders($country: Country!, $formatOfferIcon: ImageFormat) {
  packages(country: $country, platform: WEB, includeAddons: true) {
    ...PackageDetails
  }
}
${PACKAGE_FRAGMENT}`;

function commonVariables(country, language, bestOnly) {
  return {
    country: String(country).toUpperCase(),
    language,
    formatPoster: 'JPG',
    formatOfferIcon: 'PNG',
    profile: 'S718',
    backdropProfile: 'S1920',
    filter: { bestOnly }
  };
}

function validateNodeId(id, label) {
  if (typeof id !== 'string' || id.trim() === '') {
    throw new TypeError(`${label} must be a non-empty JustWatch node ID string`);
  }
}

function titleFilter({ title, providers, packages, minReleaseYear, maxReleaseYear, objectTypes }) {
  const selectedPackages = providers || packages;
  return {
    searchQuery: title,
    packages: selectedPackages,
    includeTitlesWithoutUrl: true,
    objectTypes,
    releaseYear: {
      min: minReleaseYear,
      max: maxReleaseYear
    }
  };
}

function cursorToOffset(cursor) {
  if (cursor == null || cursor === '') return null;
  if (typeof cursor === 'number') return cursor;
  const numeric = Number(cursor);
  if (Number.isInteger(numeric)) return numeric;
  try {
    const decoded = typeof Buffer !== 'undefined'
      ? Buffer.from(String(cursor), 'base64').toString('utf8')
      : atob(String(cursor));
    const decodedNumeric = Number(decoded);
    return Number.isInteger(decodedNumeric) ? decodedNumeric : null;
  } catch (ex) {
    return null;
  }
}

function imageUrl(path) {
  if (!path || /^https?:\/\//.test(path)) return path || null;
  return `${IMAGES_URL}${path}`;
}

function detailsUrl(path) {
  if (!path || /^https?:\/\//.test(path)) return path || null;
  return `${DETAILS_URL}${path}`;
}

function normalizePackage(pkg) {
  if (!pkg) return undefined;
  return {
    ...pkg,
    iconUrl: imageUrl(pkg.icon)
  };
}

function normalizeOffer(offer) {
  if (!offer) return offer;
  const provider = normalizePackage(offer.package);
  return {
    ...offer,
    provider,
    package: provider
  };
}

function edgeConnection(items) {
  return {
    edges: (items || []).map(node => ({ node: normalizeTitle(node) }))
  };
}

function normalizeTitle(node) {
  if (!node) return node;
  const content = node.content || {};
  const offers = (node.offers || []).map(normalizeOffer);
  return {
    ...node,
    title: content.title,
    fullPath: content.fullPath,
    url: detailsUrl(content.fullPath),
    originalReleaseYear: content.originalReleaseYear,
    originalReleaseDate: content.originalReleaseDate,
    runtime: content.runtime,
    shortDescription: content.shortDescription,
    ageCertification: content.ageCertification,
    posterUrl: content.posterUrl,
    posterFullUrl: imageUrl(content.posterUrl),
    backdrops: (content.backdrops || []).map(backdrop => ({
      ...backdrop,
      backdropFullUrl: imageUrl(backdrop && backdrop.backdropUrl)
    })),
    genres: {
      edges: (content.genres || []).map(genre => ({ node: genre }))
    },
    externalIds: content.externalIds,
    scoring: content.scoring,
    offers: {
      edges: offers.map(offer => ({ node: offer }))
    },
    seasons: edgeConnection(node.seasons),
    episodes: edgeConnection(node.episodes),
    seasonNumber: content.seasonNumber,
    episodeNumber: content.episodeNumber
  };
}

function normalizeConnection(connection) {
  return {
    ...connection,
    edges: ((connection && connection.edges) || []).map(edge => ({
      ...edge,
      node: normalizeTitle(edge.node)
    }))
  };
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
    const status = response && typeof response.status === 'number' ? response.status : undefined;
    let responseText = '';
    let json;
    try {
      if (response && typeof response.text === 'function') {
        responseText = await response.text();
        json = responseText ? JSON.parse(responseText) : {};
      } else {
        json = await response.json();
      }
    } catch (ex) {
      const error = new Error('GraphQL request failed');
      error.operationName = operationName;
      error.status = status;
      error.responseText = responseText;
      error.cause = ex;
      throw error;
    }
    if (response && response.ok === false) {
      const error = new Error('GraphQL request failed');
      error.operationName = operationName;
      error.status = status;
      error.responseText = responseText;
      error.errors = json && json.errors;
      throw error;
    }
    if (json.errors) {
      const error = new Error('GraphQL request failed');
      error.operationName = operationName;
      error.status = status;
      error.responseText = responseText;
      error.errors = json.errors;
      throw error;
    }
    return json.data;
  }

  /**
   * Search for titles.  This function calls the current JustWatch
   * `popularTitles` field with a search filter and returns a paginated
   * result set.
   *
   * @param {string} title The search string.
   * @param {object} [options]
   * @param {string} [options.country='US'] Two‑letter country code (ISO 3166‑1 alpha‑2).  For example, 'US'.
   * @param {string} [options.language='en'] Language code (ISO 639‑1).  For example, 'en'.
   * @param {number} [options.count=20] Number of entries to request.  The API may cap this value.
   * @param {string|number|null} [options.cursor=null] Cursor or numeric offset for pagination.  Current JustWatch pagination is offset-based, so base64 numeric cursors are decoded to offsets.
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
      // popularTitles connection.  Useful when you need to inspect
      // the complete JSON structure.
      raw = false
    } = options;
    const variables = {
      searchTitlesFilter: titleFilter({
        title,
        providers,
        packages: availableToPackages,
        minReleaseYear,
        maxReleaseYear,
        objectTypes
      }),
      first: count,
      offset: cursorToOffset(cursor),
      ...commonVariables(country, language, true)
    };
    void excludePackages;
    const data = await this._request('GetSearchTitles', SEARCH_QUERY, variables);
    // If the caller requested the raw data structure, return the
    // complete data object.  Otherwise return just the popularTitles
    // connection.
    return raw ? data : normalizeConnection(data.popularTitles);
  }

  /**
   * Fetch currently popular titles.  This wraps the `popularTitles` connection.
   *
   * @param {object} [options]
   * @param {string} [options.country='US'] Two‑letter country code.
   * @param {string} [options.language='en'] Language code.
   * @param {number} [options.count=20] Number of results to return.
   * @param {string|number|null} [options.cursor=null] Cursor or numeric offset for pagination.  Current JustWatch pagination is offset-based, so base64 numeric cursors are decoded to offsets.
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
      minReleaseYear = undefined,
      maxReleaseYear = undefined,
      // Filter results by offers available through specific packages.
      packages: availableToPackages = undefined,
      // Exclude results that are available through specific packages.
      excludePackages = undefined,
      // Specify sorting for the popular titles.  Valid values for
      // `sortBy` include: 'POPULAR', 'TRENDING', 'IMDB_SCORE',
      // 'TMDB_POPULARITY', 'RELEASE_YEAR' and 'ALPHABETICAL'.  The
      // default is 'POPULAR'.
      sortBy = 'POPULAR',
      // Deprecated no-op kept for backward compatibility. The current
      // public schema sorts by the selected criterion.
      sortOrder = 'DESC',
      // If true, return the raw GraphQL data instead of just the
      // popularTitles connection.
      raw = false
    } = options;
    const variables = {
      popularTitlesFilter: titleFilter({
        providers,
        packages: availableToPackages,
        minReleaseYear,
        maxReleaseYear,
        objectTypes
      }),
      first: count,
      offset: cursorToOffset(cursor),
      sortBy,
      ...commonVariables(country, language, true)
    };
    void excludePackages;
    void sortOrder;
    const data = await this._request('GetPopularTitles', POPULAR_QUERY, variables);
    return raw ? data : normalizeConnection(data.popularTitles);
  }

  /**
   * Fetch detailed information about a title by its JustWatch node ID.  The
   * returned data includes offers, scoring information and seasons for
   * shows. Current node IDs are strings like `tm10` and `ts389`.
   *
   * @param {string} id The JustWatch title node ID.
   * @param {object} [options]
   * @param {string} [options.country='US'] Two‑letter country code.
   * @param {string} [options.language='en'] Language code.
   * @returns {Promise<object>} Resolves with the title object.
   */
  async details(id, options = {}) {
    validateNodeId(id, 'Title ID');
    const { country = 'US', language = 'en', bestOnly = true } = options;
    const variables = {
      nodeId: id,
      ...commonVariables(country, language, bestOnly)
    };
    const data = await this._request('GetTitleNode', DETAILS_QUERY, variables);
    return normalizeTitle(data.node);
  }

  /**
   * Retrieve all seasons for a given show.  This is a convenience
   * wrapper around the node details query; if the provided ID refers to
   * a movie, an empty array is returned.
   *
   * @param {string} showId The JustWatch show node ID.
   * @param {object} [options]
   * @param {string} [options.country='US'] Two‑letter country code.
   * @param {string} [options.language='en'] Language code.
   * @returns {Promise<object[]>} List of season objects with id, title and seasonNumber.
   */
  async seasons(showId, options = {}) {
    validateNodeId(showId, 'Show ID');
    const details = await this.details(showId, options);
    if (!details || !details.seasons) return [];
    return details.seasons.edges.map(e => e.node);
  }

  /**
   * Retrieve all episodes for a given season.
   *
   * @param {string} seasonId The JustWatch season node ID.
   * @param {object} [options]
   * @param {string} [options.country='US'] Two‑letter country code.
   * @param {string} [options.language='en'] Language code.
   * @returns {Promise<object[]>} List of episodes with id, title and episodeNumber.
   */
  async episodes(seasonId, options = {}) {
    validateNodeId(seasonId, 'Season ID');
    const season = await this.details(seasonId, options);
    if (!season || !season.episodes) return [];
    return season.episodes.edges.map(e => e.node);
  }

  /**
   * Get offers for a title across multiple countries.  The API does not
   * natively support querying multiple countries in a single call, so
   * this helper issues multiple requests internally and aggregates
   * results keyed by country code.
   *
   * @param {string} titleId The JustWatch title node ID.
   * @param {string[]} countries An array of two‑letter country codes.
   * @param {object} [options]
   * @param {string} [options.language='en'] Language code.
   * @returns {Promise<object>} An object mapping each country code to
   *   its list of offers.
   */
  async offersForCountries(titleId, countries, options = {}) {
    validateNodeId(titleId, 'Title ID');
    if (!Array.isArray(countries) || countries.length === 0) {
      throw new TypeError('You must provide an array of country codes');
    }
    const results = {};
    for (const country of countries) {
      const details = await this.details(titleId, {
        country,
        language: options.language,
        bestOnly: options.bestOnly
      });
      results[country] = details && details.offers ? details.offers.edges.map(e => e.node) : [];
    }
    return results;
  }

  /**
   * Fetch all streaming providers available in a given country.  This
   * wraps the current JustWatch `packages` field. Providers include
   * metadata such as their ID, shortName and clearName.
   *
   * @param {object} [options]
   * @param {string} [options.country='US'] Two‑letter country code.
   * @returns {Promise<object[]>} List of providers.
   */
  async providers(options = {}) {
    const { country = 'US' } = options;
    const variables = { country: String(country).toUpperCase(), formatOfferIcon: 'PNG' };
    const data = await this._request('GetProviders', PROVIDERS_QUERY, variables);
    return (data.packages || []).map(normalizePackage);
  }

  /**
   * Fetch the newest titles by release year.  This function sorts the
   * popular titles list by `RELEASE_YEAR` and supports
   * the same filtering options as {@link popular}.  It returns a
   * connection object or the raw GraphQL data when `options.raw` is
   * truthy.
   *
   * @param {object} [options]
   * @param {string} [options.country='US'] Two‑letter country code.
   * @param {string} [options.language='en'] Language code.
   * @param {number} [options.count=20] Number of results to return.
   * @param {string|number|null} [options.cursor=null] Cursor or numeric offset for pagination.
   * @param {string[]} [options.objectTypes] Limit results to specific object types.
   * @param {string[]} [options.providers] Limit results to specific providers.
   * @param {string[]} [options.packages] Only include titles that are available to the given packages (similar to providers).
   * @param {string[]} [options.excludePackages] Deprecated no-op retained for compatibility.
   * @param {boolean} [options.raw=false] When true, return the raw GraphQL data instead of just the connection.
   * @returns {Promise<object>} Resolves with a connection object or full GraphQL data.
   */
  async newTitles(options = {}) {
    return this.popular({
      ...options,
      sortBy: 'RELEASE_YEAR',
      sortOrder: 'DESC'
    });
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
   * @param {string[]} [options.excludePackages] Deprecated no-op retained for compatibility.
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
