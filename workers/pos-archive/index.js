/*
  Summary:
    s3 -> sqs -> worker: filehose split files, calculate total -> s3
 */
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var Promise = require('bluebird');
var spawn = require('child_process').spawn;
var _ = require('lodash');
var path = require('path');
var fs = require('fs');
var unzip = require('unzip');
var mkdirp = require('mkdirp');
var ftpDel = require('../ftp-del.js');
var configFile = path.join(__dirname, 'archive.config.js');
var config = require(configFile);
var logMessages = [];
var today = new Date();
var myDir = config.workDir;
var log = function () {
    // do some custom log recording
    // log.call(this, 'My Console!!!');
    var args = Array.prototype.slice.call(arguments);
    console.log.apply(console, args);
    _.each(arguments, function (v) {
        logMessages.push(v);
    });
};

function downloadExtract(bucketFrom) {
    return new Promise(function (resolve, reject) {
        var fileParts = bucketFrom.Key.split('/');
        var fileName = path.join(myDir, fileParts[fileParts.length - 1]);
        var outputFileName = fileName.replace(/(\.zip)+$/gi, '.hif')
        var file = fs.createWriteStream(outputFileName);
        config.logFile = bucketFrom.Key.replace(/(\.zip)+$/gi, '.log');
        config.bucketFrom = bucketFrom;
        s3.getObject(bucketFrom) // Unzip stream
            .createReadStream().pipe(unzip.Parse())
            // Each file
            .on('entry', function (entry) {
                if (entry.type !== 'File') {
                    return;
                }
                entry.pipe(file);
            })
            // Callback with error
            .on('error', reject)
            // Finished uploading
            .on('close', function () {
                file.close();
                resolve(outputFileName);
            });
    });
}

function cleanUp(context) {
    if (myDir.indexOf('tmp') < 0) {
        context.done('invalid work dir: ' + myDir);
        return;
    }
    // exec filehose
    return new Promise(function (Y, N) {
        log('start cleanUp', myDir + '\\out');
        var cmd = spawn('rm', ['-rf', myDir + '\\out', '||', 'true'], {
            cwd: myDir.replace("\\tmp\\pos-archive", '')
        });
        cmd.stdout.on('data', function (data) {
            log('cleanUp: ' + data);
        });
        cmd.on('close', function (code) {
            log('close: ' + code);
            Y();
        });
        cmd.on('error', function (code) {
            log('error: ' + code);
            Y();
        });
    });
}

function splitFiles(filePath) {
    // exec filehose
    return new Promise(function (Y, N) {
        var newDir = path.resolve(myDir + "\\..\\..\\..\\..");
        var myCmd = ['node', newDir + '\\node_modules\\filehose\\src\\index.js', configFile, filePath];
        log('start splitFiles', myCmd.join(' '));
        var cmd = spawn(myCmd, [], {
            cwd: myDir
        });
        cmd.stdout.on('data', function (data) {
            log('' + data);
        });
        cmd.on('close', function (code, x) {
            log('error: ' + code);
            log('err:' + x);
            code == 0 ? Y(code) : N(code);
        });
        //cmd.on('error', N);
        cmd.on('error', function (code, x) {
            log('error: ' + code);
            log('err:' + x);
            N();
        });
    });
}

function syncToS3() {
    log('start syncToS3');
    // execute aws-cli s3 sync
    return new Promise(function (Y, N) {
        var sourceDir = path.join(myDir, 'out/');
        var destDir = 's3://brick-pos/';
        log('sourceDir', sourceDir);
        var cmd = spawn('aws', ['s3', 'cp', './', destDir, '--recursive'], {
            cwd: sourceDir
        });
        cmd.stdout.on('data', function (data) {
            log('' + data);
        });
        cmd.on('close', function (code) {
            mkdirp(myDir);
            code == 0 ? Y(code) : N(code);
        });
        cmd.on('error', N);
    });
}

function logResult(err) {
    if (err) {
        log('error', err);
    }
    log('uploading process log...');
    // write to s3
    s3.putObject({
        Bucket: config.bucketFrom.Bucket,
        Key: config.logFile,
        Body: JSON.stringify(logMessages, null, 2),
        ContentType: 'application/json'
    }, function () {
        log('process log uploaded...');
        setTimeout(config.context.done, 1000);
    });
}
// this is not a long running job and it should be on AWS Lambda
// we have it here as an example of a sqs-workers job
module.exports = {
    handler: function (event, context) {
        log('processing', JSON.stringify(event, null, 2));
        config.context = context;
        config.event = event;
        var eventRecord = event.Records && event.Records[0];
        var record = eventRecord.s3 || eventRecord.custom;
        var srcBucket = record.bucket.name;
        var srcKey = decodeURIComponent(record.object.key.replace(/\+/g, ' '));
        var bucketFrom = {
            Bucket: srcBucket,
            Key: srcKey
        };
        var fileParts = srcKey.split('/');
        var goodParts = fileParts.slice(2);
        var myPath = goodParts.join('/');
        ftpDel.handler(myPath, function () {
            cleanUp(context).then(function () {
                return downloadExtract(bucketFrom);
            }).then(splitFiles).then(syncToS3).then(logResult, logResult);
        });
    }
};