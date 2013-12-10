var mongoose = require('mongoose');
var _ = require('underscore');
var fs = require('fs');
var eco = require('eco');
var async = require('async');
var Device = mongoose.model('Device');
var ResourceHistory = mongoose.model('ResourceHistory');
var ResponseFormatHelper = require(__dirname + '/../../lib/response_format_helper');

exports.load = function(req, res, id, vid, next) {
  if (req.resourceHistory) {
    req.resourceHistory.findLatest(function(err, device) {
      req.device = device;
      next(device);
    });
  } else {
    ResourceHistory.findOne(id, function(rhErr, resourceHistory) {
      if (rhErr) {
        next(rhErr);
      }
      if(resourceHistory !== null) {
        req.resourceHistory = resourceHistory;
        req.resourceHistory.findLatest(function(err, device) {
          req.device = device;
          next(device);
        });
      }
    });
  }
};

exports.show = function(req, res) {
  var device = req.device;
  var json = JSON.stringify(device);
  res.send(json);
};

exports.create = function(req, res) {
  var device = new Device(req.body);
  device.save(function(err, savedDevice) {
    if(err) {
      res.send(500);
    } else {
      var resourceHistory = new ResourceHistory({resourceType: 'Device'});
      resourceHistory.addVersion(savedDevice.id);
      resourceHistory.save(function(rhErr, savedResourceHistory){
        if (rhErr) {
          res.send(500);
        } else {
          res.set('Location', ("http://localhost:3000/device/@" + resourceHistory.id));
          res.send(201);
        }
      });
    }
  });
};

exports.update = function(req, res) {
  var device = req.device;
  device = _.extend(device, req.body);
  device.save(function(err, saveddevice) {
    if(err) {
      res.send(500);
    } else {
      var resourceHistory = req.resourceHistory;
      resourceHistory.addVersion(saveddevice);
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
  var device = req.device;
  device.remove(function (err) {
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

  ResourceHistory.find({resourceType:"Device"}, function (rhErr, histories) {
    if (rhErr) {
      return next(rhErr);
    }
    if (histories !== null) {
      async.forEach(histories, function(history, callback) {
        history.findLatest( function(err, device) {
          models.push(device);
          callback();
        });
      }, function(err) {
          console.log(models);
          res.send(eco.render(template, models));
      });
    } else {
      console.log('no device found');
      res.send(500);
    }
  });
};