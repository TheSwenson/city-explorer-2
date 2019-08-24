(() => {
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

  function handleLocationRoute(request, response) {
    forRequest(request, response).selectFrom('locations').where('search_query').are(request.query.data).then(
      onLocationMiss,
      onLocationHit
    );
  }

  function onLocationHit(results, request, response) {
    response.send(results.rows[0]);
  }

  function onLocationMiss(request, response) {
    superagent.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${request.query.data}&key=${process.env.GEOCODE_API_KEY}`)
      .then(locationData => {
        let region_code = 'US';
        for (const addr of locationData.body.results[0].address_components) {
          if (addr.types.includes('country')) {
            region_code = addr.short_name;
            break;
          }
        }
        const location = new Location(request.query.data, locationData.body.results[0].formatted_address, locationData.body.results[0].geometry.location.lat, locationData.body.results[0].geometry.location.lng, region_code);
        location.save().then(location => response.send(location));
      })
      .catch(getErrorHandler(response));
  }

  function handleYelpRoute(request, response) {
    forRequest(request, response).selectFrom('yelps').where('location_id').are(request.query.data.id).then(
      () => onYelpMiss(request.query.data, response),
      onYelpHit
    );
  }

  function onYelpMiss(location, response) {
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
    if (Number(results.rows[0].created_at) + CACHE_MAX_AGE.YELPS < Date.now()) {
      console.log('Clearing yelp cache');
      deleteFrom('yelps').where('location_id').are(results.rows[0].location_id).then(() => onYelpMiss(request.query.data, response));
    } else {
      response.send(results.rows);
    }
  }

  function handleMoviesRoute(request, response) {
    forRequest(request, response).selectFrom('movies').where('region_code').are(request.query.data.region_code).then(
      () => onMoviesMiss(request.query.data, response),
      onMoviesHit
    );
  }

  function onMoviesMiss(location, response) {
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
    if (Number(results.rows[0].created_at) + CACHE_MAX_AGE.MOVIES < Date.now()) {
      console.log('Clearing Movie cache...');
      deleteFrom('movies').where('region_code').are(results.rows[0].region_code).then(() => onMoviesMiss(request.query.data, response));
    } else {
      response.send(results.rows);
    }
  }

  function handleEventsRoute(request, response) {
    forRequest(request, response).selectFrom('events').where('location_id').are(request.query.data.id).then(
      () => onEventsMiss(request.query.data, response),
      onEventsHit
    );
  }

  function onEventsMiss(location, response) {
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
    if (Number(results.rows[0].created_at) + CACHE_MAX_AGE.EVENTS < Date.now()) {
      console.log('Clearing Events cache...');
      deleteFrom('events').where('location_id').are(results.rows[0].location_id).then(() => onEventsMiss(request.query.data, response));
    } else {
      response.send(results.rows);
    }
  }

  function handleWeatherRoute(request, response) {
    forRequest(request, response).selectFrom('weather').where('location_id').are(request.query.data.id).then(
      () => onWeatherMiss(request.query.data, response),
      onWeatherHit
    );
  }

  function onWeatherMiss(location, response) {
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
    if (Number(results.rows[0].created_at) + CACHE_MAX_AGE.WEATHER < Date.now()) {
      console.log('Clearing Weather cache...');
      deleteFrom('weather').where('location_id').are(results.rows[0].location_id).then(() => onWeatherMiss(request.query.data, response));
    } else {
      response.send(results.rows);
    }
  }

  function Location(query, formatted, lat, long, region_code) {
    this.search_query = query;
    this.formatted_query = formatted;
    this.latitude = lat;
    this.longitude = long;
    this.region_code = region_code;
  }

  Location.prototype.save = function () {
    return insertInto('locations', this, 'RETURNING id', result => {
      this.id = result.rows[0].id;
      return this;
    });
  };

  function Weather(locationId, weatherData) {
    this.location_id = locationId;
    this.forecast = weatherData.summary || weatherData.forecast;
    this.time = isNaN(weatherData.time) ? weatherData.time : convertTime(weatherData.time * 1000);
  }

  Weather.prototype.save = function () {
    insertInto('weather', this);
  };

  function Event(locationId, eventData) {
    this.location_id = locationId;
    this.link = eventData.url || eventData.link;
    this.name = eventData.name.text ? eventData.name.text : eventData.name;
    this.event_date = eventData.start ? eventData.start.local : eventData.event_date;
    this.summary = eventData.description ? eventData.description.text : eventData.summary;
  }

  Event.prototype.save = function () {
    insertInto('events', this);
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
    insertInto('movies', this);
  };

  function YelpLocation(locationId, yelpData) {
    this.location_id = locationId;
    this.name = yelpData.name;
    this.image_url = yelpData.image_url;
    this.price = yelpData.price;
    this.rating = yelpData.rating;
    this.url = yelpData.url;
  }

  YelpLocation.prototype.save = function () {
    insertInto('yelps', this);
  };



  function convertTime(timeInMilliseconds) {
    return new Date(timeInMilliseconds).toString().split(' ').slice(0, 4).join(' ');
  }

  function handleError(error, response) {
    response.status(error.status || 500).send(error.message);
  }

  function getErrorHandler(response) {
    return (error) => handleError(error, response);
  }

  const insertInto = (table, object, extra, onResults) => {
    const columns = [...Object.keys(object), 'created_at'];
    const values = [...Object.values(object), Date.now()];
    let valueReplacer = '$1';
    for (let i = 1; i < values.length; i++) {
      valueReplacer += `, $${i + 1}`;
    }
    let sql = `INSERT INTO ${table} (${columns}) VALUES(${valueReplacer}) ON CONFLICT DO NOTHING`;
    if (extra) {
      sql += ` ${extra}`;
    }
    sql += ';';
    console.log(sql);
    if (onResults) {
      return client.query(sql, values).then(onResults);
    }
    client.query(sql, values).catch(error => {
      console.log(`We seem to have encountered a bug: ${error}`);
      console.log(values);
    });
  };

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
          const pending = client.query(sql, values).catch(error => {
            console.log(`We seem to have encountered a bug: ${error}`);
            console.log(values);
          });
          return {
            then: function (onMiss, onHit) {
              pending.then(recieved => {
                if (recieved.rows.length === 0) {
                  onMiss(request, response);
                } else {
                  onHit(recieved, request, response);
                }
              });
            }
          };
        }
      }),
    }),
  });
})();
