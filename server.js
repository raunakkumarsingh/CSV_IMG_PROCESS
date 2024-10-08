
const express = require('express');
const mongoose = require('mongoose');
const uploadRoute = require('./routes/upload');
const statusRoute = require('./routes/status');
require('dotenv').config();
const app = express();
const PORT = 5000;

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
});

app.use(express.json());
app.use('/api', uploadRoute);
app.use('/api', statusRoute);


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
