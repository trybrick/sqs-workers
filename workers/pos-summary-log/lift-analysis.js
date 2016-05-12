var http = require('http');
var _ = require('lodash');
var Promise = require('bluebird');
var config = require('../../config');
var statKey = config.STAT_KEY;

var banners = {
  215: 'picknsave',
  216: 'copps',
  217: 'metromarket',
  218: 'marianos'
};
var i = 0;

function statlog(data, cb) {
  var val = encodeURIComponent(v / 1000);
  var key = encodeURIComponent(k);
  var dt = encodeURIComponent(t);
  var path = `/ez`;

  var payload = {
    "ezkey": statKey,
    "data": data
  };
  var post_data = JSON.stringify(payload);

  var options = {
    host: 'api.stathat.com',
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(post_data)
    }
  };

  var callback = function(response) {
    var str = '';
    response.setEncoding('utf8');

    //another chunk of data has been recieved, so append it to `str`
    response.on('data', function(chunk) {
      str += chunk;
    });

    //the whole response has been recieved, so we just print it out here
    response.on('end', function() {
      console.log('server:', str);
      cb();
    });
  }

  http.request(options, callback).end();
}

function logStat(data) {
  return new Promise((resolve, reject) => {
    statlog(data, resolve);
  });
}

function getUPCs(chainId) {
  return new Promise((resolve, reject) => {
    var options = {
      host: 'brick.webscript.io',
      path: `/liftanalysis/getupcs?siteid=${chainId}`
    };

    var callback = function(response) {
      var str = '';
      response.setEncoding('utf8');

      //another chunk of data has been recieved, so append it to `str`
      response.on('data', function(chunk) {
        str += chunk;
      });

      //the whole response has been recieved, so we just print it out here
      response.on('end', function() {
        console.log('server:', str);
        resolve(str);
      });
    }

    http.request(options, callback).end();
  });
}

module.exports = {
  logSummary: function(rst, sum) {
    var allData = [];
    var banner = banners[sum.ChainId];
    var key = `${sum.ChainId}-sales-total-in-1000s-${banner}`;

    // push chain
    allData.push({
      "stat": key,
      "value": sum.SaleSum
    });

    _.each(rst.store, function(v, k) {
      allData.push({
        "stat": `${sum.ChainId}-storenbr${k}-sales-total-in-1000s-${banner}`,
        "value": v.sum
      });
    });

    return logStat(allData)
      .then(function() {
        return getUPCs(sum.ChainId);
      });
  }
}
