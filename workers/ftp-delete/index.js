var request = require('request');

// this is not a long running job and it should be on AWS Lambda
// we have it here as an example of a sqs-workers job
module.exports = {
  handler: function(event, context) {
    var auth = "Basic " + new Buffer(config.FTP_API_KEY + ":x").toString("base64");
    var basePath = 'https://brickinc.brickftp.com/files';
    var filePath = event.FilePath.replace(/^\/+|\/+$/gi, '');
    var opts = {
      method: 'DELETE',
      uri: `${basePath}/${filePath}`,
      headers: {
        "Authorization": auth
      }
    };

    request(opts, function(error, response, body) {
      // console.log(response);
      context.done(error);
    });
  }
};
