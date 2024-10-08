const express = require('express');
const ProcessingRequest = require('../models/ProcessingRequest');
const { uploadToCloudRaw } = require('../services/imageProcessor'); 
const fs = require('fs');
const path = require('path');

const router = express.Router();

router.get('/status/:requestId', async (req, res) => {
  const { requestId } = req.params;

  try {
    const processingRequest = await ProcessingRequest.findOne({ requestId });

    if (!processingRequest) {
      return res.status(404).json({ message: 'Request not found' });
    }

    let csvUrl = null;
    console.log(processingRequest);
    if (processingRequest.status === "Completed") {
      const outputCSVPath = path.join(__dirname, '..', 'compressed_images', `output_${requestId}.csv`);


      if (fs.existsSync(outputCSVPath)) {
        console.log('CSV file found:', outputCSVPath);
        
        try {
          console.log('CSV uploaded to Cloudinary:', outputCSVPath);
          csvUrl = await uploadToCloudRaw(outputCSVPath);
          console.log('CSV uploaded to Cloudinary:', csvUrl);
        } catch (uploadError) {
          console.error('Error uploading CSV to Cloudinary:', uploadError);
          return res.status(500).json({ message: 'Error uploading CSV to Cloudinary' });
        }
      } else {
        console.warn('CSV file does not exist:', outputCSVPath);
        return res.status(404).json({ message: 'CSV file not found' });
      }
    } 

    res.json({
      requestId: processingRequest.requestId,
      status: processingRequest.status,
      outputCSVUrl: csvUrl, 
      outputImageUrls: processingRequest.outputImageUrls,
    });
  } catch (error) {
    console.error('Error retrieving processing request status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
