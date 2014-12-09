var restler  = require('restler');
var mongoose = require('mongoose');
var _ = require('underscore');
var util = require('util');

var Observation = mongoose.model('Observation');
var ResourceHistory = mongoose.model('ResourceHistory');

//-------------------------------------------------------------------------------

exports.checkObservationCache = function(req, res, next, model) {
  if (model === 'observation') {
    if (typeof req.params.id !== "undefined") {
      checkObservation(req, res, next);
    } else {
      checkObservationList(req, res, next);
    }
  } else {
    next();
  }
}

//-------------------------------------------------------------------------------

exports.checkObservation = function(req, res, next) {
  console.log("  ===== Entering checkObservation =====");

  var observationId = req.params.id;
  var requestUrl = req.serviceConfig.observations.url + "/" + observationId + ".json";

  console.log("  ----- requestUrl = " + requestUrl + " -----");
  console.log("  ----- request headers = " + req.headers + " -----");
  console.log("  ----- authorization header = " + req.headers['authorization'] + " -----");

  restler.get(requestUrl, {headers: {'Authorization': req.header['authorization']}}).once('complete', function(vistaObservation, response) {
    // console.log("  ----- response = " + util.inspect(response) + " -----");
    console.log("  ----- response.statusCode = " + response.statusCode + " -----");
    if (response.statusCode == 200) {
      lookupObservation(req, res, vistaObservation, observationId);
      next();        
    } else {
      // return error from backend service
      res.send(response.statusCode);
    }
  });
}

//-------------------------------------------------------------------------------

exports.checkObservationList = function(req, res, next) {
  console.log("  ===== Entering checkObservationList =====");

  var requestUrl = req.serviceConfig.observations.url + ".json";

  console.log("  ----- requestUrl = " + requestUrl + " -----");
  console.log("  ----- request headers = " + req.headers + " -----");
  console.log("  ----- authorization header = " + req.headers['authorization'] + " -----");
  
  restler.get(requestUrl, {headers: {'Authorization': req.header['authorization']}}).once('complete', function(vistaObservations, response) {
    // console.log("  ----- response = " + util.inspect(response) + " -----");
    console.log("  ----- response.statusCode = " + response.statusCode + " -----");
    if (response.statusCode == 200) {
      vistaObservations.forEach(function(vistaObservation) {
        console.log("    ----- Observation -----");
        lookupObservation(req, res, vistaObservation, vistaObservation.id);
      });
      next();
    } else {
      // return error from backend service
      res.send(response.statusCode);
    }
  });
}

//-------------------------------------------------------------------------------

exports.lookupObservation = function(req, res, vistaObservation, id) {
  console.log("      ===== Entering lookupObservation =====");

  ResourceHistory.findInCacheOrLocal(id, 'Observation', function(resourceHistory) {
    if (resourceHistory) {
      // we already have cached the resource in FHIR format, let's use it
      // in the future we can check to see if we need to refresh the cached copy
      console.log("      ----- Found observation in cache -----");
      req.resourceHistory = resourceHistory;
    } else {
      // Convert to FHIR and put the object in our cache
      console.log("      ----- Observation not already in cache... adding it -----");
      cacheFhirObservation(req, res, vistaObservation, id);
    }
  });
}

//-------------------------------------------------------------------------------

exports.cacheFhirObservation = function(req, res, vistaObservation, id) {
  console.log("        ===== Entering cacheFhirObservation =====");

  // Translate returned information from EHR into FHIR
  var novoObservation = new Observation();
  var bpReading = vistaObservation.value.split('/');
  
  novoObservation.name.coding = [{system: "http://loinc.org", code: vistaObservation.name}];

  novoObservation.component = [{name: {coding: [{system: "http://loinc.org", code: "8480-6"}]}, valueQuantity: {"value": bpReading[0], units: "mm[Hg]"}}, 
                               {name: {coding: [{system: "http://loinc.org", code: "8462-4"}]}, valueQuantity: {"value": bpReading[1], units: "mm[Hg]"}}];
  
  novoObservation.appliesDateTime = Date.parse(vistaObservation.issued)

  // Store observation in cache
  novoObservation.save(function(err, savedObservation) {          
    if(err) {
      console.log("        ----- err = " + err + " -----");
      res.send(500);
    } else {
      var newResourceHistory = new ResourceHistory({resourceType: 'Observation', 
                                                      vistaId: id});
      newResourceHistory.addVersion(savedObservation.id);
      newResourceHistory.save(function(rhError, savedResourceHistory) {
        req.resourceHistory = savedResourceHistory;
        console.log("        ----- Saving observation to cache -----");
      });
    }
  }); 
}