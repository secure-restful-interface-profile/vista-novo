var restler  = require('restler');
var mongoose = require('mongoose');
var _ = require('underscore');
var Medication = mongoose.model('Medication');
var ResourceHistory = mongoose.model('ResourceHistory');

exports.checkMedicationCache = function(req, res, next, model) {
  if (model === 'medication' && typeof req.params.id !== "undefined") {
    var medicationId = req.params.id;
    ResourceHistory.findInCacheOrLocal(medicationId, 'Medication', function(resourceHistory) {
      // if (resourceHistory) {
      //   // we already have the resource, let's use it
      //   // in the future we can check to see if we need to refresh the cached copy
      //   req.resourceHistory = resourceHistory;
      //   next();
      // } else {
        // fetch from the backend service
        var requestUrl = req.serviceConfig.medications.url + medicationId + ".json";
        restler.get(requestUrl, {headers: {'Authorization': req.header['authorization']}}).once('complete', function(vistaMedication, response) {
          if (vistaMedication instanceof Error) {
            console.log("***** Error: " + vistaMedication.message + " *****");
            res.send(500);
          } else {
            if (response.statusCode == 200) {
              var novoMedication = new Medication();

              novoMedication.code.coding = [{system: "http://snomed.info/sct", 
                                                code: vistaMedication.code, 
                                                display: vistaMedication.text}];

              novoMedication.isBrand = vistaMedication.is_brand;

              novoMedication.product.form.coding = [{system: vistaMedication.product_form_system, 
                                                          code: vistaMedication.product_form_code, 
                                                          display: vistaMedication.product_form_text}];

              novoMedication.save(function(err, savedMedication) {          
                if(err) {
                  res.send(500);
                } else {
                  var newResourceHistory = new ResourceHistory({resourceType: 'Medication', vistaId: req.params.id});
                  newResourceHistory.addVersion(savedMedication.id);
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
          }      
        });
      // }
    });
  } else {
    next ();
  }
}