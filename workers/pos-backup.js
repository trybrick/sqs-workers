/**
 * log pos summary to azure.
 */
var AWS = require('aws-sdk');
var _ = require('lodash');
var Promise = require('bluebird');
var crypto = require('crypto');
var config = require('../config');
var glob = require('glob');
var AdmZip = require('adm-zip');
var moment = require('moment');
var path = require('path');
var fs = require('fs');

AWS.config.update({
  region: config.AWS_REGION,
  accessKeyId: config.AWS_ACCESS_KEY_ID,
  secretAccessKey: config.AWS_SECRET_ACCESS_KEY
});

var files = glob.sync('../../pos/stage/*.hif');
var toUpload = [];

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
}

// for each file
// calculate path
// create zip file
// upload to s3
_.each(files, function(v, k) {
  var fullPath = path.resolve(v);
  var filename = path.basename(v);
  var fileParts = filename.split('-');
  var chainId = fileParts[0];
  var destName = fullPath.replace('.hif', '_hif.zip');
  if (fileExists(destName + '.DONE')) {
    return;
  }

  var today = moment(new Date());
  var datePath = today.format("YYYYMMDD");
  var zip = new AdmZip();
  zip.addLocalFile(fullPath, filename);
  zip.writeZip(destName);
  var namePath = path.basename(destName);

  toUpload.push({
    destPath: `archive/${datePath}/${chainId}/${namePath}`,
    localPath: destName
  });
});


function uploadToS3(fileData) {
  return new Promise(function(Y, N) {
    var body = fs.createReadStream(fileData.localPath);
    var s3 = new AWS.S3({
      params: {
        Bucket: 'brick-ftp',
        Key: fileData.destPath
      }
    });
    s3.upload({
      Body: body
    }).
      on('httpUploadProgress', function(evt) {
        console.log(evt);
      }).
      send(function(err, data) {
        console.log(err, data);
        if (err) {
          N(err);
          return;
        }

        fs.rename(fileData.localPath, fileData.localPath + '.DONE', function(err) {
          if (err) {
            N(err);
            return;
          }

          Y(err);
        });
      });
  });
}

function next(err) {
  if (toUpload <= 0) {
    console.log('done', err);
    process.exit(0);
  }
  var currentFile = toUpload.shift();
  uploadToS3(currentFile).then(next, next);
}

next();

setInterval(function() {
  console.log('idling');
}, 1000);
