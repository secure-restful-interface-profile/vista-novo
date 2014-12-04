var fs = require('fs');
var util = require('util');
var log_file = fs.createWriteStream(__dirname + '/log/debug.log', {flags : 'w'});
var log_stdout = process.stdout;

console.log = function(d) { //
  log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
};

// var log = bunyan.createLogger({
// 	name: 'access_log',
// 	streams: [{
//     path: __dirname + 'access_log',
//     level: bunyan.DEBUG
// 	}]
// });

var vistaNovo = require(__dirname + '/config/express');
vistaNovo.app.listen(3000);
console.log('Listening on port 3000');