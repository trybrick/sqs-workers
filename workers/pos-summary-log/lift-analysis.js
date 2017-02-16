var https = require('https');
var _ = require('lodash');
var Promise = require('bluebird');
var config = require('../../config');
var statKey = config.BRICK_STAT;
var moment = require('moment');

var banners = {
  215: 'picknsave',
  216: 'copps',
  217: 'metromarket',
  218: 'marianos'
};
var i = 0;

function statlog(data, cb) {
  var path = `/api/v2/mstats/many/pos`;

  var payload = {
    "items": data
  };
  var post_data = JSON.stringify(payload);
  console.log(JSON.stringify(payload, null, 2))

  var options = {
    host: 'api.brickinc.net',
    path: path,
    method: 'POST',
    port: 443,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(post_data),
      'Authorization': 'Basic ' + new Buffer(statKey).toString('base64')
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

  var post_req = https.request(options, callback);
  post_req.write(post_data);
  post_req.end();
}

function logStat(data) {
  return new Promise((resolve, reject) => {
//    resolve();
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
    // var t = Math.floor((pDate.getTime() + 10 * 3600000) / 1000);
    var dt = pDate.toISOString();

    // push chain
    allData.push({
      "k": key,
      "v": sum.SaleSum / 1000,
      "dt": dt
    });

    _.each(rst.store, function(v, k) {
      allData.push({
        "k": `c${sum.ChainId}-sales-1k-${banner}-storenbr-${k}`,
        "v": v.sum / 1000,
        "dt": dt
      });
    });

    return logStat(allData);
  }
}
