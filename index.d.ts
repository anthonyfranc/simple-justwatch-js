/**
 * TypeScript declarations for the simple‑justwatch‑js package.
 *
 * The definitions included here are intentionally liberal and may
 * evolve as the underlying GraphQL schema changes.  Consumers
 * should treat all fields as optional and account for missing
 * properties at runtime.
 */

declare module 'simple-justwatch-js' {
  /** Options accepted by the SimpleJustWatch constructor. */
  export interface ClientOptions {
    /**
     * Override the GraphQL endpoint.  Defaults to
     * `https://apis.justwatch.com/graphql`.
     */
    endpoint?: string;
    /** Additional headers to include with every request. */
    headers?: Record<string, string>;
    /**
     * A custom fetch implementation.  If omitted, the library will
     * attempt to use the global `fetch`, falling back to
     * node‑fetch/undici if available.
     */
    fetch?: typeof fetch;
  }

  /** Common pagination info returned by GraphQL connections. */
  export interface PageInfo {
    hasNextPage?: boolean;
    endCursor?: string | null;
  }

  /** Offer information describing monetization options for a title. */
  export interface Offer {
    id?: string;
    monetizationType?: string;
    presentationType?: string;
    retailPrice?: string | null;
    retailPriceValue?: number | null;
    currency?: string | null;
    standardWebURL?: string | null;
    provider?: Provider;
    package?: Provider;
  }

  /** Streaming provider metadata. */
  export interface Provider {
    id?: string;
    shortName?: string;
    clearName?: string;
    technicalName?: string;
    displayName?: string;
    packageId?: number;
    slug?: string;
    monetizationTypes?: string[];
    icon?: string | null;
    iconUrl?: string | null;
    priority?: number;
  }

  /** Scoring information (IMDb, TMDb, etc.). */
  export interface Scoring {
    imdbScore?: number | null;
    tmdbScore?: number | null;
  }

  /** Generic edge wrapper used by GraphQL connections. */
  export interface Edge<T> {
    cursor?: string | null;
    node: T;
  }

  /** Search result object for a title. */
  export interface SearchResult {
    id?: string;
    objectId?: number;
    objectType?: string;
    title?: string;
    fullPath?: string;
    url?: string | null;
    originalReleaseYear?: number | null;
    originalReleaseDate?: string | null;
    posterUrl?: string | null;
    posterFullUrl?: string | null;
    posterBlurryImageUrl?: string | null;
    shortDescription?: string | null;
    ageCertification?: string | null;
    scoring?: Scoring;
    offers?: { edges?: Array<Edge<Offer>> };
  }

  /** Connection wrapper for search results. */
  export interface SearchResultConnection {
    edges?: Array<Edge<SearchResult>>;
    pageInfo?: PageInfo;
  }

  /** Popular result object (same shape as SearchResult). */
  export type PopularResult = SearchResult;

  /** Connection wrapper for popular results. */
  export interface PopularResultConnection {
    edges?: Array<Edge<PopularResult>>;
    pageInfo?: PageInfo;
  }

  /** Genre information. */
  export interface Genre {
    id?: string;
    shortName?: string;
    technicalName?: string;
  }

  /** Details about a title (movie or show). */
  export interface DetailsResult {
    id?: string;
    objectId?: number;
    objectType?: string;
    title?: string;
    fullPath?: string;
    url?: string | null;
    originalReleaseYear?: number | null;
    originalReleaseDate?: string | null;
    runtime?: number | null;
    shortDescription?: string | null;
    fullDescription?: string | null;
    posterUrl?: string | null;
    posterFullUrl?: string | null;
    posterBlurryImageUrl?: string | null;
    productionCountries?: string[];
    genres?: { edges?: Array<Edge<Genre>> };
    scoring?: Scoring;
    offers?: { edges?: Array<Edge<Offer>> };
    seasons?: { edges?: Array<Edge<Season>> };
  }

  /** Season information for a show. */
  export interface Season {
    id?: string;
    objectId?: number;
    objectType?: string;
    title?: string;
    seasonNumber?: number | null;
  }

  /** Episode information for a season. */
  export interface Episode {
    id?: string;
    objectId?: number;
    objectType?: string;
    title?: string;
    seasonNumber?: number | null;
    episodeNumber?: number | null;
    offers?: { edges?: Array<Edge<Offer>> };
  }

