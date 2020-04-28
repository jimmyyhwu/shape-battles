const express = require('express');
var mongodb = require("mongodb");
const app = express();
const PORT = process.env.PORT || 3000;
const LEADERBOARD_COLLECTION = 'leaderboard';
app.engine('html', require('ejs').renderFile);
app.use(express.static('public'));

var db;

mongodb.MongoClient.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/test", function (err, client) {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  // Save database object from the callback for reuse.
  db = client.db();
  console.log("Database connection ready");

  app.listen(PORT, (err) => {
    if (err) {
      return console.log('something bad happened', err)
    }
    console.log(`server is listening on ${PORT}`)
  })
});

app.get('/', (request, response) => {
  response.render('index.html')
})

app.use(express.json());

function getLeaderboard(res) {
  db.collection(LEADERBOARD_COLLECTION).find().sort({'score':-1}).limit(10).toArray(function(err, entries) {
    var leaderboard = [];
    for (var i = 0; i < entries.length; i++) {
      leaderboard.push({playerName: entries[i]['playerName'], score: entries[i]['score']});
    }
    res.status(200).json(leaderboard);
  });
}

app.get("/leaderboard", function(req, res) {
  getLeaderboard(res);
});

app.post("/leaderboard", function(req, res) {
  var entry = req.body;
  if (entry.score > 0) {
    db.collection(LEADERBOARD_COLLECTION).insertOne(entry, function(err, entry) {
      getLeaderboard(res);
    });
  }
});
