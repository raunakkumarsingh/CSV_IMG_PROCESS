const mongoose = require('mongoose');

const processingRequestSchema = new mongoose.Schema({
    requestId: String,
    productName: [String],
    inputImageUrls: [[String]], 
    outputImageUrls: [[String]],
    outputCSVUrls: String,
    status: { type: String, default: 'Not Started' }, 
    createdAt: { type: Date, default: Date.now }
  });
  
  module.exports = mongoose.model('ProcessingRequest', processingRequestSchema);
  
