'use strict';
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const superagent = require('superagent');
const pg = require('pg');

const client = new pg.Client(process.env.DATABASE_URL);
client.connect();

const app = express();
app.use(cors());

const CACHE_MAX_AGE = {
  WEATHER: 60000,
  EVENTS: 60000,
  MOVIES: 60000,
  YELPS: 60000
};

function Location(query, formatted, lat, long, region_code) {
  this.search_query = query;
  this.formatted_query = formatted;
  this.latitude = lat;
  this.longitude = long;
  this.region_code = region_code;
}

Location.prototype.save = function () {
  return insertInto('locations')
    .columns('search_query', 'formatted_query', 'latitude', 'longitude', 'region_code', 'created_at')
    .values(this.search_query, this.formatted_query, this.latitude, this.longitude, this.region_code, Date.now())
    .finish('ON CONFLICT DO NOTHING RETURNING id', result => {
      this.id = result.rows[0].id;
      return this;
    });
};

function Weather(locationId, weatherData) {
  this.locationId = locationId;
  this.forecast = weatherData.summary || weatherData.forecast;
  this.time = isNaN(weatherData.time) ? weatherData.time : convertTime(weatherData.time * 1000);
}

Weather.prototype.save = function () {
  insertInto('weather')
    .columns('forecast', 'time', 'location_id', 'created_at')
    .values(this.forecast, this.time, this.locationId, Date.now())
    .finish('ON CONFLICT DO NOTHING');
};

function Event(locationId, eventData) {
  this.locationId = locationId;
  this.link = eventData.url || eventData.link;
  this.name = eventData.name.text ? eventData.name.text : eventData.name;
  this.event_date = eventData.start ? eventData.start.local : eventData.event_date;
  this.summary = eventData.description ? eventData.description.text : eventData.summary;
}

Event.prototype.save = function () {
  insertInto('events')
    .columns('location_id', 'name', 'event_date', 'link', 'summary', 'created_at')
    .values(this.locationId, this.name, this.event_date, this.link, this.summary, Date.now())
    .finish('ON CONFLICT DO NOTHING');
};

function Movie(regionCode, movieData) {
  this.region_code = regionCode;
  this.title = movieData.title;
  this.overview = movieData.overview;
  this.average_votes = movieData.vote_average;
  this.total_votes = movieData.vote_count;
  this.image_url = `https://image.tmdb.org/t/p/w185_and_h278_bestv2${movieData.poster_path}`;
  this.popularity = movieData.popularity;
  this.released_on = movieData.release_date;
}

Movie.prototype.save = function () {
  insertInto('movies')
    .columns('region_code', 'title', 'overview', 'average_votes', 'total_votes', 'image_url', 'popularity', 'released_on', 'created_at')
    .values(this.region_code, this.title, this.overview, this.average_votes, this.total_votes, this.image_url, this.popularity, this.released_on, Date.now())
    .finish('ON CONFLICT DO NOTHING');
};

function YelpLocation(locationId, yelpData) {
  this.location_id = locationId;
  this.name = yelpData.name;
  this.image_url = yelpData.image_url;
  this.price = yelpData.price;
  this.rating = yelpData.rating;
  this.url = yelpData.url;
}

YelpLocation.prototype.save = function() {
  insertInto('yelps')
    .columns('location_id', 'name', 'image_url', 'price', 'rating', 'url', 'created_at')
    .values(this.location_id, this.name, this.image_url, this.price, this.rating, this.url, Date.now())
    .finish('ON CONFLICT DO NOTHING');
};

app.get('/location', handleLocationRoute);

app.get('/events', handleEventsRoute);

app.get('/weather', handleWeatherRoute);

app.get('/movies', handleMoviesRoute);

app.get('/yelp', handleYelpRoute);

