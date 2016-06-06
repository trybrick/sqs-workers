/*
  Summary: 
    ftp -> s3 -> sqs -> worker: delete from ftp
 */
var async = require('async');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var ftpDel = require('../ftp-del.js');

// this is not a long running job and it should be on AWS Lambda
// we have it here as an example of a sqs-workers job
module.exports = {
  handler: function(event, context) {
    console.log('processing', JSON.stringify(event, null, 2));
    var eventRecord = event.Records && event.Records[0];
    var record = eventRecord.s3 || eventRecord.custom;
    var srcKey = decodeURIComponent(
      record.object.key.replace(/\+/g, ' ')
    );
    var fileParts = srcKey.split('/');
    var goodParts = fileParts.slice(3);
    var myPath = goodParts.join('/');

    async.waterfall([
      function deleteFile(next) {
        ftpDel.handler(myPath, next);
      }
    ], function(err) {
      if (err) {
        console.error('Failed to delete ftp file: ', err);
      } else {
        console.log('Successfully delete ftp file.');
      }

      context.done(err);
    });
  }
};
