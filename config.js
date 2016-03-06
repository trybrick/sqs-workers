var fs = require('fs');
var env = process.env;

if (fs.existsSync('./.env.json')) {
  env = require('./.env.json');
}

module.exports = {
  "AWS_ACCESS_KEY_ID": env.AWS_ACCESS_KEY_ID,
  "AWS_SECRET_ACCESS_KEY": env.AWS_SECRET_ACCESS_KEY,
  "AWS_REGION": env.AWS_REGION || 'us-west-2',
  "FTP_CONNECTION_STRING": env.FTP_CONNECTION_STRING,
  "FTP_API_KEY": env.FTP_API_KEY,
  "AZURE_STORAGE_STRING": env.AZURE_STORAGE_STRING,
  "IsTest": env.NODE_ENV === 'development',
  "QueuePrefix": "https://sqs.us-west-2.amazonaws.com",
  "IdleTime": 15
};
