/*
  Summary:
    s3 -> sqs -> worker: azure and stathat
 */
var AWS = require('aws-sdk');
var _ = require('lodash');
var s3 = new AWS.S3();
var Promise = require('bluebird');
var request = require('request');
var crypto = require('crypto');
var config = require('../../config');
var liftAnalysis = require('./lift-analysis');

var azureKeys = config.AZURE_STORAGE_STRING.split(':');
var accountName = azureKeys[0];
var secureKey = azureKeys[1];
var tableName = 'posreport';
console.log(azureKeys);

function getSignature(stringToSign) {
  var shahmac = crypto.createHmac('SHA256', new Buffer(secureKey, 'base64'));
  return shahmac.update(stringToSign, 'utf-8').digest('base64');
}

function getHeaders(path) {
  var headers = {};
  var date = (new Date()).toUTCString();
  var stringToSign = `${date}\n/${accountName}/${path}`;
  var sig = getSignature(stringToSign);
  headers.Authorization = `SharedKeyLite ${accountName}:${sig}`;
  headers['x-ms-date'] = date;
  headers['x-ms-version'] = '2014-02-14';
  headers.Accept = 'application/json';
  return headers;
}

function uploadAzure(payload) {
  return new Promise((resolve, reject) => {
    var rowKey = payload.RowKey;
    var partitionKey = payload.PartitionKey;
    //var path = `${tableName}(PartitionKey='${partitionKey}',RowKey='${rowKey}')`;
    var path = `${tableName}()`;
    var urlPath = `https://${accountName}.table.core.windows.net/${path}`;
    var opts = {
      method: 'POST',
      url: urlPath,
      headers: getHeaders(path)
    };
    opts.headers['Content-Type'] = 'application/json';
    //opts.headers['If-Match'] = '*';
    opts.json = payload;
    //delete payload['RowKey'];
    //delete payload['PartitionKey'];

    //console.log(JSON.stringify(opts, null, 2));

    request(opts
      , (error, raw, response) => {
        // console.log(error, 'response', response);
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
  });
}

// this is not a long running job and it should be on AWS Lambda
// we have it here as an example of a sqs-workers job
module.exports = {
  handler: function(event, context) {
    console.log('processing', JSON.stringify(event, null, 2));
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

    var fileParts = bucketFrom.Key.split('/');
    var chainId = fileParts[0];
    var fileName = fileParts[fileParts.length - 1];

    s3.getObject(bucketFrom, function(err, data) {
      var purchaseDate = fileName.substr(0, 10);
      var rst = JSON.parse(data.Body);
      var summary = {
        PurchaseDate: purchaseDate,
        ChainId: chainId,
        BasketItemCount: 0,
        BasketItemQuantity: 0,
        BasketCount: 0,
        BasketSum: 0.0,
        SaleSum: rst.all.sum,
        SaleItemCount: rst.all.count,
        SaleItemQuantity: rst.all.quantity,
        RowKey: `${purchaseDate}_summary`,
        PartitionKey: `${chainId}`,
        StoreHeader: 'StoreNumber,Count,Quantity,Sum',
        StoreData: [],
        OtherItemCount: 0,
        OtherItemQuantity: 0,
        OtherSum: 0
      };

      // calculate basket average
      _.each(rst.basket, function(v, k) {
        if (k !== '0') {
          summary.BasketCount++;
          summary.BasketSum += v.sum;
          summary.BasketItemCount += v.count;
          summary.BasketItemQuantity += v.quantity;
        } else {
          summary.OtherItemCount = v.count;
          summary.OtherItemQuantity = v.quantity;
          summary.OtherSum = v.sum;
        }
      });

      var storeData = []
      _.each(rst.store, function(v, k) {
        storeData.push([k, v.count, v.quantity, v.sum]);
      });

      summary.StoreData = JSON.stringify(storeData);
      var next = function() {
        liftAnalysis
          .logSummary(rst, summary)
          .then(context.done, context.done);
      };

      // post to remote
      // console.log(JSON.stringify(summary, null, 2));
      uploadAzure(summary)
        .then(next, next);
    });
  }
};
