var async = require('async');
var request = require('request');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();

// this is not a long running job and it should be on AWS Lambda
// we have it here as an example of a sqs-workers job
module.exports = {
  handler: function(event, context) {
    console.log('processing', JSON.stringify(event, null, 2));
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

    async.waterfall([
      function download(next) {
        s3.headObject(bucketFrom, next);
      },
      function deleteFile(response, next) {
        var filePath = response.Metadata.ftp.replace(/^\/+|\/+$/gi, '');
        var auth = "Basic " + new Buffer(config.FTP_API_KEY + ":x").toString("base64");
        var opts = {
          method: 'DELETE',
          uri: `https://brickinc.brickftp.com/files/${filePath}`,
          headers: {
            "Authorization": auth
          }
        };

        request(opts, next);
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
