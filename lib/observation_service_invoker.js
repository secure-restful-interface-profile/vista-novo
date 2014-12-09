var restler  = require('restler');
var mongoose = require('mongoose');
var _ = require('underscore');
var Observation = mongoose.model('Observation');
var ResourceHistory = mongoose.model('ResourceHistory');

exports.checkObservationCache = function(req, res, next, model) {
  console.log("===== Entering checkObservationCache =====");
  if (model === 'observation') {
    if (typeof req.params.id !== "undefined") {
      // ResourceHistory.findInCacheOrLocal(observationId, 'Observation', function(resourceHistory) {
        // if (resourceHistory) {
        //   // we already have the resource, let's use it
        //   // in the future we can check to see if we need to refresh the cached copy
        //   req.resourceHistory = resourceHistory;
        //   next();
        // } else {
          // fetch from the backend service
          checkObservationObject(req, res, next);
        // }
      // });
    } else {
      checkObservationCollection(req, res, next);
    }
  } else {
    next();
  }
}

checkObservationObject = function(req, res, next) {
  var observationId = req.params.id;
  var requestUrl = req.serviceConfig.observations.url + "/" + observationId + ".json";
  console.log("----- requestUrl = " + requestUrl + " -----");
  console.log("----- request headers = " + req.headers + " -----");
  console.log("----- authorization header = " + req.headers['authorization'] + " -----");

  restler.get(requestUrl, {headers: {'Authorization': req.header['authorization']}}).once('complete', function(vistaObservation, response) {
    console.log("----- response.statusCode = " + response.statusCode + " -----");
    if (vistaObservation instanceof Error) {
      console.log("***** Error: " + vistaObservation.message + " *****");
      res.send(500);
    } else {
      if (response.statusCode == 200) {
        fhirizeObservation(req, res, vistaObservation, observationId);
        next();        
      } else {
        // return error from backend service
        res.send(response.statusCode);
      }
    }       
  });
}

checkObservationCollection = function(req, res, next) {
  var requestUrl = req.serviceConfig.observations.url + ".json";
  console.log("----- requestUrl = " + requestUrl + " -----");
  console.log("----- request headers = " + req.headers + " -----");
  console.log("----- authorization header = " + req.headers['authorization'] + " -----");
  
  restler.get(requestUrl, {headers: {'Authorization': req.header['authorization']}}).once('complete', function(vistaObservations, response) {
    console.log("----- response.statusCode = " + response.statusCode + " -----");
    if (vistaObservations instanceof Error) {
      console.log("***** Error: " + vistaObservations.message + " *****");
      res.send(500);
    } else {
      if (response.statusCode == 200) {
        vistaObservations.forEach(function(vistaObservation) {
          console.log("----- Observation -----");
          fhirizeObservation(req, res, vistaObservation, vistaObservation.id);
        });
        next();
      } else {
        // return error from backend service
        res.send(response.statusCode);
      }
    }
  });
}

fhirizeObservation = function(req, res, vistaObservation, id) {
  var novoObservation = new Observation();
  
  novoObservation.name.coding = [{system: "http://loinc.org", code: vistaObservation.name}];
  var bpReading = vistaObservation.value.split('/');
  novoObservation.component = [{name: {coding: [{system: "http://loinc.org", code: "8480-6"}]}, valueQuantity: {"value": bpReading[0], units: "mm[Hg]"}}, 
                               {name: {coding: [{system: "http://loinc.org", code: "8462-4"}]}, valueQuantity: {"value": bpReading[1], units: "mm[Hg]"}}];
  novoObservation.appliesDateTime = Date.parse(vistaObservation.issued)

  novoObservation.save(function(err, savedObservation) {          
    if(err) {
      res.send(500);
    } else {
      var newResourceHistory = new ResourceHistory({resourceType: 'Observation', vistaId: req.params.id});
      newResourceHistory.addVersion(savedObservation.id);
      newResourceHistory.save(function(rhError, savedResourceHistory) {
        req.resourceHistory = savedResourceHistory;
      });
    }
  }); 
}