var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var Promise = require('bluebird');
var spawn = require('child_process').spawn;
var _ = require('lodash');
var path = require('path');
var fs = require('fs');
var unzip = require('unzip');

var configFile = path.join(__dirname, 'archive.config.js');
var config = require(configFile);
var logMessages = [];

var log = function() {
  // do some custom log recording
  // log.call(this, 'My Console!!!');
  var args = Array.prototype.slice.call(arguments);
  console.log.apply(console, args);
  _.each(arguments, function(v) {
    logMessages.push(v);
  });
};

function downloadExtract(bucketFrom) {
  return new Promise(function(resolve, reject) {
    var fileParts = bucketFrom.Key.split('/');
    var chainId = fileParts[2];
    var oldFileName = fileParts[fileParts.length - 1];
    var newName = `${chainId}-${oldFileName}`;
    var fileName = path.join(config.workDir, newName);
    var outputFileName = fileName.replace(/(\.zip)+$/gi, '.hif')
    var file = fs.createWriteStream(outputFileName);
    config.logFile = bucketFrom.Key.replace(/(\.zip)+$/gi, '.log');
    config.bucketFrom = bucketFrom;

    s3.getObject(bucketFrom) // Unzip stream
      .createReadStream()
      .pipe(unzip.Parse())

      // Each file
      .on('entry', function(entry) {
        if (entry.type !== 'File') {
          return;
        }

        entry.pipe(file);
      })

      // Callback with error
      .on('error', reject)

      // Finished uploading
      .on('close', function() {
        file.close();
        resolve(outputFileName);
      });
  });
}

function cleanUp(context) {
  if (config.workDir.indexOf('tmp') < 0) {
    context.done('invalid work dir: ' + config.workDir);
    return;
  }

  log('start cleanUp', config.workDir);
  var dirToRemove = config.workDir + '/*';

  // exec filehose
  return new Promise(function(Y, N) {
    var unzip = spawn('rm', ['-rf', dirToRemove], {
      cwd: config.workDir
    });
    unzip.stdout.on('data', log);
    unzip.on('close', Y);
    unzip.on('error', Y);
  });
}

function splitFiles(filePath) {
  log('start splitFiles', filePath);

  // exec filehose
  return new Promise(function(Y, N) {
    var unzip = spawn('filehose', [configFile, filePath], {
      cwd: config.workDir
    });
    unzip.stdout.on('data', log);
    unzip.on('close', function(code) {
      code == 0 ? Y(code) : N(code);
    });
    unzip.on('error', N);
  });
}


function syncToS3() {
  log('start syncToS3');

  // execute aws-cli s3 sync
  return new Promise(function(Y, N) {
    var sourceDir = path.join(config.workDir, 'out/');
    var destDir = 'S3://brick-db/pos/';

    var cmd = spawn('aws', ['s3', 'sync', './', destDir], {
      cwd: sourceDir
    });
    cmd.stdout.on('data', log);
    cmd.on('close', function(code) {
      code == 0 ? Y(code) : N(code);
    });
    cmd.on('error', N);
  });
}

function logResult(err) {
  if (err) {
    log('error', err);
  }

  // write to s3
  s3.putObject({
    Bucket: config.bucketFrom.Bucket,
    Key: config.logFile,
    Body: JSON.stringify(logMessages, null, 2),
    ContentType: 'application/json'
  }, config.context.done);
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

    var bucketFrom = {
      Bucket: srcBucket,
      Key: srcKey
    };

    cleanUp(context)
      .then(function() {
        return downloadExtract(bucketFrom);
      })
      .then(splitFiles)
      .then(syncToS3)
      .then(logResult, logResult);
  }
};
