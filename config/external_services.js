// This file contains the configuration for VistA based services
// that will be called to pull in information to be translated
// into FHIR
exports.observations = {
  url: "http://localhost:3001/admin/observation/",
  username: 'andy@mitre.org',
  password: 'splatter'
};

exports.patients = {
  url: "http://localhost:3001/admin/patient/",
  username: 'andy@mitre.org',
  password: 'splatter'
};