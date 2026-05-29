const assert = require('node:assert/strict');
const { SimpleJustWatch } = require('../');

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload)
  };
}

function makeClient() {
  const calls = [];
  const client = new SimpleJustWatch({
    fetch: async (url, request) => {
      const body = JSON.parse(request.body);
      calls.push(body);

      if (body.operationName === 'GetSearchTitles' || body.operationName === 'GetPopularTitles') {
        return jsonResponse({
          data: {
            popularTitles: {
              edges: [
                {
                  cursor: 'MQ==',
                  node: {
                    id: 'tm10',
                    objectId: 10,
                    objectType: 'MOVIE',
                    content: {
                      title: 'The Matrix',
                      fullPath: '/us/movie/the-matrix',
                      originalReleaseYear: 1999,
                      posterUrl: '/poster/79353084/s718/the-matrix.jpg',
                      genres: [{ shortName: 'scf', technicalName: 'scifi' }],
                      scoring: { imdbScore: 8.7 }
                    },
                    offers: [
                      {
                        id: 'offer1',
                        monetizationType: 'RENT',
                        retailPrice: '$3.99',
                        retailPriceValue: 3.99,
                        package: {
                          id: 'pkg1',
                          shortName: 'nfx',
                          clearName: 'Netflix',
                          icon: '/icon/207360008/s100/netflix.png'
                        }
                      }
                    ]
                  }
                }
              ],
              pageInfo: { hasNextPage: true, endCursor: 'MQ==' }
            }
          }
        });
      }

      if (body.operationName === 'GetTitleNode') {
        return jsonResponse({
          data: {
            node: {
              id: body.variables.nodeId,
              objectType: body.variables.nodeId.startsWith('tss') ? 'SEASON' : 'MOVIE',
              content: {
                title: body.variables.nodeId,
                fullPath: '/us/movie/the-matrix',
                posterUrl: '/poster/79353084/s718/the-matrix.jpg',
                genres: [{ shortName: 'act', technicalName: 'action' }]
              },
              offers: [],
              seasons: [
                {
                  id: 'tss553',
                  objectType: 'SEASON',
                  content: { title: 'Season 1', seasonNumber: 1 }
                }
              ],
              episodes: [
                {
                  id: 'tse1',
                  objectType: 'EPISODE',
                  content: { title: 'Pilot', seasonNumber: 1, episodeNumber: 1 }
                }
              ]
            }
          }
        });
      }

      if (body.operationName === 'GetProviders') {
        return jsonResponse({
          data: {
            packages: [
              {
                id: 'pkg1',
                packageId: 8,
                shortName: 'nfx',
                clearName: 'Netflix',
                icon: '/icon/207360008/s100/netflix.png'
              }
            ]
          }
        });
      }

      return jsonResponse({ errors: [{ message: 'Unexpected operation' }] });
    }
  });
  return { client, calls };
}

(async () => {
  const { client, calls } = makeClient();

  const search = await client.search('The Matrix', { count: 1, cursor: 'MQ==', excludePackages: ['hlu'] });
  assert.equal(search.edges[0].node.title, 'The Matrix');
  assert.equal(search.edges[0].node.posterFullUrl, 'https://images.justwatch.com/poster/79353084/s718/the-matrix.jpg');
  assert.equal(search.edges[0].node.offers.edges[0].node.provider.clearName, 'Netflix');
  assert.equal(search.edges[0].node.genres.edges[0].node.technicalName, 'scifi');
  assert.equal(calls[0].variables.offset, 1);
  assert.equal(calls[0].variables.searchTitlesFilter.excludePackages, undefined);

  const popular = await client.popular({ providers: ['nfx'], sortOrder: 'ASC' });
  assert.equal(popular.edges[0].node.id, 'tm10');
  assert.equal(calls[1].variables.popularTitlesFilter.packages[0], 'nfx');
  assert.equal(calls[1].variables.sortOrder, undefined);

  const details = await client.details('tm10');
  assert.equal(details.title, 'tm10');
  assert.equal(details.seasons.edges[0].node.title, 'Season 1');

  const seasons = await client.seasons('ts389');
  assert.equal(seasons[0].id, 'tss553');

  const episodes = await client.episodes('tss553');
  assert.equal(episodes[0].episodeNumber, 1);

  const offers = await client.offersForCountries('tm10', ['US', 'GB'], { bestOnly: false });
  assert.deepEqual(Object.keys(offers), ['US', 'GB']);

  const providers = await client.providers();
  assert.equal(providers[0].iconUrl, 'https://images.justwatch.com/icon/207360008/s100/netflix.png');

  await assert.rejects(() => client.details(10), /node ID string/);
  await assert.rejects(() => client.seasons(''), /node ID string/);
  await assert.rejects(() => client.episodes(null), /node ID string/);
  await assert.rejects(() => client.offersForCountries(10, ['US']), /node ID string/);

  const graphqlClient = new SimpleJustWatch({
    fetch: async () => jsonResponse({ errors: [{ message: 'Nope' }] }, 422)
  });
  await assert.rejects(
    () => graphqlClient.providers(),
    error => {
      assert.equal(error.message, 'GraphQL request failed');
      assert.equal(error.operationName, 'GetProviders');
      assert.equal(error.status, 422);
      assert.equal(error.errors[0].message, 'Nope');
      assert.match(error.responseText, /Nope/);
      return true;
    }
  );

  const invalidJsonClient = new SimpleJustWatch({
    fetch: async () => ({ ok: true, status: 200, text: async () => 'not json' })
  });
  await assert.rejects(
    () => invalidJsonClient.providers(),
    error => {
      assert.equal(error.operationName, 'GetProviders');
      assert.equal(error.responseText, 'not json');
      return true;
    }
  );
})();
