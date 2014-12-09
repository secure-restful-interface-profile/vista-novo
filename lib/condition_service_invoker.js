var restler  = require('restler');
var mongoose = require('mongoose');
var _ = require('underscore');
var util = require('util');

var Condition = mongoose.model('Condition');
var ResourceHistory = mongoose.model('ResourceHistory');

//-------------------------------------------------------------------------------

exports.checkConditionCache = function(req, res, next, model) {
  if (model === 'condition') {
    if (typeof req.params.id !== "undefined") {
      checkCondition(req, res, next);
    } else {
      checkConditionList(req, res, next);
    }
  } else {
    next();
  }
}

//-------------------------------------------------------------------------------

checkCondition = function(req, res, next) {
  console.log("  ===== Entering checkCondition =====");

  var conditionId = req.params.id;
  var requestUrl = req.serviceConfig.conditions.url + "/" + conditionId + ".json";

  console.log("  ----- requestUrl = " + requestUrl + " -----");
  console.log("  ----- request headers = " + req.headers + " -----");
  console.log("  ----- authorization header = " + req.headers['authorization'] + " -----");
  
  restler.get(requestUrl, {headers: {'Authorization': req.headers['authorization']}}).once('complete', function(vistaCondition, response) {
    // console.log("  ----- response = " + util.inspect(response) + " -----");
    console.log("  ----- response.statusCode = " + response.statusCode + " -----");
    if (response.statusCode == 200) {
      lookupCondition(req, res, vistaCondition, conditionId);
      next();        
    } else {
      // return error from backend service
      res.send(response.statusCode);
    } 
  });
}

//-------------------------------------------------------------------------------

checkConditionList = function(req, res, next) {
  console.log("  ===== Entering checkConditionList =====");

  var requestUrl = req.serviceConfig.conditions.url + ".json";

  console.log("  ----- requestUrl = " + requestUrl + " -----");
  console.log("  ----- request headers = " + req.headers + " -----");
  console.log("  ----- authorization header = " + req.headers['authorization'] + " -----");

  restler.get(requestUrl, {headers: {'Authorization': req.headers['authorization']}}).once('complete', function(vistaConditions, response) {
    // console.log("  ----- response = " + util.inspect(response) + " -----");
    console.log("  ----- response.statusCode = " + response.statusCode + " -----");
    if (response.statusCode == 200) {
      vistaConditions.forEach(function(vistaCondition) {
        console.log("    ----- Condition -----");
        lookupCondition(req, res, vistaCondition, vistaCondition.id);
      });
      next();
    } else {
      // return error from backend service
      res.send(response.statusCode);
    }
  });
}

//-------------------------------------------------------------------------------

lookupCondition = function(req, res, vistaCondition, id) {
  console.log("      ===== Entering lookupCondition =====");

  ResourceHistory.findInCacheOrLocal(id, 'Condition', function(resourceHistory) {
    if (resourceHistory) {
      // we already have cached the resource in FHIR format, let's use it
      // in the future we can check to see if we need to refresh the cached copy
      console.log("      ----- Found condition in cache -----");
      req.resourceHistory = resourceHistory;
    } else {
      // Convert to FHIR and put the object in our cache
      console.log("      ----- Condition not already in cache... adding it -----");
      cacheFhirCondition(req, res, vistaCondition, id);
    }
  });
}

//-------------------------------------------------------------------------------

cacheFhirCondition = function(req, res, vistaCondition, id) {
  console.log("        ===== Entering cacheFhirCondition =====");

  // Translate returned information from EHR into FHIR
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
      console.log("        ----- err = " + err + " -----");
      res.send(500);
    } else {
      var newResourceHistory = new ResourceHistory({resourceType: 'Condition', 
                                                      vistaId: id});
      newResourceHistory.addVersion(savedCondition.id);
      newResourceHistory.save(function(rhError, savedResourceHistory) {
        req.resourceHistory = savedResourceHistory;
        console.log("        ----- Saving condition to cache -----");
      });
    }
  });
}
