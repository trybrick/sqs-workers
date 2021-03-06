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
config.messageLimit = 100;

var currentCallback = null;

AWS.config.update({
  region: config.AWS_REGION,
  accessKeyId: config.AWS_ACCESS_KEY_ID,
  secretAccessKey: config.AWS_SECRET_ACCESS_KEY
});

module.exports = function(queueId, workerFile, messageLimit) {
  config.messageLimit = parseInt(messageLimit || '100') || 100;
  queueId = queueId.replace(/^\/+|\/+$/gi, '');
  var app = Consumer.create({
    queueUrl: `${config.QueuePrefix}/${queueId}`,
    visibilityTimeout: 60,
    handleMessage: function(message, done) {
      config.isRunning = false;
      limitCheck(done);
      config.messageCount++;
      config.lastActionTime = new Date();
      config.isRunning = true;
      var msg = JSON.parse(message.Body);
      if (msg.Event === 's3:TestEvent') {
        console.log('skip test event')
        done();
        return;
      }

      require(workerFile).handler(msg, {
        done: function(err) {
          config.isRunning = false;
          config.lastActionTime = new Date();
          done(err);
        },
        config: config
      });
    }
  });


  app.on('error', function(err) {
    console.log('queue err: ' + err);
    config.isRunning = false;
    app.stop();
    process.exit(1);
  });

  app.on('processing_error', function(err) {
    console.log('queue err: ' + err);
    config.isRunning = false;
    limitCheck();
  });

  app.on('message_processed', function(message) {
    config.isRunning = false;
    limitCheck();
  });

  var idleLimit = (config.IdleTime || 15) * 1000;

  function limitCheck(cb) {
    if (config.isRunning) {
      return;
    }

    if (config.messageCount > config.messageLimit) {
      console.log('message limit reached...');
      if (cb) {
        cb('limit reached...');
      }

      app.stop();
      process.exit(0);
    }
  }

  function handleIdle() {
    var currentTime = new Date();
    var diffMs = (currentTime - (config.lastActionTime || config.startTime));
    console.log(config.isRunning ? 'running' : 'idle', diffMs);

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
  })

  console.log('start');
  app.start();
}