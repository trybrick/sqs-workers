var async = require('async');
var https = require('https');
var config = {
    FTP_API_KEY: process.env.FTP_API_KEY
};

// this is not a long running job and it should be on AWS Lambda
// we have it here as an example of a sqs-workers job
module.exports = {
    handler: function(myPath, next) {
        var filePath = `FTPRoot/${myPath}`;
        console.log('deleting: ', filePath);
        var opts = {
            method: 'DELETE',
            host: 'brickinc.brickftp.com',
            port: 443,
            path: `/api/rest/v1/files/${filePath}`,
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
}
