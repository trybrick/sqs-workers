###*
 * Summary:
 *   Special helper to purge file matching particular pattern from s3.
###
require('dotenv').load();
config = require '../config'

AWS = require 'aws-sdk'

AWS.config.update({
  region: config.AWS_REGION,
  accessKeyId: config.AWS_ACCESS_KEY_ID,
  secretAccessKey: config.AWS_SECRET_ACCESS_KEY
})


client = new AWS.S3

bucket = 'brick-pos'
prefix = process.argv[2] or null

opener = if prefix
  "Removing all files starting with #{prefix} from #{bucket}"
else
  "Removing all files in #{bucket}"
console.log opener

progress = require('pace') 1
deleted = 0

die = (msg) ->
  console.error msg
  process.exit 1

next = (marker=null) ->
  query =
    Bucket: bucket
    Marker: marker
    Prefix: prefix
  client.listObjects query, (err, list) ->
    die err if err
    die 'No files found' if list.Contents.length == 0
    progress.total += list.Contents.length
    keys = (Key: item.Key for item in list.Contents when /(2016\-02\-09\.csv)$/gi.test(item.Key))
    marker = list.NextMarker or list.Contents[list.Contents.length - 1].Key
    contentLength = list.Contents.length

    cmd =
      Bucket: bucket
      Delete:
        Objects: keys
    # To break the stack and give Node a chance to do other things
    process.nextTick ->
      console.log  '\n\n\n', JSON.stringify(marker, null, 2)
      if list.IsTruncated
        next marker

        if keys.length <= 0
          console.log 'skipping', '\n\n\n'
          progress.op()
          return
        ###else
          # console.log 'good', '\n\n\n'
          deleted += keys.length
          progress.op deleted
        ###
      else
        console.log 'last', '\n\n\n'
        progress.op()

      # console.log JSON.stringify(cmd, null, 2)
      client.deleteObjects cmd, (err, result) ->
        die err if err
        deleted += result.Deleted.length
        progress.op deleted

next()