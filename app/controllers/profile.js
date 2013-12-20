var mongoose = require('mongoose');
var _ = require('underscore');
var fs = require('fs');
var eco = require('eco');
var async = require('async');
var Profile = mongoose.model('Profile');
var ResourceHistory = mongoose.model('ResourceHistory');
var ResponseFormatHelper = require(__dirname + '/../../lib/response_format_helper');

exports.load = function(req, res, id, vid, next) {
  if (req.resourceHistory) {
    if(vid !== null){
      req.resourceHistory.getVersion(vid, function(err, profile) {
        req.profile = profile;
        next(profile);
      });
    } else {
      req.resourceHistory.findLatest(function(err, profile) {
        req.profile = profile;
        next(profile);
      });
    }
  } else {
    ResourceHistory.findOne(id, function(rhErr, resourceHistory) {
      if (rhErr) {
        next(rhErr);
      }
      if(resourceHistory !== null) {
        req.resourceHistory = resourceHistory;
        req.resourceHistory.findLatest(function(err, profile) {
          req.profile = profile;
          next(profile);
        });
      }
    });
  }
};

exports.show = function(req, res) {
  var profile = req.profile;
  var json = JSON.stringify(profile);
  res.send(json);
};

exports.create = function(req, res) {
  var profile = new Profile(req.body);
  profile.save(function(err, savedProfile) {
    if(err) {
      res.send(500);
    } else {
      var resourceHistory = new ResourceHistory({resourceType: 'Profile'});
      resourceHistory.addVersion(savedProfile.id);
      resourceHistory.save(function(rhErr, savedResourceHistory){
        if (rhErr) {
          res.send(500);
        } else {
          res.set('Location', ("http://localhost:3000/profile/@" + resourceHistory.id));
          res.send(201);
        }
      });
    }
  });
};

exports.update = function(req, res) {
  var profile = req.profile;
  profile = _.extend(profile, req.body);
  profile.save(function(err, savedprofile) {
    if(err) {
      res.send(500);
    } else {
      var resourceHistory = req.resourceHistory;
      resourceHistory.addVersion(savedprofile);
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
  var profile = req.profile;
  profile.remove(function (err) {
    if(err) {
      res.send(500);
    } else {
      res.send(204);
    }
  });
};

exports.list = function(req, res) {

  var content = {
    title: "Search results for resource type Profile",
    id: "http://localhost:3000/profile",
    totalResults: 0,
    link: {
      href: "http://localhost:3000/profile",
      rel: "self"
    },
    updated: new Date(Date.now()),
    entry: []
  };

  ResourceHistory.find({resourceType:"Profile"}, function (rhErr, histories) {
    if (rhErr) {
      return next(rhErr);
    }
      var counter = 0;
      async.forEach(histories, function(history, callback) {
        counter++;
        content.totalResults = counter;
        history.findLatest( function(err, profile) {
          var entrywrapper = {
            title: "Profile " + history.vistaId + " Version " + history.versionCount(),
            id: "http://localhost:3000/profile/@" + history.vistaId,
            link: {
              href: "http://localhost:3000/profile/@" + history.vistaId + "/history/@" + history.versionCount(),
              rel: "self"
            },
            updated: history.lastUpdatedAt(),
            published: new Date(Date.now()),
            content: profile
          };
          content.entry.push(entrywrapper);
          callback();
        });
      }, function(err) {
          res.send(JSON.stringify(content));
      });
    } else {
      console.log('no profile found');
      res.send(500);
    }
  });
};