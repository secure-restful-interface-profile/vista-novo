var restler  = require('restler');
var mongoose = require('mongoose');
var _ = require('underscore');
var util = require('util');

var Patient = mongoose.model('Patient');
var ResourceHistory = mongoose.model('ResourceHistory');

//-------------------------------------------------------------------------------

exports.checkPatientCache = function(req, res, next, model) {
  console.log("===== Entering checkPatientCache =====");
  if (model === 'patient') {
    if (typeof req.params.id !== "undefined") {
      checkObject(req, res, next);
    } else {
      checkCollection(req, res, next);
    }
  } else {
    next();
  }
}

//-------------------------------------------------------------------------------

checkObject = function(req, res, next) {
  console.log("  ===== Entering checkPatient =====");

  var patientId = req.params.id;
  var requestUrl = req.serviceConfig.patients.url + "/" + patientId + ".json";

  console.log("  ----- requestUrl = " + requestUrl + " -----");
  console.log("  ----- request headers = " + req.headers + " -----");
  console.log("  ----- authorization header = " + req.headers['authorization'] + " -----");

  restler.get(requestUrl, {headers: {'Authorization': req.header['authorization']}}).once('complete', function(vistaPatient, response) {
    // console.log("  ----- response = " + util.inspect(response) + " -----");
    console.log("  ----- response.statusCode = " + response.statusCode + " -----");
    if (response.statusCode == 200) {
      lookupObject(req, res, vistaPatient, patientId);
      next();
    } else {
      // return error from backend service
      res.send(response.statusCode);
    } 
  });
}

//-------------------------------------------------------------------------------

checkCollection = function(req, res, next) {
  console.log("  ===== Entering checkPatientList =====");

  var requestUrl = req.serviceConfig.patients.url + ".json";

  console.log("  ----- requestUrl = " + requestUrl + " -----");
  console.log("  ----- request headers = " + req.headers + " -----");
  console.log("  ----- authorization header = " + req.headers['authorization'] + " -----");
  
  restler.get(requestUrl, {headers: {'Authorization': req.header['authorization']}}).once('complete', function(vistaPatients, response) {
    // console.log("  ----- response = " + util.inspect(response) + " -----");
    console.log("  ----- response.statusCode = " + response.statusCode + " -----");
    if (response.statusCode == 200) {
      vistaPatients.forEach(function(vistaPatient) {
        console.log("  ----- Patient -----");
        lookupObject(req, res, vistaPatient, vistaPatient.id);
      });
      next();
    } else {
      // return error from backend service
      res.send(response.statusCode);
    }
  });
}

//-------------------------------------------------------------------------------

lookupObject = function(req, res, vistaPatient, id) {
  console.log("      ===== Entering lookupPatient =====");

  ResourceHistory.findInCacheOrLocal(id, 'Patient', function(resourceHistory) {
    if (resourceHistory) {
      // we already have cached the resource in FHIR format, let's use it
      // in the future we can check to see if we need to refresh the cached copy
      console.log("      ----- Found patient in cache -----");
      req.resourceHistory = resourceHistory;
    } else {
      // Convert to FHIR and put the object in our cache
      console.log("      ----- Patient not already in cache... adding it -----");
      cacheFhirObject(req, res, vistaPatient, id);
    }
  });
}

//-------------------------------------------------------------------------------

cacheFhirObject = function(req, res, vistaPatient, id) {
  console.log("        ===== Entering cacheFhirPatient =====");

  // Translate returned information from EHR into FHIR
  var novoPatient = new Patient();
  
  novoPatient.gender.coding = [{system: "http://hl7.org/fhir/v3/AdministrativeGender", 
                                    code: vistaPatient.gender}];

  novoPatient.name = [{family: [vistaPatient.familyname], 
                          given: [vistaPatient.givenname]}];

  novoPatient.birthDate = Date.parse(vistaPatient.birthdate);

  // Store patient in cache
  novoPatient.save(function(err, savedPatient) {          
    if(err) {
      console.log("        ----- err = " + err + " -----");
      res.send(500);
    } else {
      var newResourceHistory = new ResourceHistory({resourceType: 'Patient', 
                                                      vistaId: id});
      newResourceHistory.addVersion(savedPatient.id);
      newResourceHistory.save(function(rhError, savedResourceHistory) {
        req.resourceHistory = savedResourceHistory;
        console.log("        ----- Saving condition to cache -----");
      });
    }
  });        
}