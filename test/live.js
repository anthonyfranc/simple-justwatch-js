const assert = require('node:assert/strict');
const { SimpleJustWatch } = require('../');

(async () => {
  const jw = new SimpleJustWatch();

  const search = await jw.search('The Matrix', {
    country: 'US',
    count: 1,
    objectTypes: ['MOVIE']
  });
  const searchNode = search.edges && search.edges[0] && search.edges[0].node;
  assert.ok(searchNode && searchNode.title, 'search returns a titled node');
  assert.ok(searchNode.posterFullUrl, 'search node has a full poster URL');
  assert.ok(searchNode.genres && Array.isArray(searchNode.genres.edges), 'search node has normalized genre edges');
  assert.ok(
    searchNode.offers && searchNode.offers.edges.some(edge => edge.node && edge.node.provider),
    'search node has normalized offer providers'
  );

  const popular = await jw.popular({ country: 'US', count: 1, providers: ['nfx'] });
  assert.ok(popular.edges && popular.edges[0] && popular.edges[0].node.title, 'popular returns a titled node');

  const details = await jw.details('tm10', { country: 'US' });
  assert.equal(details.id, 'tm10');
  assert.ok(details.title, 'details returns title');
  assert.ok(details.posterFullUrl, 'details has a full poster URL');
  assert.ok(details.genres && Array.isArray(details.genres.edges), 'details has normalized genre edges');

  const seasons = await jw.seasons('ts389', { country: 'US' });
  assert.ok(seasons.length > 0, 'seasons returns at least one season');
  assert.ok(seasons[0].id, 'season has an id');

  const episodes = await jw.episodes(seasons[0].id, { country: 'US' });
  assert.ok(episodes.length > 0, 'episodes returns at least one episode');
  assert.ok(episodes[0].title, 'episode has title');

  const offersByCountry = await jw.offersForCountries('tm10', ['US', 'GB'], { language: 'en' });
  assert.ok(Array.isArray(offersByCountry.US), 'US offers are an array');
  assert.ok(Array.isArray(offersByCountry.GB), 'GB offers are an array');

  const providers = await jw.providers({ country: 'US' });
  assert.ok(providers.length > 0, 'providers returns at least one provider');
  assert.ok(providers[0].iconUrl, 'provider has full icon URL');

  const titlesByProvider = await jw.titlesByProvider('nfx', { country: 'US', maxCount: 3 });
  assert.ok(titlesByProvider.length > 0 && titlesByProvider.length <= 3, 'titlesByProvider respects maxCount');
  assert.ok(titlesByProvider[0].title, 'titlesByProvider returns title nodes');
})();
