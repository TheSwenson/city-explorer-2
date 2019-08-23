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


app.get('/location', getLocation);
app.get('/events', getEvents);
app.get('/weather', getWeather);
app.get('/yelps', getYelps);
app.get('/movies', getMovies);
function convertTime(timeInMilliseconds) {
  return new Date(timeInMilliseconds).toString().split(' ').slice(0, 4).join(' ');
};

function Location(query, geoData) {
  this.search_query = query;
  this.formatted_query = geoData.results[0].formatted_address;
  this.latitude = geoData.results[0].geometry.location.lat;
  this.longitude = geoData.results[0].geometry.location.lng;
};
Location.prototype.save = function(){
  const SQL = `INSERT INTO LOCATIONs (search_query, formatted_query, latitude, longitude) VALUES($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id;`;
  const VALUES = [this.search_query, this.formatted_query, this.latitude, this.longitude];

  client.query(SQL, VALUES).then(result => {
    this.id = result.rows[0].id;
    return this;
  })
};
function Weather(weatherData) {
  this.forecast = weatherData.summary || weatherData.forecast;
  this.time = isNaN(weatherData.time) ? weatherData.time : convertTime(weatherData.time * 1000);
};

function Event(eventData) {
  this.link = eventData.url || eventData.link;
  this.name = eventData.name.text ? eventData.name.text : eventData.name;
  this.event_date = eventData.start ? eventData.start.local : eventData.event_date;
  this.summary = eventData.description ? eventData.description.text : eventData.summary;
};

function lookupData(lookupHandler){
  const SQL = `SELECT * FROM ${lookupHandler.tableName} WHERE ${lookupHandler.column}=$1`
  const VALUES = [lookupHandler.query]

  client.query(SQL, VALUES).then(result => {
    if(result.rowCount === 0){
      lookupHandler.cacheMiss();
    } else {
      lookupHandler.cacheHit(result);
    }
  })

};
function getLocation(){
  lookupData({
    tableName: 'locations',
    column: 'search_query',
    query: req.query.data,

    cacheHit: function(result){
      res.send(reult.rows[0]);
    },

    cacheMiss: function(){
      const url =`https://maps.googleapis.com/maps/api/geocode/json?address=${this.query}&key=${process.env.GEOCODE_API_KEY}`;
    

      superagent.get(url)
        .then(geoData => {
          const location = new Location(this.query, geoData.body);
          location.save().then(location => res.send(location));
        })
    }
  })
};

function getWeather(){

};
function getEvents(){

};

function getYelps(){

};
function getMovies(){

};

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('I know that you came to party baby, baby, baby, baby');
});