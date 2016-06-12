var http = require('http');
var _ = require('lodash');
var Promise = require('bluebird');
var config = require('../../config');
var statKey = config.STAT_KEY;
var moment = require('moment');

var banners = {
  215: 'picknsave',
  216: 'copps',
  217: 'metromarket',
  218: 'marianos'
};
var i = 0;

function statlog(data, cb) {
  var path = `/ez`;

  var payload = {
    "ezkey": statKey,
    "data": data
  };
  var post_data = JSON.stringify(payload);
  console.log(JSON.stringify(payload, null, 2))

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

  var post_req = http.request(options, callback);
  post_req.write(post_data);
  post_req.end();
}

function logStat(data) {
  return new Promise((resolve, reject) => {
    statlog(data, resolve);
  });
}

module.exports = {
  logSummary: function(rst, sum) {
    var allData = [];
    var banner = banners[sum.ChainId];
    var key = `c${sum.ChainId}-sales-1k-${banner}`;
    var d = moment(sum.PurchaseDate, 'YYYY-MM-DD');
    var pDate = d.toDate();

    // log purchase date
    console.log(sum.PurchaseDate, pDate);

    // add 8 hours to make sure it's on the right day
    var t = Math.floor((pDate.getTime() + 10 * 3600000) / 1000);

    // push chain
    allData.push({
      "stat": key,
      "value": sum.SaleSum / 1000,
      "t": t
    });

    _.each(rst.store, function(v, k) {
      allData.push({
        "stat": `c${sum.ChainId}-sales-1k-${banner}-storenbr-${k}`,
        "value": v.sum / 1000,
        "t": t
      });
    });

    return logStat(allData);
  }
}
