/**
 * log pos summary to azure.
 */
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var Promise = require('bluebird');

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

    s3.getObject(bucketFrom, function(err, data) {

      context.done();
    });
  }
};
