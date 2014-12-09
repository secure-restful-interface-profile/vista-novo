// Allow self-signed certificates
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

// create express object to be returned
var express  = require('express');
var provider = require('./mongoose.js');
var cons     = require('consolidate');
var util     = require('util');

// create app object and setup as exported member of module
var app = express();

//configure app
// assign the swig engine to .html files
app.engine('eco', cons.eco);

// set .html as the default extension 
app.set('view engine', 'eco');
app.set('views', __dirname + '/../app/views');

var serviceConfig = require('./external_services')

app.use(function(req, res, next) {
  req.serviceConfig = serviceConfig;
  next();
});

var patientServiceInvoker = require(__dirname + '/../lib/patient_service_invoker');
var observationServiceInvoker = require(__dirname + '/../lib/observation_service_invoker');
var medicationServiceInvoker = require(__dirname + '/../lib/medication_service_invoker');
var conditionServiceInvoker = require(__dirname + '/../lib/condition_service_invoker');


app.use(express.bodyParser());

// setup routes

app.get('/favicon.ico', function(req, res) {
  res.send(404)
});

// root url(not necessary)
app.get('/', function(req, res){
  provider.findAll( function(error,collection){
    res.render('index', {
      title: 'Model Index',
      models: collection
    });
  });
});

//index for model(not necessary)
app.get('/:model', function(req,res){
  console.log("===== Entering GET /:model =====");
  var controller = require('../app/controllers/' + req.params.model);
  console.log("----- Calling controller ------")
  controller.list(req,res);
  // console.log("----- res = " + util.inspect(res) + " -----");
});

//show latest model
app.get('/:model/@:id', function(req,res){
  console.log("===== Entering GET /:model/@:id =====");
  var controller = require('../app/controllers/' + req.params.model);
  controller.load(req,res,req.params.id,null, function(obj) {
    if(obj.constructor.name=="Error")
    {
      console.log("Got an error: " + obj);
      res.send(500);
    } else {
      console.log("----- Calling controller ------")
      controller.show(req,res);
    }
  });
  // console.log("----- res = " + util.inspect(res) + " -----");
});

//show for model
app.get('/:model/@:id/history/@:vid', function(req,res){
  console.log("===== Entering GET /:model/@:id/history/@:vid =====");
  var controller = require('../app/controllers/' + req.params.model);
  controller.load(req,res,req.params.id,req.params.vid, function(obj) {
    if(obj.constructor.name=="Error")
    {
      console.log("Got an error: " + obj);
      res.send(500);
    } else {
      console.log("----- Calling controller ------")
      controller.show(req,res);
    }
  });
  // console.log("----- res = " + util.inspect(res) + " -----");
});

//create for model
app.post('/:model/create', function(req,res){
  var controller = require('../app/controllers/' + req.params.model);
  controller.create(req,res);
});

//update for model
app.put('/:model/update/:id/:vid', function(req,res){
  var controller = require('../app/controllers/' + req.params.model);
  controller.load(req,res,req.params.id,req.params.vid, function(obj) {
    if(obj.constructor.name=="Error")
    {
      console.log("Got an error: " + obj);
      res.send(500);
    } else {
      controller.update(req,res);
    }
  });
});

//destroy for model
app.delete('/:model/destroy/:id/:vid', function(req,res){
  var controller = require('../app/controllers/' + req.params.model);
  controller.load(req,res,req.params.id,req.params.vid, function(obj) {
    if(obj.constructor.name=="Error")
    {
      console.log("Got an error: " + obj);
      res.send(500);
    } else {
      controller.destroy(req,res);
    }
  });
  
});

app.param('model', patientServiceInvoker.checkPatientCache);
app.param('model', observationServiceInvoker.checkObservationCache);
app.param('model', medicationServiceInvoker.checkMedicationCache);
app.param('model', conditionServiceInvoker.checkConditionCache);

exports.app = app;
