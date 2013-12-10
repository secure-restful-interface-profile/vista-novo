var mongoose = require('mongoose');
var _ = require('underscore');
var fs = require('fs');
var eco = require('eco');
var async = require('async');
var ValueSet = mongoose.model('ValueSet');
var ResourceHistory = mongoose.model('ResourceHistory');
var ResponseFormatHelper = require(__dirname + '/../../lib/response_format_helper');

exports.load = function(req, res, id, vid, next) {
  if (req.resourceHistory) {
    req.resourceHistory.findLatest(function(err, valueset) {
      req.valueset = valueset;
      next(valueset);
    });
  } else {
    ResourceHistory.findOne(id, function(rhErr, resourceHistory) {
      if (rhErr) {
        next(rhErr);
      }
      if(resourceHistory !== null) {
        req.resourceHistory = resourceHistory;
        req.resourceHistory.findLatest(function(err, valueset) {
          req.valueset = valueset;
          next(valueset);
        });
      }
    });
  }
};

exports.show = function(req, res) {
  var valueset = req.valueset;
  var json = JSON.stringify(valueset);
  res.send(json);
};

exports.create = function(req, res) {
  var valueset = new ValueSet(req.body);
  valueset.save(function(err, savedValueSet) {
    if(err) {
      res.send(500);
    } else {
      var resourceHistory = new ResourceHistory({resourceType: 'ValueSet'});
      resourceHistory.addVersion(savedValueSet.id);
      resourceHistory.save(function(rhErr, savedResourceHistory){
        if (rhErr) {
          res.send(500);
        } else {
          res.set('Location', ("http://localhost:3000/valueset/@" + resourceHistory.id));
          res.send(201);
        }
      });
    }
  });
};

exports.update = function(req, res) {
  var valueset = req.valueset;
  valueset = _.extend(valueset, req.body);
  valueset.save(function(err, savedvalueset) {
    if(err) {
      res.send(500);
    } else {
      var resourceHistory = req.resourceHistory;
      resourceHistory.addVersion(savedvalueset);
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
  var valueset = req.valueset;
  valueset.remove(function (err) {
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

  ResourceHistory.find({resourceType:"ValueSet"}, function (rhErr, histories) {
    if (rhErr) {
      return next(rhErr);
    }
    if (histories !== null) {
      async.forEach(histories, function(history, callback) {
        history.findLatest( function(err, valueset) {
          models.push(valueset);
          callback();
        });
      }, function(err) {
          console.log(models);
          res.send(eco.render(template, models));
      });
    } else {
      console.log('no valueset found');
      res.send(500);
    }
  });
};