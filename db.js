/**
 * Created by Sonicdeadlock on 7/21/2015.
 */
var config = require('./config');
var mongoose = require('mongoose');
require('mongoose-cache').install(mongoose, {max: 500, maxAge: 1000 * 60 * 2, debug: true});
mongoose.Promise = global.Promise;
module.exports = mongoose.connect('mongodb://' + config.db.host + '/' + config.db.name)
    .connection
    .on('error', function (err) {
        console.log(err);
    })
    .once('open', function (callback) {
        console.log('mongodb:', config.db.host + config.db.name);

        if (callback) {
            callback();
        }
    });