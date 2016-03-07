var async = require('async');
var https = require('https');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var config = {
  FTP_API_KEY: process.env.FTP_API_KEY
};

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
        console.log('deleting: ', filePath);
        var opts = {
          method: 'DELETE',
          host: 'brickinc.brickftp.com',
          port: 443,
          path: `/files/${filePath}`,
          auth: config.FTP_API_KEY + ":x"
        };

        // request(opts, next);
        var req = https.request(opts, function(res) {
          console.log('statusCode: ', res.statusCode);
          console.log('headers: ', res.headers);

          res.on('data', (d) => {
            process.stdout.write(d);
          });

          next();
        });
        req.on('error', (e) => {
          console.error(e);
          next(e);
        });
        req.end();
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
