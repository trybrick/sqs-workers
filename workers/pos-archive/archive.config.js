var path = require('path');
var _ = require('lodash');
var moment = require('moment');
var mkdirp = require('mkdirp');
var fs = require('fs');
var os = require('os');

//var workDir = path.join(os.tmpdir(), 'pos-archive');
var workDir = '/tmp/pos-archive';
mkdirp.sync(workDir);

var input = {
  options: {
    delimiter: '|',
    rowDelimiter: '\n',
    trim: true
  },
  schema: {
    127: ["StoreNumber", "PurchaseDateRaw", "Quantity", "UPC", "PurchasePrice", "ExternalId"],
    182: ["StoreNumber", "UPC", "PurchasePrice", "PurchaseDateRaw", "ExternalId", "Quantity", "Weight"],
    215: ["StoreNumber", "UPC", "PurchaseDateRaw", "PurchasePrice", "ExternalId", "Quantity", "Weight", "TransactionType"],
    216: ["StoreNumber", "UPC", "PurchaseDateRaw", "PurchasePrice", "ExternalId", "Quantity", "Weight", "TransactionType"],
    217: ["StoreNumber", "UPC", "PurchaseDateRaw", "PurchasePrice", "ExternalId", "Quantity", "Weight", "TransactionType"],
    218: ["StoreNumber", "UPC", "PurchaseDateRaw", "PurchasePrice", "ExternalId", "Quantity", "Weight", "TransactionType"]
  }
};

var output = {
  options: {
    delimiter: ',',
    rowDelimiter: '\n'
  },
  headers: [
    "ChainId",
    "StoreNumber",
    "UPC",
    "PurchaseDate",
    "PurchasePrice",
    "ExternalId",
    "Quantity",
    "Weight",
    "TransactionType",
    "Id"
  ]
};

var allSummary = {};
function calculateSummary(row) {
  var allSum = allSummary[row.PurchaseDate];
  if (!allSum) {
    allSum = {
      all: {
        count: 0,
        sum: 0,
        quantity: 0
      },
      store: {},
      basket: {}
    };
    allSummary[row.PurchaseDate] = allSum;
  }

  allSum.all.ChainId = row.ChainId;
  allSum.all.count++;
  allSum.all.quantity += parseFloat(row.Quantity);
  allSum.all.sum += parseFloat(row.Quantity) * parseFloat(row.PurchasePrice);

  var basketSum = allSum.basket[row.ExternalId];
  if (!basketSum) {
    basketSum = {
      count: 0,
      quantity: 0,
      sum: 0
    };
    allSum.basket[row.ExternalId] = basketSum;
  }

  basketSum.count++;
  basketSum.quantity += parseFloat(row.Quantity);
  basketSum.sum += parseFloat(row.Quantity) * parseFloat(row.PurchasePrice);

  var storeSum = allSum.store[row.StoreNumber];
  if (!storeSum) {
    storeSum = {
      count: 0,
      quantity: 0,
      sum: 0
    };
    allSum.store[row.StoreNumber] = storeSum;
  }

  storeSum.count++;
  storeSum.quantity += parseFloat(row.Quantity);
  storeSum.sum += parseFloat(row.Quantity) * parseFloat(row.PurchasePrice);
}

var startTime = new Date();

module.exports = {
  workDir: workDir,
  input: input,
  // http://csv.adaltas.com/stringify/
  output: output,
  transform: function(row, fullPath) {
    if (row.length < 3) {
      return row;
    }

    var fileName = path.basename(fullPath);
    var fileNameNoExtension = fileName.replace('.hif', '');
    var fileParts = fileName.split('-');
    var chainId = fileParts[0];
    var schemaIdx = input.schema[chainId];

    var newRecord = {};
    _.each(schemaIdx, function(k, v) {
      newRecord[k] = row[v];
    });

    var theDate = moment(newRecord.PurchaseDateRaw, 'MM/DD/YYYY');

    newRecord.PurchaseDate = theDate.format("YYYY-MM-DD");
    newRecord.UPC = ('0000000000000' + newRecord.UPC).slice(-13);
    newRecord.Quantity = parseFloat(newRecord.Quantity || '1');
    newRecord.ChainId = chainId;
    newRecord.PurchasePrice = parseFloat((newRecord.PurchasePrice + '').replace(/[^\d.-]/g, '') || '0');
    newRecord.ExternalId = newRecord.ExternalId.replace(/^0+/, '') || '-noid';
    newRecord.Id = `${newRecord.ExternalId}__${theDate.format('YYYYMMDD')}__${newRecord.UPC}`;

    calculateSummary(newRecord);
    return newRecord;
  },
  getDestFiles: function(row) {
    var rst = [];
    var basePath = `${workDir}/out/${row.ChainId}/`;
    var prefix = row.ExternalId;
    var path1 = `${basePath}/loyalty/${prefix}/${row.PurchaseDate}.csv`;
    var path2 = `${basePath}/upc/${row.UPC}/${row.PurchaseDate}.csv`;
    var path3 = `${basePath}/store/${row.StoreNumber}/${row.PurchaseDate}.csv`;
    rst.push(path1);
    rst.push(path2);
    rst.push(path3);
    rst.push(path.join(basePath, `_all/${row.PurchaseDate}.csv`));
    return rst;
  },
  batchEnd: function(rows) {
    // console.log(JSON.stringify(allSummary, null, 2));
  },
  finally: function() {
    var endTime = new Date();
    // write out summary
    var payload = {
      startTime: moment(startTime).utc().format(),
      endTime: moment(endTime).utc().format(),
      duration: (endTime - startTime) / 1000
    };

    // for each purchate date tracked
    _.each(allSummary, function(v, k) {
      var basePath = `${workDir}/out/${v.all.ChainId}/_summary/`;
      mkdirp.sync(basePath);

      var file = path.join(basePath, `${k}.json`);
      var data = _.merge({}, payload, v);
      var outData = JSON.stringify(data, null, 2);
      console.log(outData);
      fs.writeFileSync(file, outData);
    });
    process.exit(0);
  }
}