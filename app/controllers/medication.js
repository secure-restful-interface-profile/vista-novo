var mongoose = require('mongoose');
var _ = require('underscore');
var fs = require('fs');
var eco = require('eco');
var async = require('async');
var Medication = mongoose.model('Medication');
var ResourceHistory = mongoose.model('ResourceHistory');
var ResponseFormatHelper = require(__dirname + '/../../lib/response_format_helper');

exports.load = function(req, res, id, vid, next) {
  if (req.resourceHistory) {
    if(vid !== null){
      req.resourceHistory.getVersion(vid, function(err, medication) {
        req.medication = medication;
        next(medication);
      });
    } else {
      req.resourceHistory.findLatest(function(err, medication) {
        req.medication = medication;
        next(medication);
      });
    }
  } else {
    ResourceHistory.findOne(id, function(rhErr, resourceHistory) {
      if (rhErr) {
        next(rhErr);
      }
      if(resourceHistory !== null) {
        req.resourceHistory = resourceHistory;
        req.resourceHistory.findLatest(function(err, medication) {
          req.medication = medication;
          next(medication);
        });
      }
    });
  }
};

exports.show = function(req, res) {
  var medication = req.medication;
  var json = JSON.stringify(medication);
  res.send(json);
};

exports.create = function(req, res) {
  var medication = new Medication(req.body);
  medication.save(function(err, savedMedication) {
    if(err) {
      res.send(500);
    } else {
      var resourceHistory = new ResourceHistory({resourceType: 'Medication'});
      resourceHistory.addVersion(savedMedication.id);
      resourceHistory.save(function(rhErr, savedResourceHistory){
        if (rhErr) {
          res.send(500);
        } else {
          res.set('Location', ("http://localhost:3000/medication/@" + resourceHistory.id));
          res.send(201);
        }
      });
    }
  });
};

exports.update = function(req, res) {
  var medication = req.medication;
  medication = _.extend(medication, req.body);
  medication.save(function(err, savedmedication) {
    if(err) {
      res.send(500);
    } else {
      var resourceHistory = req.resourceHistory;
      resourceHistory.addVersion(savedmedication);
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
  var medication = req.medication;
  medication.remove(function (err) {
    if(err) {
      res.send(500);
    } else {
      res.send(204);
    }
  });
};

exports.list = function(req, res) {

  var content = {
    title: "Search results for resource type Medication",
    id: "http://localhost:3000/medication",
    totalResults: 0,
    link: {
      href: "http://localhost:3000/medication",
      rel: "self"
    },
    updated: new Date(Date.now()),
    entry: []
  };

  ResourceHistory.find({resourceType:"Medication"}, function (rhErr, histories) {
    if (rhErr) {
      return next(rhErr);
    }
    var counter = 0;
    async.forEach(histories, function(history, callback) {
      counter++;
      content.totalResults = counter;
      history.findLatest( function(err, medication) {
        var entrywrapper = {
          title: "Medication " + history.vistaId + " Version " + history.versionCount(),
          id: "http://localhost:3000/medication/@" + history.vistaId,
          link: {
            href: "http://localhost:3000/medication/@" + history.vistaId + "/history/@" + history.versionCount(),
            rel: "self"
          },
          updated: history.lastUpdatedAt(),
          published: new Date(Date.now()),
          content: medication
        };
        content.entry.push(entrywrapper);
        callback();
      });
    }, function(err) {
        res.send(JSON.stringify(content));
    });
  });
};