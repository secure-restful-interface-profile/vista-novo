var mongoose = require('mongoose');
var _ = require('underscore');
var fs = require('fs');
var eco = require('eco');
var async = require('async');
var Other = mongoose.model('Other');
var ResourceHistory = mongoose.model('ResourceHistory');
var ResponseFormatHelper = require(__dirname + '/../../lib/response_format_helper');

exports.load = function(req, res, id, vid, next) {
  if (req.resourceHistory) {
    req.resourceHistory.findLatest(function(err, other) {
      req.other = other;
      next(other);
    });
  } else {
    ResourceHistory.findOne(id, function(rhErr, resourceHistory) {
      if (rhErr) {
        next(rhErr);
      }
      if(resourceHistory !== null) {
        req.resourceHistory = resourceHistory;
        req.resourceHistory.findLatest(function(err, other) {
          req.other = other;
          next(other);
        });
      }
    });
  }
};

exports.show = function(req, res) {
  var other = req.other;
  var json = JSON.stringify(other);
  res.send(json);
};

exports.create = function(req, res) {
  var other = new Other(req.body);
  other.save(function(err, savedOther) {
    if(err) {
      res.send(500);
    } else {
      var resourceHistory = new ResourceHistory({resourceType: 'Other'});
      resourceHistory.addVersion(savedOther.id);
      resourceHistory.save(function(rhErr, savedResourceHistory){
        if (rhErr) {
          res.send(500);
        } else {
          res.set('Location', ("http://localhost:3000/other/@" + resourceHistory.id));
          res.send(201);
        }
      });
    }
  });
};

exports.update = function(req, res) {
  var other = req.other;
  other = _.extend(other, req.body);
  other.save(function(err, savedother) {
    if(err) {
      res.send(500);
    } else {
      var resourceHistory = req.resourceHistory;
      resourceHistory.addVersion(savedother);
      resourceHistory.save(function(rhErr, savedResourceHistory) {
        if (rhErr) {
          res.send(500);
        } else {
          res.send(200);
        }
      });
    }
  });
};

exports.destroy = function(req, res) {
  var other = req.other;
  other.remove(function (err) {
    if(err) {
      res.send(500);
    } else {
      res.send(204);
    }
  });
};

exports.list = function(req, res) {
  var models = [];
  var template = fs.readFileSync(__dirname + "/../views/atom.xml.eco", "utf-8");

  ResourceHistory.find({resourceType:"Other"}, function (rhErr, histories) {
    if (rhErr) {
      return next(rhErr);
    }
    if (histories !== null) {
      async.forEach(histories, function(history, callback) {
        history.findLatest( function(err, other) {
          models.push(other);
          callback();
        });
      }, function(err) {
          console.log(models);
          res.send(eco.render(template, models));
      });
    } else {
      console.log('no other found');
      res.send(500);
    }
  });
};