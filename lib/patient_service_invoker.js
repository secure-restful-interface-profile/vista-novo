var restler  = require('restler');
var mongoose = require('mongoose');
var _ = require('underscore');
var Patient = mongoose.model('Patient');
var ResourceHistory = mongoose.model('ResourceHistory');

exports.checkPatientCache = function(req, res, next, model) {
  if (model === 'patient' && typeof req.params.id !== "undefined") {
    var patientId = req.params.id;
    ResourceHistory.findInCacheOrLocal(patientId, 'Patient', function(resourceHistory) {
      // if (resourceHistory) {
      //   // we already have the resource, let's use it
      //   // in the future we can check to see if we need to refresh the cached copy
      //   req.resourceHistory = resourceHistory;
      //   next();
      // } else {
        // fetch from the backend service
        var requestUrl = req.serviceConfig.patients.url + patientId + ".json";
        restler.get(requestUrl, {headers: {'Authorization': req.header['authorization']}}).once('complete', function(vistaPatient, response) {
          if (response.statusCode == 200) {
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
                  next();
                });
              }
            });        
          } else {
            // return error from backend service
            res.send(response.statusCode);
          }       
        });
      // }
    });
  } else {
    next();
  }
}