  /** Search options passed to the `search` method. */
  export interface SearchOptions {
    country?: string;
    language?: string;
    count?: number;
    cursor?: string | null;
    objectTypes?: string[];
    providers?: string[];
    minReleaseYear?: number;
    maxReleaseYear?: number;
    /** Only include titles available to the specified packages. */
    packages?: string[];
    /** Deprecated: ignored because JustWatch's current GraphQL schema no longer accepts this filter. */
    excludePackages?: string[];
    /** When true, return the raw GraphQL data instead of just the connection. */
    raw?: boolean;
  }

  /** Options passed to the `popular` method. */
  export interface PopularOptions {
    country?: string;
    language?: string;
    count?: number;
    cursor?: string | null;
    objectTypes?: string[];
    providers?: string[];
    minReleaseYear?: number;
    maxReleaseYear?: number;
    /** Only include titles available to the specified packages. */
    packages?: string[];
    /** Deprecated: ignored because JustWatch's current GraphQL schema no longer accepts this filter. */
    excludePackages?: string[];
    /**
     * Sort results by the given criterion.  Valid values include
     * 'POPULAR', 'TRENDING', 'IMDB_SCORE', 'TMDB_POPULARITY',
     * 'RELEASE_YEAR' and 'ALPHABETICAL'.  Defaults to 'POPULAR'.
     */
    sortBy?: string;
    /** Deprecated: ignored because JustWatch's current GraphQL schema sorts by the selected criterion. */
    sortOrder?: string;
    /** When true, return the raw GraphQL data instead of just the connection. */
    raw?: boolean;
  }

  /** Options passed to the `newTitles` method. */
  export interface NewTitlesOptions extends PopularOptions {}

  /** Options passed to the `titlesByProvider` method. */
  export interface TitlesByProviderOptions {
    country?: string;
    language?: string;
    objectTypes?: string[];
    packages?: string[];
    /** Deprecated: ignored because JustWatch's current GraphQL schema no longer accepts this filter. */
    excludePackages?: string[];
    /** Maximum number of titles to fetch.  Defaults to 2000. */
    maxCount?: number;
  }

  /** Options passed to the `details` method. */
  export interface DetailsOptions {
    country?: string;
    language?: string;
    /** Return only the best offer per provider. Defaults to true. */
    bestOnly?: boolean;
  }

  /** Options passed to the `providers` method. */
  export interface ProvidersOptions {
    country?: string;
  }

  /**
   * The main API client.  Instances are lightweight and can be
   * configured independently.  All methods return Promises and will
   * reject on network or GraphQL errors.
   */
  export class SimpleJustWatch {
    constructor(options?: ClientOptions);
    /**
     * Search for titles matching the provided string.
     * @param title The search query.
     * @param options Additional search options.
     */
    search(title: string, options?: SearchOptions): Promise<SearchResultConnection | any>;
    /**
     * Fetch currently popular titles.
     */
    popular(options?: PopularOptions): Promise<PopularResultConnection | any>;
    /**
     * Fetch detailed information about a title by its ID.
     */
    details(id: string, options?: DetailsOptions): Promise<DetailsResult>;
    /**
     * Retrieve all seasons for a given show ID.
     */
    seasons(showId: string, options?: DetailsOptions): Promise<Season[]>;
    /**
     * Retrieve all episodes for a given season ID.
     */
    episodes(seasonId: string, options?: DetailsOptions): Promise<Episode[]>;
    /**
     * Get offers for a title across multiple countries.  Returns an
     * object keyed by country code.
     */
    offersForCountries(titleId: string, countries: string[], options?: { language?: string }): Promise<Record<string, Offer[]>>;
    /**
     * Fetch all streaming providers available in a given country.
     */
    providers(options?: ProvidersOptions): Promise<Provider[]>;

    /**
     * Fetch the newest titles by release year.  Sorts popular titles
     * by `RELEASE_YEAR` descending.  Accepts the same options as
     * `popular`.  When `options.raw` is true, returns the full
     * GraphQL response.
     */
    newTitles(options?: NewTitlesOptions): Promise<PopularResultConnection | any>;

    /**
     * Retrieve all titles provided by a specific streaming service.  Fetches
     * and concatenates pages of `popular` results filtered by provider.
     */
    titlesByProvider(providerId: string, options?: TitlesByProviderOptions): Promise<PopularResult[]>;
  }
}
