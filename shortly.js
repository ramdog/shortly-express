/* globals require, __dirname */
var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var Promise = require('bluebird');
var bcrypt = Promise.promisifyAll(require('bcrypt-nodejs'));

var db = require('./app/config');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(partials());
  app.use(express.json());
  app.use(express.cookieParser());
  app.use(express.session({
    secret: 'usesinglequotes',
    key: 'sid',
    cookie: {
      maxAge: 600000
    }
  }));
  app.use(express.urlencoded());
  app.use(express.static(__dirname + '/public'));
});

var restrict  = function (req, res, next) {
  if (req.session.username) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
};

app.get('/', restrict, function(req, res) {
  res.render('index');
});

app.get('/create', restrict, function(req, res) {
  res.render('index');
});

app.get('/links', function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', restrict, function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        db.knex('users')
          .where('username', '=', req.session.username)
          .then(function(user) {
            console.log(user);
            var link = new Link({
              url: uri,
              title: title,
              base_url: req.headers.origin,
              user_id: user[0].id
            });

            link.save().then(function(newLink) {
              Links.add(newLink);
              res.send(200, newLink);
            });
          });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.get('/login', function(req, res) {
  res.render('login');
});

app.post('/login', function(req, res) {
  new User({
    username: req.body.username
  }).fetch().then(function(found) {
    if(found) {

      bcrypt.compareAsync(req.body.password, found.get('password'))
        .then(function(same){
          if (same) {
            req.session.username = found.get('username');
            res.redirect('/');
          } else {
            res.redirect('/login');
          }
        });

    } else {
      // user not found
      res.redirect('/login');
    }

  });
});

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.post('/signup', function(req, res){
  new User({
    username: req.body.username
  }).fetch().then(function(found) {
    if(found) {
      res.redirect('/login');
    } else {

      var user = new User({
        username: req.body.username,
        password: req.body.password
      });

      user.hashStore().then(function () {
        req.session.username = user.get('username');
        res.redirect('/');
      });

    }
  });
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
