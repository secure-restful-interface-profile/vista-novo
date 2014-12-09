var restler  = require('restler');
var mongoose = require('mongoose');
var _ = require('underscore');
var Patient = mongoose.model('Patient');
var ResourceHistory = mongoose.model('ResourceHistory');

exports.checkPatientCache = function(req, res, next, model) {
  if (model === 'patient') {
    if (typeof req.params.id !== "undefined") {
      // ResourceHistory.findInCacheOrLocal(patientId, 'Patient', function(resourceHistory) {
        // if (resourceHistory) {
        //   // we already have the resource, let's use it
        //   // in the future we can check to see if we need to refresh the cached copy
        //   req.resourceHistory = resourceHistory;
        //   next();
        // } else {
          // fetch from the backend service
          checkObject(req, res, next);
        // }
      // });
    } else {
      checkCollection(req, res, next);
    }
  } else {
    next();
  }
}

checkObject = function(req, res, next) {
  var patientId = req.params.id;
  var requestUrl = req.serviceConfig.patients.url + "/" + patientId + ".json";
  console.log("----- requestUrl = " + requestUrl + " -----");

  restler.get(requestUrl, {headers: {'Authorization': req.header['authorization']}}).once('complete', function(vistaPatient, response) {
    if (vistaPatient instanceof Error) {
      console.log("***** Error: " + vistaPatient.message + " *****");
      res.send(500);
    } else {
      if (response.statusCode == 200) {
        fhirize(req, res, vistaPatient, patientId);
        next();
      } else {
        // return error from backend service
        res.send(response.statusCode);
      } 
    }      
  });
}

checkCollection = function(req, res, next) {
  var requestUrl = req.serviceConfig.patients.url + ".json";
  console.log("----- requestUrl = " + requestUrl + " -----");
  
  restler.get(requestUrl, {headers: {'Authorization': req.header['authorization']}}).once('complete', function(vistaPatients, response) {
    console.log("----- response.statusCode = " + response.statusCode + " -----");
    if (vistaPatients instanceof Error) {
      console.log("***** Error: " + vistaPatients.message + " *****");
      res.send(500);
    } else {
      if (response.statusCode == 200) {
        vistaPatients.forEach(function(vistaPatient) {
          console.log("----- Patient -----");
          fhirize(req, res, vistaPatient, vistaPatient.id);
        });
        next();
      } else {
        // return error from backend service
        res.send(response.statusCode);
      }
    }
  });
}

fhirize = function(req, res, vistaPatient, id) {
  var novoPatient = new Patient();
  
  novoPatient.gender.coding = [{system: "http://hl7.org/fhir/v3/AdministrativeGender", code: vistaPatient.gender}];
  novoPatient.name = [{family: [vistaPatient.familyname], given: [vistaPatient.givenname]}];
  novoPatient.birthDate = Date.parse(vistaPatient.birthdate);

  novoPatient.save(function(err, savedPatient) {          
    if(err) {
      res.send(500);
    } else {
      var newResourceHistory = new ResourceHistory({resourceType: 'Patient', vistaId: req.params.id});
      newResourceHistory.addVersion(savedPatient.id);
      newResourceHistory.save(function(rhError, savedResourceHistory) {
        req.resourceHistory = savedResourceHistory;
      });
    }
  });        
}