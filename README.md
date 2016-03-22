# sqs-workers
Brick sqs worker for long running jobs.  The prefer worker for short job is AWS Lambda.

To Run:
```
node index.js 37667/queueName ./workers/(ftp-delete,pos-archive,etc...)
```