app.get('*', (req, res) => {
  res.status(404).send({ status: 404, responseText: 'This item could not be found...' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('I know that you came to party baby, baby, baby, baby');
});

//Functions below.

function convertTime(timeInMilliseconds) {
  return new Date(timeInMilliseconds).toString().split(' ').slice(0, 4).join(' ');
}

function handleError(error, response) {
  response.status(error.status || 500).send(error.message);
}

function getErrorHandler(response) {
  return (error) => handleError(error, response);
}

function getLocation(request) {
  const sql = 'SELECT * FROM locations WHERE latitude=$1 AND longitude=$2;';
  const latitude = request.query.data.latitude !== undefined ? request.query.data.latitude : request.query.data.rows[0].latitude;
  const longitude = request.query.data.longitude !== undefined ? request.query.data.longitude : request.query.data.rows[0].longitude;
  console.log(`Lat: ${latitude}, Lng: ${longitude}`);
  const values = [latitude, longitude];
  return client.query(sql, values).then(results => {
    console.log(results.rows[0]);
    return results.rows[0];
  });
}

function getLocationById(locationId) {
  const query = 'SELECT * FROM locations WHERE id=$1;';
  const values = [locationId];
  return client.query(query, values).then(results => {
    return results.rows[0];
  });
}

const insertInto = (table) => ({
  columns: (...columns) => ({
    values: (...values) => ({
      finish: (extras, onResults) => {
        let valueReplacer = '$1';
        for (let i = 1; i < values.length; i++) {
          valueReplacer += `, $${i + 1}`;
        }
        let sql = `INSERT INTO ${table} (${columns}) VALUES(${valueReplacer})`;
        if (extras) {
          sql += ` ${extras}`;
        }
        sql += ';';
        //console.log(sql);
        if (onResults) {
          return client.query(sql, values).then(onResults);
        }
        client.query(sql, values).catch(error => {
          console.log(`We seem to have encountered a bug: ${error}`);
          console.log(values);
        });
      }
    }),
  })
});

const deleteFrom = (table) => ({
  where: (...columns) => ({
    are: (...values) => {
      let sql = `DELETE FROM ${table} WHERE `;
      for (let i = 0; i < columns.length; i++) {
        sql += `${columns[i]}=$${i + 1}`;
        if (i + 1 < columns.length) {
          sql += ' AND ';
        }
      }
      sql += ';';
      //console.log(sql);
      return client.query(sql, values).catch(error => {
        console.log(`We seem to have encountered a bug: ${error}`);
        console.log(values);
      });
    },
  }),
});

const forRequest = (request, response) => ({
  selectFrom: (table) => ({
    where: (...columns) => ({
      are: (...values) => {
        let sql = `SELECT * FROM ${table} WHERE `;
        for (let i = 0; i < columns.length; i++) {
          sql += `${columns[i]}=$${i + 1}`;
          if (i + 1 < columns.length) {
            sql += ' AND ';
          }
        }
        sql += ';';
        //console.log(sql);
        //console.log(values);
        const pending = client.query(sql, values).catch(error => {
          console.log(`We seem to have encountered a bug: ${error}`);
          console.log(values);
        });
        return {
          then: function(onMiss, onHit) {
            pending.then(recieved => {
              if (recieved.rows.length === 0) {
                console.log('Miss, '+recieved.rows.length);
                onMiss(request, response);
              } else {
                console.log('Hit');
                onHit(recieved, request, response);
              }
              console.log('Finished handling request');
            });
          }
        };
      }
    }),
  }),
});

function handleLocationRoute(request, response) {
  console.log('Handle location');
  forRequest(request, response).selectFrom('locations').where('search_query').are(request.query.data).then(
    onLocationMiss,
    onLocationHit
  );
}

function onLocationHit(results, request, response) {
  console.log('Location hit');
  response.send(results.rows[0]);
  //.setHeader('Authorization', `Bearer ${}`)
}

function onLocationMiss(request, response) {
  console.log('Location miss');
  superagent.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`)
    .then(locationData => {
      let region_code = 'US';
      for (const addr of locationData.body.results[0].address_components) {
        if (addr.types.includes('country')) {
          region_code = addr.short_name;
          break;
        }
      }
      const location = new Location(request.query.data, locationData.body.results[0].formatted_address, locationData.body.results[0].geometry.location.lat, locationData.body.results[0].geometry.location.lng,region_code);
      location.save().then(location => response.send(location));
    })
    .catch(getErrorHandler(response));
}

function handleYelpRoute(request, response) {
  console.log('Handle yelp');
  getLocation(request).then(location => {
    forRequest(request, response).selectFrom('yelps').where('location_id').are(location.id).then(
      () => onYelpMiss(location, response),
      onYelpHit
    );
  });
}

function onYelpMiss(location, response) {
  console.log('Yelp miss');
  superagent
    .get(`https://api.yelp.com/v3/businesses/search?latitude=${location.latitude}&longitude=${location.longitude}`)
    .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
    .then(yelpData => {
      const biddnesses = yelpData.body.businesses.map(biddness => new YelpLocation(location.id, biddness));
      biddnesses.forEach(biddness => biddness.save());
      response.send(biddnesses);
    });
}

function onYelpHit(results, request, response) {
  console.log('Yelp hit');
  if (Number(results.rows[0].created_at) + CACHE_MAX_AGE.YELPS < Date.now()) {
    console.log('Clearing yelp cache');
    deleteFrom('yelps').where('location_id').are(results.rows[0].location_id);
    getLocation(request).then(location => onYelpMiss(location, response));
  } else {
    response.send(results.rows);
  }
}

function handleMoviesRoute(request, response) {
  console.log('Handle movies');
  getLocation(request).then(location => {
    forRequest(request, response).selectFrom('movies').where('region_code').are(location.region_code).then(
      () => onMoviesMiss(location, response),
      onMoviesHit
    );
  });
}

function onMoviesMiss(location, response) {
  console.log('Movies miss');
  superagent
    .get(`https://api.themoviedb.org/3/discover/movie?api_key=${process.env.MOVIEDB_API_KEY}&region=${location.region_code}&page=1&sort_by=popularity.desc`)
    .then(movieData => {
      const movies = movieData.body.results.map(movieInfo => new Movie(location.region_code, movieInfo));
      movies.forEach(movie => movie.save());
      response.send(movies);
    })
    .catch(getErrorHandler(response));
}

function onMoviesHit(results, request, response) {
  console.log('Movies hit');
  if (Number(results.rows[0].created_at) + CACHE_MAX_AGE.MOVIES < Date.now()) {
    console.log('Clearing Movie cache...');
    deleteFrom('movies').where('region_code').are(results.rows[0].region_code);
    getLocation(request).then(location => onMoviesMiss(location, response));
  } else {
    response.send(results.rows);
  }
}

function handleEventsRoute(request, response) {
  console.log('Handle events');
  getLocation(request).then(location => {
    forRequest(request, response).selectFrom('events').where('location_id').are(location.id).then(
      () => onEventsMiss(location, response),
      onEventsHit
    );
  });
}

function onEventsMiss(location, response) {
  console.log('Events miss');
  superagent
    .get(`https://www.eventbriteapi.com/v3/events/search/?token=${process.env.EVENTBRITE_API_KEY}&location.latitude=${location.latitude}&location.longitude=${location.longitude}&location.within=10km`)
    .then(eventData => {
      const sliceIndex = eventData.body.events.length > 20 ? 20 : eventData.body.events.length;
      const events = eventData.body.events.slice(0, sliceIndex).map(event => new Event(location.id, event));
      events.forEach(event => event.save());
      response.send(events);
    })
    .catch(getErrorHandler(response));
}

function onEventsHit(results, request, response) {
  console.log('Events hit');
  if (Number(results.rows[0].created_at) + CACHE_MAX_AGE.EVENTS < Date.now()) {
    console.log('Clearing Events cache...');
    deleteFrom('events').where('location_id').are(results.rows[0].location_id);
    getLocationById(results.rows[0].location_id).then(location => onEventsMiss(location, response));
  } else {
    const events = results.rows.map(event => new Event(event.location_id, event));
    response.send(events);
  }
}

function handleWeatherRoute(request, response) {
  console.log('Handle weather');
  getLocation(request).then(location => {
    forRequest(request, response).selectFrom('weather').where('location_id').are(location.id).then(
      () => onWeatherMiss(location, response),
      onWeatherHit
    );
  });
}

function onWeatherMiss(location, response) {
  console.log('Weather miss');
  superagent
    .get(`https://api.darksky.net/forecast/${process.env.DARKSKY_API_KEY}/${location.latitude},${location.longitude}`)
    .then(weatherData => {
      const weather = weatherData.body.daily.data.map(day => new Weather(location.id, day));
      weather.forEach(day => day.save());
      response.send(weather);
    })
    .catch(getErrorHandler(response));
}

function onWeatherHit(results, request, response) {
  console.log('Weather hit');
  if (Number(results.rows[0].created_at) + CACHE_MAX_AGE.WEATHER < Date.now()) {
    console.log('Clearing Weather cache...');
    deleteFrom('weather').where('location_id').are(results.rows[0].location_id);
    getLocationById(results.rows[0].location_id).then(location => onWeatherMiss(location, response));
  } else {
    response.send(results.rows.map(day => {
      return new Weather(day.location_id, day);
    }));
  }
}
