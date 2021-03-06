var mongoose = require('mongoose');
var _ = require('underscore');
var fs = require('fs');
var eco = require('eco');
var async = require('async');
var Immunization = mongoose.model('Immunization');
var ResourceHistory = mongoose.model('ResourceHistory');
var ResponseFormatHelper = require(__dirname + '/../../lib/response_format_helper');

exports.load = function(req, res, id, vid, next) {
  if (req.resourceHistory) {
    if(vid !== null){
      req.resourceHistory.getVersion(vid, function(err, immunization) {
        req.immunization = immunization;
        next(immunization);
      });
    } else {
      req.resourceHistory.findLatest(function(err, immunization) {
        req.immunization = immunization;
        next(immunization);
      });
    }
  } else {
    ResourceHistory.findOne(id, function(rhErr, resourceHistory) {
      if (rhErr) {
        next(rhErr);
      }
      if(resourceHistory !== null) {
        req.resourceHistory = resourceHistory;
        req.resourceHistory.findLatest(function(err, immunization) {
          req.immunization = immunization;
          next(immunization);
        });
      }
    });
  }
};

exports.show = function(req, res) {
  var immunization = req.immunization;
  var json = JSON.stringify(immunization);
  res.send(json);
};

exports.create = function(req, res) {
  var immunization = new Immunization(req.body);
  immunization.save(function(err, savedImmunization) {
    if(err) {
      res.send(500);
    } else {
      var resourceHistory = new ResourceHistory({resourceType: 'Immunization'});
      resourceHistory.addVersion(savedImmunization.id);
      resourceHistory.save(function(rhErr, savedResourceHistory){
        if (rhErr) {
          res.send(500);
        } else {
          res.set('Location', ("http://localhost:3000/immunization/@" + resourceHistory.id));
          res.send(201);
        }
      });
    }
  });
};

exports.update = function(req, res) {
  var immunization = req.immunization;
  immunization = _.extend(immunization, req.body);
  immunization.save(function(err, savedimmunization) {
    if(err) {
      res.send(500);
    } else {
      var resourceHistory = req.resourceHistory;
      resourceHistory.addVersion(savedimmunization);
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
  var immunization = req.immunization;
  immunization.remove(function (err) {
    if(err) {
      res.send(500);
    } else {
      res.send(204);
    }
  });
};

exports.list = function(req, res) {

  var content = {
    title: "Search results for resource type Immunization",
    id: "http://localhost:3000/immunization",
    totalResults: 0,
    link: {
      href: "http://localhost:3000/immunization",
      rel: "self"
    },
    updated: new Date(Date.now()),
    entry: []
  };

  ResourceHistory.find({resourceType:"Immunization"}, function (rhErr, histories) {
    if (rhErr) {
      return next(rhErr);
    }
    var counter = 0;
    async.forEach(histories, function(history, callback) {
      counter++;
      content.totalResults = counter;
      history.findLatest( function(err, immunization) {
        var entrywrapper = {
          title: "Immunization " + history.vistaId + " Version " + history.versionCount(),
          id: "http://localhost:3000/immunization/@" + history.vistaId,
          link: {
            href: "http://localhost:3000/immunization/@" + history.vistaId + "/history/@" + history.versionCount(),
            rel: "self"
          },
          updated: history.lastUpdatedAt(),
          published: new Date(Date.now()),
          content: immunization
        };
        content.entry.push(entrywrapper);
        callback();
      });
    }, function(err) {
        res.send(JSON.stringify(content));
    });
  });
};