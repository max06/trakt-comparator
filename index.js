const debug = require('debug')('core');
const Storage = require('node-storage');
const Trakt = require('trakt.tv');

var store = new Storage('config.json');

var missing = 0;

const trakt = new Trakt({
  client_id: store.get('config.client_id'),
  client_secret: store.get('config.client_secret'),
  redirect_uri: null,   // defaults to 'urn:ietf:wg:oauth:2.0:oob'
  api_url: null,        // defaults to 'https://api.trakt.tv'
  useragent: null,      // defaults to 'trakt.tv/<version>'
  pagination: true,     // defaults to false, global pagination (see below)
  debug: false
});

var token = store.get('trakt');
if (token) {
  trakt.import_token(token).then(newTokens => {
    // Contains token, refreshed if needed (store it back)
  });
} else {
  trakt.get_codes().then(poll => {
    // poll.verification_url: url to visit in a browser
    // poll.user_code: the code the user needs to enter on trakt  
    debug("Open up %s and enter the code %s", poll.verification_url, poll.user_code);
    // verify if app was authorized
    return trakt.poll_access(poll);
  }).then(data => {
    store.put('trakt', trakt.export_token());
  }).catch(error => {
    debug ("Error appeared!");
    debug(error);
    // error.message == 'Expired' will be thrown if timeout is reached
  });  
}

trakt.sync.collection.get({type: "shows"}).then(collectedShows => {
  var promises = collectedShows.data.map(function(element) {
    return trakt.shows.summary({
      id: element.show.ids.trakt,
      extended: "full"
    }).then(summary => {
      var collected = countEpisodes(element);
      var aired = summary.data.aired_episodes;

      if (collected < aired) {
        missing += (aired-collected);
        debug("%s, %i collected, %i available", element.show.title, collected, aired);
      }
      return summary;
    })
  })

  Promise.all(promises).then(results => {
    debug("Total missing: %i", missing);
  });
})

var countEpisodes = function(data) {
  var counter = 0;
  data.seasons.forEach(function(season) {
    season.episodes.forEach(function(episode) {
      counter++;
    });
  });
  return counter;
}