var yargs = require('yargs');
var main = require('./main.js');
var pkg = require('./package.json');
var path = require('path');

var argv = yargs
  .usage('$0 queueId path-to-worker.js')
  .example('$0 "37667/queueName"', ' "./workers/ftp-delete/index.js"')
  .help('help').alias('help', 'h').describe('h', 'Show help.')
  .demand(2)
  .argv;

var queueId = argv._[0];
var workerFile = argv._[1];
var messageLimit = argv._[3];
main(queueId, workerFile, messageLimit);
