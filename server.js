// imports

var fs = require('fs'),
    https = require('https'),
    path = require('path'),
    _ = require('underscore'),
    sio = require('socket.io'),
    express = require('express'),
    bodyParser = require('body-parser'),
    methodOverride = require('method-override'),
    errorhandler = require('errorhandler'),
    http = require('http'),
    wikichanges = require('wikichanges');

// get the configuration

var configPath = path.join(__dirname, "config.json");
var config = JSON.parse(fs.readFileSync(configPath));
var app = module.exports = express();
var requestCount = 0;

// get the wikipedia shortnames sorted by their longname

var wikisSorted = [];
for (var chan in wikichanges.wikipedias) wikisSorted.push(chan);
wikisSorted.sort(function (a, b) {
  w1 = wikichanges.wikipedias[a].long;
  w2 = wikichanges.wikipedias[b].long;
  if (w1 == w2) return 0;
  else if (w1 < w2) return -1;
  else if (w1 > w2) return 1;
});

// set up the web app
app.set('views', __dirname + '/views');
app.set('view engine', 'pug');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(methodOverride('X-HTTP-Method-Override'));

app.use(errorhandler());
app.use(express.static(__dirname + '/public', {maxAge: 60*15*1000}));

app.get('/', function (req, res){
  res.render('index', {
    title: 'wikistream',
    wikis: wikichanges.wikipedias,
    wikisSorted: wikisSorted,
    stream: true
  });
});

app.get('/commons-image/:page', function (req, res){
  var path = "/w/api.php?action=query&titles=" +
             encodeURIComponent(req.params.page) +
             "&prop=imageinfo&iiprop=url|size|comment|user&format=json";
  var opts = {
    headers: {'User-Agent': 'wikistream'},
    host: 'commons.wikimedia.org',
    path: path
  };
  https.get(opts, function (response) {
    response.on('data', function (chunk) {
      res.write(chunk);
    });
    response.on('end', function () {
      res.end();
    });
  });
});

app.get('/about/', function (req, res){
  res.render('about', {
    title: 'about wikistream',
    stream: false,
    trends: false
  });
});

//app.listen(config.port);
// set up socket.io to stream the irc updates
var server = http.createServer(app);
var io = new sio(server);
server.listen(config.port);

var changes = new wikichanges.WikiChanges({ircNickname: config.ircNickname});
changes.listen(function(message) {
  io.sockets.emit('message', message);
});
