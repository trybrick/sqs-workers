var config = require('./config');
var Consumer = require('sqs-consumer');
var path = require('path');
var fs = require('fs');
var moment = require('moment');
var yargs = require('yargs');
var AWS = require('aws-sdk');

config.startTime = new Date();
config.isRunning = false;
config.messageCount = 0;

var currentCallback = null;

AWS.config.update({
  region: config.AWS_REGION,
  accessKeyId: config.AWS_ACCESS_KEY_ID,
  secretAccessKey: config.AWS_SECRET_ACCESS_KEY
});

module.exports = function(queueId, workerFile) {
  queueId = queueId.replace(/^\/+|\/+$/gi, '');
  var worker = require(workerFile);
  var app = Consumer.create({
    queueUrl: `${config.QueuePrefix}/${queueId}`,
    visibilityTimeout: 60,
    handleMessage: function(message, done) {
      config.messageCount++;
      config.lastActionTime = new Date();
      config.isRunning = true;
      currentCallback = done;
      var msg = JSON.parse(message.Body);
      if (msg.Event === 's3:TestEvent') {
        console.log('skip test event')
        done();
        return;
      }

      worker.handler(msg, {
        done: done
      })
    }
  });

  app.on('error', function(err) {
    console.log('queue err: ' + err);
    config.isRunning = false;
  });

  app.on('message_processed', function(message) {
    config.isRunning = false;
  });

  var idleLimit = (config.IdleTime || 15) * 1000;

  function handleIdle() {
    var currentTime = new Date();
    var diffMs = (currentTime - (config.lastActionTime || config.startTime));
    console.log(diffMs);

    if (!config.isRunning && diffMs > idleLimit) {
      console.log('idle timeout...')
      app.stop();
      process.exit(config.messageCount > 0 ? 0 : 1);
      return;
    }

    setTimeout(handleIdle, 999);
    return;
  }

  // idling timeout
  setTimeout(handleIdle, 999);

  process.on('uncaughtException', function(err) {
    // handle the error safely
    console.log('uncaught error: ' + err)
    if (currentCallback) {
      currentCallback();
    }
  })

  console.log('start');
  app.start();
}