var restler  = require('restler');
var mongoose = require('mongoose');
var _ = require('underscore');
var util = require('util');

var Medication = mongoose.model('Medication');
var ResourceHistory = mongoose.model('ResourceHistory');

//-------------------------------------------------------------------------------

exports.checkMedicationCache = function(req, res, next, model) {
  console.log("===== Entering checkMedicationCache =====");
  if (model === 'medication') {
    if (typeof req.params.id !== "undefined") {
      checkMedication(req, res, next);
    } else {
      checkMedicationList(req, res, next);
    }
  } else {
    next();
  }
}

//-------------------------------------------------------------------------------

checkMedication = function(req, res, next) {
  console.log("  ===== Entering checkMedication =====");

  var medicationId = req.params.id;
  var requestUrl = req.serviceConfig.medications.url + "/" + medicationId + ".json";

  console.log("  ----- requestUrl = " + requestUrl + " -----");
  console.log("  ----- request headers = " + req.headers + " -----");
  console.log("  ----- authorization header = " + req.headers['authorization'] + " -----");

  restler.get(requestUrl, {headers: {'Authorization': req.headers['authorization']}}).once('complete', function(vistaMedication, response) {
    // console.log("----- response = " + util.inspect(response) + " -----");
    console.log("----- response.statusCode = " + response.statusCode + " -----");
    if (response.statusCode == 200) {
      lookupMedication(req, res, vistaMedication, medicationId)
      next();
    } else {
      // return error from backend service
      res.send(response.statusCode);
    } 
  });
}

//-------------------------------------------------------------------------------

checkMedicationList = function(req, res, next) {
  console.log("  ===== Entering checkMedicationList =====");

  var requestUrl = req.serviceConfig.medications.url + ".json";

  console.log("  ----- requestUrl = " + requestUrl + " -----");
  console.log("  ----- request headers = " + req.headers + " -----");
  console.log("  ----- authorization header = " + req.headers['authorization'] + " -----");

  restler.get(requestUrl, {headers: {'Authorization': req.headers['authorization']}}).once('complete', function(vistaMedications, response) {
    // console.log("  ----- response = " + util.inspect(response) + " -----");
    console.log("  ----- response.statusCode = " + response.statusCode + " -----");
    if (response.statusCode == 200) {
      vistaMedications.forEach(function(vistaMedication) {
        console.log("    ----- Medication -----");
        lookupMedication(req, res, vistaMedication, vistaMedication.id);
      });
      next();
    } else {
      // return error from backend service
      res.send(response.statusCode);
    }
  });
}

//-------------------------------------------------------------------------------

lookupMedication = function(req, res, vistaMedication, id) {
  console.log("      ===== Entering lookupMedication =====");

  ResourceHistory.findInCacheOrLocal(id, 'Medication', function(resourceHistory) {
    if (resourceHistory) {
      // we already have cached the resource in FHIR format, let's use it
      // in the future we can check to see if we need to refresh the cached copy
      console.log("      ----- Found medication in cache -----");
      req.resourceHistory = resourceHistory;
    } else {
      // Convert to FHIR and put the object in our cache
      console.log("      ----- Medication not already in cache... adding it -----");
      cacheFhirMedication(req, res, vistaMedication, id);
    }
  });
}

//-------------------------------------------------------------------------------

cacheFhirMedication = function(req, res, vistaMedication, id) {
  console.log("        ===== Entering cacheFhirMedication =====");

  // Translate returned information from EHR into FHIR
  var novoMedication = new Medication();

  novoMedication.code.coding = [{system: "http://snomed.info/sct", 
                                    code: vistaMedication.code, 
                                    display: vistaMedication.text}];

  novoMedication.isBrand = vistaMedication.is_brand;

  novoMedication.product.form.coding = [{system: vistaMedication.product_form_system, 
                                              code: vistaMedication.product_form_code, 
                                              display: vistaMedication.product_form_text}];

  // Store medication in cache
  novoMedication.save(function(err, savedMedication) {          
    if(err) {
      console.log("        ----- err = " + err + " -----");
      res.send(500);
    } else {
      var newResourceHistory = new ResourceHistory({resourceType: 'Medication', 
                                                      vistaId: id});
      newResourceHistory.addVersion(savedMedication.id);
      newResourceHistory.save(function(rhError, savedResourceHistory) {
        req.resourceHistory = savedResourceHistory;
        console.log("        ----- Saving medication to cache -----");
      });
    }
  });        
}