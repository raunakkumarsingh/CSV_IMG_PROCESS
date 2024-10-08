const sharp = require('sharp');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
require('dotenv').config(); 

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function compressImage(imageUrl, outputPath) {
  try {

    const response = await axios({
      url: imageUrl,
      responseType: 'arraybuffer',
    });
    

    const compressedImagePath = path.resolve(outputPath);


    await sharp(response.data)
      .resize({ width: 800 }) 
      .toFile(compressedImagePath);


    return compressedImagePath;
  } catch (err) {
    console.error('Error compressing image:', err);
    throw err;
  }
}


async function uploadToCloud(filePath) {
  try {

    const result = await cloudinary.uploader.upload(filePath, {
      use_filename: true, 
      unique_filename: false, 
      overwrite: true 
    });
    

    return result.secure_url;
  } catch (err) {
    console.error('Error uploading to cloud:', err);
    throw err;
  }
}

async function uploadToCloudRaw(filePath) {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(filePath, { resource_type: 'raw' }, (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return reject(error);
        }
    
        // fs.unlink(filePath, (unlinkError) => {
        //   if (unlinkError) {
        //     console.error('Error deleting file after upload:', unlinkError);
        //   }
        // });
        resolve(result.secure_url);
      });
    });
  }

module.exports = { compressImage, uploadToCloud,uploadToCloudRaw};
