const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { compressImage, uploadToCloud } = require('../services/imageProcessor'); 
const ProcessingRequest = require('../models/ProcessingRequest');
const axios = require('axios');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

let progressMap = {}; 


function extractUrl(rawUrl) {
  const match = rawUrl.match(/(http[s]?:\/\/.*?)(\s|\()/);
  return match ? match[1] : rawUrl;
}

function generateOutputCSV(results, requestId, outputDir) {
  const outputCSVPath = path.join(outputDir, `output_${requestId}.csv`);
  const csvHeaders = ['SNO', 'Product Name', 'Input Image Urls', 'Output Image Urls'];

  const csvRows = results.map(row =>
    `${row['SNO']},${row['Product Name']},${row['Input Image Urls']},${row['Output Image Urls']}`
  ).join('\n');

  const csvContent = `${csvHeaders.join(',')}\n${csvRows}`;

  fs.writeFileSync(outputCSVPath, csvContent);
  return outputCSVPath;
}

async function processImages(requestId, results) {
  try {
    const outputDir = path.join(__dirname, '..', 'compressed_images');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const totalImages = results.reduce((sum, row) => sum + row['Input Image Urls'].split(',').length, 0);
    let processedImages = 0;

    for (let i = 0; i < results.length; i++) {
      const row = results[i];
      const inputUrls = row['Input Image Urls'].split(',');

      const compressedUrls = await Promise.all(
        inputUrls.map(async (url, idx) => {
          const outputPath = path.join(outputDir, `compressed_${requestId}_${i}_${idx}.jpg`);
          await compressImage(url, outputPath); 
          const cloudUrl = await uploadToCloud(outputPath); 
          await unlinkAsync(outputPath);
          processedImages++;
          progressMap[requestId] = Math.round((processedImages / totalImages) * 100); 
          return cloudUrl; 
        })
      );

      // Store the compressed URLs in the results
      row['Output Image Urls'] = compressedUrls.join(',');
    }

    const outputCSVPath = generateOutputCSV(results, requestId, outputDir);

  
    await ProcessingRequest.updateOne({ requestId }, {
      $set: {
        status: 'completed',
        outputImageUrls: results.map(row => row['Output Image Urls'].split(',')),
        outputCSVLink: `/downloads/${path.basename(outputCSVPath)}`
      }
    });

    delete progressMap[requestId]; 


    // await axios.post('http://your-webhook-endpoint.com/webhook', { requestId, downloadLink: `/downloads/${path.basename(outputCSVPath)}` }); 

    console.log('Processing complete. Output CSV generated at:', outputCSVPath);
    await ProcessingRequest.updateOne({ requestId }, { $set: { status: 'Completed' } });

  } catch (error) {
    console.error(`Error processing images for requestId ${requestId}:`, error);
    await ProcessingRequest.updateOne({ requestId }, { $set: { status: error } });
  }
}


router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const results = [];
  const requestId = new mongoose.Types.ObjectId().toString();

  const fileStream = fs.createReadStream(req.file.path);
  progressMap[requestId] = 0; 

  fileStream
    .pipe(csv())
    .on('data', (data) => {
      if (data['Input Image Urls']) {
        data['Input Image Urls'] = data['Input Image Urls'].split(',').map(url => extractUrl(url.trim())).join(',');
      }
      results.push(data);
    })
    .on('error', (err) => res.status(500).json({ message: 'Error reading CSV file' }))
    .on('end', async () => {
      try {

        if (!results.every(row => row['Product Name'] && row['Input Image Urls'])) {
          return res.status(400).json({ message: 'Invalid CSV format' });
        }


        await ProcessingRequest.create({
          requestId,
          productName: results.map(r => r['Product Name']),
          inputImageUrls: results.map(r => r['Input Image Urls'].split(',')),
          status: 'pending',
        });

 
        processImages(requestId, results).catch(err => console.error("Error during image processing:", err));

  
        res.json({ requestId });
      } finally {
 
        await unlinkAsync(req.file.path);
      }
    });
});

module.exports = router;
