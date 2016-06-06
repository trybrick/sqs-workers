/*
  Summary:
    s3 -> sqs -> worker: sync to file system
 */
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var Promise = require('bluebird');
var _ = require('lodash');
var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');

var config = {
  destPath: '\\\\172.25.46.154\\CloudFiles'
}
var logMessages = [];
var today = new Date();

var log = function() {
  // do some custom log recording
  // log.call(this, 'My Console!!!');
  var args = Array.prototype.slice.call(arguments);
  console.log.apply(console, args);
  _.each(arguments, function(v) {
    logMessages.push(v);
  });
};

function download(bucketFrom, destFile) {
  return new Promise(function(resolve, reject) {
  	log(destFile);
    var destDir = path.dirname(destFile);
    mkdirp.sync(destDir);

    var file = fs.createWriteStream(destFile);
    file.on('close', resolve);
    s3.getObject(bucketFrom) // Unzip stream
      .createReadStream()
      .pipe(file)

      // Callback with error
      .on('error', reject);
  });
}

function logResult(err) {
  if (err) {
    log('error', err);
  }
  log('uploading process log...');

  setTimeout(config.context.done, 1000);
}

// this is not a long running job and it should be on AWS Lambda
// we have it here as an example of a sqs-workers job
module.exports = {
  handler: function(event, context) {
    log('processing', JSON.stringify(event, null, 2));
    config.context = context;
    config.event = event;

    var eventRecord = event.Records && event.Records[0];
    var record = eventRecord.s3 || eventRecord.custom;
    var srcBucket = record.bucket.name;
    var srcKey = decodeURIComponent(
      record.object.key.replace(/\+/g, ' ')
    );
    var today = new Date();
    var segment = srcKey.indexOf('/' + today.getYear());
    var destFile = config.destPath + '/';
    if (segment > 0) {
    	destFile += srcKey.substr(segment + 11);
    }

    destFile = destFile.replace(/(\/\/|\\\\)+/gi, '\/');

    var bucketFrom = {
      Bucket: srcBucket,
      Key: srcKey
    };

    download(bucketFrom, destFile)
      .then(logResult, logResult);
  }
};
