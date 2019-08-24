# City-Explorer

**Author**: Jon Schwamman, Jacob Swenson, James Zobian, Calvin Hall, Steven Jones
**Version**: 2.0.0

## Overview
This app retrieves information about events, bussinesses, hiking trails, movies and weather for a given location, and sends it to the client. 

## Getting Started
Simply clone the repository, and then in the root, call "npm install". After that is finished, you'll need to make a .env with all your API keys, a port, and a database URL. One final step is to call "psql -d <db-name> -f schema.sql", which will set up your database with the required tables.

You should now be ready to run the program, with "node server.js", "npm run watch", or even "nodemon server.js".

If you want to deploy to heroku or something, the steps are pretty similar, just using heroku instead of your local machine.

## Architecture
This app uses:
  NodeJS
  PostgreSQL
  Heroku (for deploy)
  superagent (for querying other APIs)
  express (for handling HTTP requests)

## Change Log

08-19-2019 4:30pm - Application now has a fully-functional express server, with a GET route for the location resource.

08-20-2019 11:25am - Added constructor function and GET route for the weather resource.

08-21-2019 12:00am - Added GET route for events resource

08-22-2019 1:00pm - Set up PostgreSQL database, minor refactoring..

08-23-2019 12:00am - Refactored parts of the code, added GET route for movies, yelp, and trails.

## Credits and Collaborations
Jon Schwamman - https://github.com/schwamman
Jacob Swenson - https://github.com/TheSwenson
James Zobian  - https://github.com/Zscoob
Calvin Hall   - https://github.com/Clownvin
Steven Jones  - https://github.com/ColoSRJones

Number and name of feature: 3. Weather

Estimate of time needed to complete: 3 hours

Start time: 9:15 am

Finish time: 11:25 pm

Actual time needed to complete: 2:10 hr:min


Number and name of feature: 4? Events

Estimate of time needed to complete: 3 hours

Start time: 9:30am

Finish time: 12:00am

Actual time needed to complete: You do the math...


Number and name of feature: 5. PostgreSQL setup

Estimate of time needed to complete: 3 hours or less.

Start time: 9:00am

Finish time: 11:00am

Actual time needed to complete: You do the math...


Number and name of feature: 6. Movies

Estimate of time needed to complete: 1 hours or less.

Start time: 9:00am

Finish time: 1:00pm

Actual time needed to complete: A lot longer than 1 hour. It became more difficult when I found there was no way to use long/lat for the location, which meant I had to start tracking the locations region codes.


Number and name of feature: 7. Yelp

Estimate of time needed to complete: 1 hours or less.

Start time: 1:00pm

Finish time: 2:00pm

Actual time needed to complete: You do the math...


Number and name of feature: 8. Trails

Estimate of time needed to complete: 1 hours or less.

Start time: 2:00pm

Finish time: 3:00pm

Actual time needed to complete: You do the math...
