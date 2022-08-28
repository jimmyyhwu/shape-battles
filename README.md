# shape-battles

Course project for [Princeton COS 426: Computer Graphics, Spring 2019](https://www.cs.princeton.edu/courses/archive/spring19/cos426/)

Authors: Derek Sawicki, Hector Solis, Jimmy Wu

Live demo: https://shape-battles.onrender.com

<img src="images/gameplay.gif" width="640">

## Running Locally

```bash
brew install mongodb
npm install
mkdir -p data/db
mongod --dbpath=data/db
node server
```

## Deploying to Heroku

```bash
heroku create
heroku addons:create mongolab
heroku open
```

## Database Management

```bash
mongo
db.leaderboard.find({playerName: 'spammer'})
db.leaderboard.remove({playerName: 'spammer'})
```

## Heroku Database Management

```bash
heroku addons:open mongolab
```
