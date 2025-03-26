const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/mauwinapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  family: 4
})
  .then(() => {
    console.log('Test connection: MongoDB connected successfully!');
    mongoose.connection.close(); // Close the connection
  })
  .catch((err) => {
    console.error('Test connection: Error connecting to MongoDB:', err);
  });