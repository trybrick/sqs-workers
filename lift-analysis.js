var http = require('http');
var data = require('./data.json');
var _ = require('lodash');
var banners = {
  215: 'picknsave',
  216: 'copps',
  217: 'metromarket',
  218: 'marianos'
};
var i = 0;

function statlog(t, k, v, cb) {
  var val = encodeURIComponent(v / 1000);
  var key = encodeURIComponent(k);
  var dt = encodeURIComponent(t);
  var http = require('http');
  var path = `/statv?k=${key}&d=${dt}&v=${val}`;

  var options = {
    host: 'brick.webscript.io',
    path: path
  };
  console.log(path);

  var callback = function(response) {
    var str = '';

    //another chunk of data has been recieved, so append it to `str`
    response.on('data', function(chunk) {
      str += chunk;
    });

    //the whole response has been recieved, so we just print it out here
    response.on('end', function() {
      console.log('server:', str);
      var timeout = 500;
      if (data.Entities.length % 9 == 0) {
        timeout = 15000;
      }

      setTimeout(function() {
        cb();
      }, timeout);
    });
  }

  http.request(options, callback).end();
}

function next() {
  if (data.Entities.length <= 0) {
    process.exit(0);
  }

  var item = data.Entities.shift();
  var banner = banners[item.ChainId];
  var key = `${item.ChainId}-sales-total-in-1000s-${banner}`;

  statlog(item.PurchaseDate, key, item.SaleSum, next);
// console.log(key); next();
}

next();
