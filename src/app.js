require("dotenv").config();
const { HLSPullPush, S3BucketOutput,MediaPackageOutput } = require("@eyevinn/hls-pull-push");

// Initialize the service
const pullPushService = new HLSPullPush();
//pullPushService.registerPlugin("s3", new S3BucketOutput());
pullPushService.registerPlugin("mediapackage", new MediaPackageOutput());
pullPushService.listen(process.env.PORT || 8080);

console.log("HLS Pull-Push service running!");
