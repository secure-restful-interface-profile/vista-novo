var restler  = require('restler');
var mongoose = require('mongoose');
var _ = require('underscore');
var Condition = mongoose.model('Condition');
var ResourceHistory = mongoose.model('ResourceHistory');

exports.checkConditionCache = function(req, res, next, model) {
  console.log("===== Entering checkConditionCache =====");
  if (model === 'condition') {
    if (typeof req.params.id !== "undefined") {
      // ResourceHistory.findInCacheOrLocal(conditionId, 'Condition', function(resourceHistory) {
        // if (resourceHistory) {
        //   // we already have the resource, let's use it
        //   // in the future we can check to see if we need to refresh the cached copy
        //   req.resourceHistory = resourceHistory;
        //   next();
        // } else {
          // fetch from the backend service
          checkConditionObject(req, res, next);
        // }
      // });
    } else {
      checkConditionCollection(req, res, next);
    }
  } else {
    next();
  }
}

checkConditionObject = function(req, res, next) {
  var conditionId = req.params.id;
  var requestUrl = req.serviceConfig.conditions.url + "/" + conditionId + ".json";
  console.log("----- requestUrl = " + requestUrl + " -----");
  console.log("----- request headers = " + req.headers + " -----");
  console.log("----- authorization header = " + req.headers['authorization'] + " -----");
  
  restler.get(requestUrl, {headers: {'Authorization': req.headers['authorization']}}).once('complete', function(vistaCondition, response) {
    console.log("----- response.statusCode = " + response.statusCode + " -----");
    if (vistaCondition instanceof Error) {
      console.log("***** Error: " + vistaCondition.message + " *****");
      res.send(500);
    } else {
      if (response.statusCode == 200) {
        fhirizeCondition(req, res, vistaCondition, conditionId);
        next();        
      } else {
        // return error from backend service
        res.send(response.statusCode);
      } 
    }      
  });
}

checkConditionCollection = function(req, res, next) {
  var requestUrl = req.serviceConfig.conditions.url + ".json";
  console.log("----- requestUrl = " + requestUrl + " -----");
  console.log("----- request headers = " + req.headers + " -----");
  console.log("----- authorization header = " + req.headers['authorization'] + " -----");

  restler.get(requestUrl, {headers: {'Authorization': req.headers['authorization']}}).once('complete', function(vistaConditions, response) {
    console.log("----- response.statusCode = " + response.statusCode + " -----");
    if (vistaConditions instanceof Error) {
      console.log("***** Error: " + vistaConditions.message + " *****");
      res.send(500);
    } else {
      if (response.statusCode == 200) {
        vistaConditions.forEach(function(vistaCondition) {
          console.log("----- Condition -----");
          fhirizeCondition(req, res, vistaCondition, vistaCondition.id);
        });
        next();
      } else {
        // return error from backend service
        res.send(response.statusCode);
      }
    }
  });
}

fhirizeCondition = function(req, res, vistaCondition, id) {
  var novoCondition = new Condition();

  novoCondition.code.coding = [{system: vistaCondition.system, 
                                    code: vistaCondition.code,
                                    display: vistaCondition.code_text}];

  novoCondition.category = [{system: vistaCondition.category_system, 
                                    code: vistaCondition.category_code,
                                    display: vistaCondition.category_text}];

  novoCondition.status = vistaCondition.status;

  novoCondition.severity.coding = [{system: vistaCondition.severity_system, 
                                    code: vistaCondition.severity_code,
                                    display: vistaCondition.severity_text}];

  novoCondition.onsetDate = Date.parse(vistaCondition.onset_date);

  novoCondition.location = [{code: {coding: [{system: vistaCondition.location_system, 
                                    code: vistaCondition.location_code,
                                    display: vistaCondition.location_text}]},
                              detail: vistaCondition.location_detail}];

  // Store condition in cache
  novoCondition.save(function(err, savedCondition) { 
    if(err) {
      console.log("----- err = " + err + " -----");
      res.send(500);
    } else {
      var newResourceHistory = new ResourceHistory({resourceType: 'Condition', vistaId: id});
      newResourceHistory.addVersion(savedCondition.id);
      newResourceHistory.save(function(rhError, savedResourceHistory) {
        req.resourceHistory = savedResourceHistory;
      });
    }
  });
}
