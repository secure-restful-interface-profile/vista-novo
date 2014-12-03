var restler  = require('restler');
var mongoose = require('mongoose');
var _ = require('underscore');
var Condition = mongoose.model('Condition');
var ResourceHistory = mongoose.model('ResourceHistory');

exports.checkConditionCache = function(req, res, next, model) {
  if (model === 'condition' && typeof req.params.id !== "undefined") {
    var conditionId = req.params.id;
    // ResourceHistory.findInCacheOrLocal(conditionId, 'Condition', function(resourceHistory) {
      // if (resourceHistory) {
      //   // we already have the resource, let's use it
      //   // in the future we can check to see if we need to refresh the cached copy
      //   req.resourceHistory = resourceHistory;
      //   next();
      // } else {
        // fetch from the backend service
        var requestUrl = req.serviceConfig.conditions.url + conditionId + ".json";
        console.log("----- requestUrl = " + requestUrl + " -----");
        restler.get(requestUrl, {headers: {'Authorization': req.header['authorization']}}).once('complete', function(vistaCondition, response) {
          console.log("----- response.statusCode = " + response.statusCode + " -----");
          if (response.statusCode == 200) {
            var novoCondition = new Condition();

            console.log("----- vistaCondition.system = " + vistaCondition.system + "-----");
            console.log("----- vistaCondition.code = " + vistaCondition.code + "-----");
            console.log("----- vistaCondition.code_text = " + vistaCondition.code_text + "-----");
            console.log("----- vistaCondition.category_system = " + vistaCondition.category_system + "-----");
            console.log("----- vistaCondition.category_code = " + vistaCondition.category_code + "-----");
            console.log("----- vistaCondition.category_text = " + vistaCondition.category_text + "-----");
            console.log("----- vistaCondition.status = " + vistaCondition.status + "-----");
            console.log("----- vistaCondition.severity_system = " + vistaCondition.severity_system + "-----");
            console.log("----- vistaCondition.severity_code = " + vistaCondition.severity_code + "-----");
            console.log("----- vistaCondition.severity_text = " + vistaCondition.severity_text + "-----");
            console.log("----- vistaCondition.onset_date = " + vistaCondition.onset_date + "-----");
            console.log("----- vistaCondition.location_system = " + vistaCondition.location_system + "-----");
            console.log("----- vistaCondition.location_code = " + vistaCondition.location_code + "-----");
            console.log("----- vistaCondition.location_text = " + vistaCondition.location_text + "-----");
            console.log("----- vistaCondition.location_detail = " + vistaCondition.location_detail + "-----");

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

            novoCondition.save(function(err, savedCondition) { 
              if(err) {
                console.log("----- err = " + err + " -----");
                res.send(500);
              } else {
                var newResourceHistory = new ResourceHistory({resourceType: 'Condition', vistaId: req.params.id});
                newResourceHistory.addVersion(savedCondition.id);
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
    // });
  } else {
    next();
  }
}