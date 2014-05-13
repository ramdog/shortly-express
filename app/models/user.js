var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');
var Link = require('./link');

var promiseHash = Promise.promisify(bcrypt.hash);
var promiseSalt = Promise.promisify(bcrypt.genSalt);

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,

  links: function() {
    return this.hasMany(Link);
  },

  hashStore: function() {
    return promiseHash(this.get('password'), null, null)
      .then(function(hash) {
        this.set('password', hash);
        return this.save();
      }.bind(this));
  }

});

module.exports = User;
