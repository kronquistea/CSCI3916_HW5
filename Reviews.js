var mongoose = require('mongoose');
var Schema = mongoose.Schema;

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB); // useNewUrlParser and useUnifiedTopology are no longer needed
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error); // Log the actual error object
    process.exit(1); // Exit the process if the connection fails (optional, but good practice)
  }
};

connectDB();

// Movie schema
const reviewSchema = new mongoose.Schema({
  movieId: { type: mongoose.Schema.Types.ObjectId, ref: 'Movie' },
  username: String,
  review: String,
  rating: { type: Number, min: 0, max: 5 }
});


// return the model
module.exports = mongoose.model('Review', reviewSchema);