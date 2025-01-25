const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const AWS = require("aws-sdk");

// Configuration
const config = {
  sourceUrl: "http://localhost:5000/output_videos/2025-01-25_playlist.m3u8", // Source HLS stream
  outputDir: "./temp_output", // Temporary directory for downloaded files
  bucketName: "pocrsibucket", // S3 bucket name
  folderName: "hls", // Folder name within S3 bucket
  deleteAfterSeconds: 240, // Time after which segments are deleted
  concurrency: 5, // Number of parallel downloads
};

// Initialize AWS S3
const s3 = new AWS.S3({
  region: "ap-south-1", // e.g., us-east-1
 
});

// Download HLS segments
async function downloadSegments(playlistUrl) {
  try {
    console.log(`Fetching playlist from ${playlistUrl}...`);
    const { data: playlist } = await axios.get(playlistUrl);

    // Parse the playlist to get segment URLs
    const lines = playlist.split("\n");
    const segmentUrls = lines.filter((line) => line && !line.startsWith("#"));

    console.log(`Found ${segmentUrls.length} segments.`);

    // Create temporary output directory
    await fs.ensureDir(config.outputDir);

    // Download each segment
    for (const segment of segmentUrls) {
      const segmentUrl = new URL(segment, playlistUrl).href;
      const segmentName = path.basename(segmentUrl);
      const outputPath = path.join(config.outputDir, segmentName);

      if (!fs.existsSync(outputPath)) {
        console.log(`Downloading ${segmentUrl}...`);
        const response = await axios.get(segmentUrl, { responseType: "stream" });
        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });
        console.log(`Downloaded ${segmentName}`);
        await uploadToS3(outputPath, config.folderName, segmentName);
      } else {
        console.log(`${segmentName} already exists. Skipping...`);
      }
    }

    console.log("All segments downloaded successfully.");
  } catch (error) {
    console.error("Error downloading segments:", error.message);
  }
}

// Upload files to S3
async function uploadToS3(filePath, folderName, fileName) {
  try {
    const fileContent = await fs.readFile(filePath);
    const key = `${folderName}/${fileName}`;

    await s3
      .upload({
        Bucket: config.bucketName,
        Key: key,
        Body: fileContent,
      })
      .promise();

    console.log(`Uploaded ${fileName} to S3 at ${key}.`);
    scheduleDeletion(filePath); // Schedule local deletion after upload
  } catch (error) {
    console.error(`Error uploading ${fileName} to S3:`, error.message);
  }
}

// Schedule file deletion after a specified time
function scheduleDeletion(filePath) {
  console.log(`Scheduling deletion of ${filePath} in ${config.deleteAfterSeconds} seconds.`);
  setTimeout(async () => {
    try {
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        console.log(`Deleted local file: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error deleting ${filePath}:`, error.message);
    }
  }, config.deleteAfterSeconds * 1000);
}

// Main function to start the service
async function startService() {
  console.log("Starting HLS Pull-Push Service...");
  while (true) {
    await downloadSegments(config.sourceUrl);
    console.log("Waiting for new segments...");
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds before re-checking playlist
  }
}

// Start the service
startService().catch((error) => console.error("Service error:", error.message));
