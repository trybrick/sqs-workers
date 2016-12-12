/*
  Summary:
    github -> sns -> sqs -> worker: push to s3
 */
var Promise = require('bluebird');
var spawn = require('child_process').spawn;
var mkdirp = require('mkdirp');
var _ = require('lodash');
var fs = require('fs');
var exec = require('child_process').exec;
var path = require('path');
var config = {};
var today = new Date();
var myDir = 'tmp';
myDir = path.join(__dirname, myDir);
var log = function () {
    // do some custom log recording
    // log.call(this, 'My Console!!!');
    var args = Array.prototype.slice.call(arguments);
    console.log.apply(console, args);
};

function doDownload() {
    log('start download');
    // execute aws-cli s3 sync
    return new Promise(function (Y, N) {
        mkdirp.sync(myDir);
        var data = config.data;
        var ref = config.ref;
        var downloadUrl = `${data.repository.url}/archive/${ref}.tar.gz`;
        var cmd = spawn('curl', ['-Lk', '-o', `${myDir}/result.tar.gz`, downloadUrl], {
            cwd: myDir
        });
        cmd.stdout.on('data', function (data) {
            log('' + data);
        });
        cmd.on('close', function (code) {
            code == 0 ? Y(code) : N(code);
        });
        cmd.on('error', N);
    });
}

function doExtract(downloadPath, ref, callback) {
    log('start extract');
    // execute aws-cli s3 sync
    return new Promise(function (Y, N) {
        var cmd = spawn('tar', ['-xvf', 'result.tar.gz', `--strip=1`], {
            cwd: myDir
        });
        cmd.stdout.on('data', function (data) {
            log('' + data);
        });
        cmd.on('close', function (code) {
            code == 0 ? Y(code) : N(code);
        });
        cmd.on('error', N);
    });
}

function cleanUp() {
    if (myDir.indexOf('tmp') < 0) {
        context.done('invalid work dir: ' + myDir);
        return;
    }
    log('start cleanUp', myDir);
    // exec filehose
    return new Promise(function (Y, N) {
        var cmd = spawn('rm', ['-rf', myDir, '/*'], {
            cwd: myDir
        });
        cmd.stdout.on('data', function (data) {
            log('' + data);
        });
        cmd.on('close', Y);
        cmd.on('error', Y);
    });
}

function makeExec() {
    log('make exec');
    // execute aws-cli s3 sync
    return new Promise(function (Y, N) {
        if (!fs.existsSync(myDir + '/deploy.sh')) {
            console.log('skipping: no deploy.sh');
            Y();
            return;
        }
        var cmd = spawn('chmod', ['+x', 'deploy.sh'], {
            cwd: myDir
        });
        cmd.stdout.on('data', function (data) {
            log('' + data);
        });
        cmd.on('close', function (code) {
            code == 0 ? Y(code) : N(code);
        });
        cmd.on('error', N);
    });
}

function syncToS3() {
    log('start syncToS3');
    // execute aws-cli s3 sync
    return new Promise(function (Y, N) {
        log('sourceDir', myDir);
        /* troubleshoot permission issue 
        var cmd = './deploy.sh ' + config.ref;
        var child = exec(cmd, {
            cwd: myDir
        }, Y);
        */
        var cmd = spawn('./deploy.sh', [config.ref], {
            cwd: myDir
        });
        cmd.stdout.on('data', function (data) {
            log('data', '' + data);
        });
        cmd.on('close', function (code) {
            console.log('close');
            code == 0 ? Y(code) : N(code);
        });
        cmd.on('error', N);
    });
}

function logResult(err) {
    if (err) {
        log('error', err);
    }
    log('done');
    // TODO: log somewhere
    // log('uploading process log...');
    setTimeout(config.context.done, 1000);
}
module.exports = {
    handler: function (event, context) {
        console.log('processing', JSON.stringify(event, null, 2));
        config.context = context;
        var ghevent = (event.MessageAttributes['X-Github-Event']['Value'] + '').toLowerCase() || 'unknown';
        if (ghevent !== 'push') {
            logResult('This service only handle push event.');
            return;
        }
        config.data = JSON.parse(event.Message);
        var ref = config.data.ref;
        if (config.data.error) {
            log('message error', config.data.error);
            config.data = config.message;
            ref = config.data.ref;
        }
        if (!ref) {
            logResult('ref is undefined!');
            return;
        }
        ref = ref.replace('refs/heads/', '');
        config.ref = ref;
        if (0 > ['tst', 'uat', 'master', 'production'].indexOf(ref)) {
            logResult('This service only handle tst/uat/master/production branch.');
            return;
        }
        cleanUp().then(doDownload).then(doExtract).then(makeExec).then(syncToS3).then(logResult, logResult);
    }
};