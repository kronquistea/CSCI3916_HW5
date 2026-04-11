var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var mongoose = require('mongoose');
var User = require('./Users');
var Movie = require('./Movies');
var Review = require('./Reviews');

var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

function getJSONObjectForMovieRequirement(req) {
    var json = {
        headers: "No headers",
        key: process.env.SECRET_KEY,
        body: "No body"
    };

    if (req.body != null) {
        json.body = req.body;
    }

    if (req.headers != null) {
        json.headers = req.headers;
    }

    return json;
}

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, msg: 'Please include both username and password to signup.'})
    } else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;

        user.save(function(err){
            if (err) {
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists.'});
                else
                    return res.json(err);
            }

            res.json({success: true, msg: 'Successfully created new user.'})
        });
    }
});

router.post('/signin', function (req, res) {
    var userNew = new User();
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) {
            res.send(err);
        }

        user.comparePassword(userNew.password, function(isMatch) {
            if (isMatch) {
                var userToken = { id: user.id, username: user.username };
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json ({success: true, token: 'JWT ' + token, username: user.username});
            }
            else {
                res.status(401).send({success: false, msg: 'Authentication failed.'});
            }
        })
    })
});

router.route('/movies')
    .get(authJwtController.isAuthenticated, async (req, res) => {
      try {
        const includeReviews = req.query.reviews === "true";

        if (includeReviews) {
            const allMoviesWithReviews = await Movie.aggregate([
                {
                    $lookup: {
                        from: "reviews",
                        localField: "_id",
                        foreignField: "movieId",
                        as: "reviews"
                    }
                }
            ]);

            if (allMoviesWithReviews.length === 0) {
                return res.status(404).json({ success: false, message: 'No movies with reviews found.' }); // 404 Not Found
            }

            return res.json(allMoviesWithReviews)
        }
        else {
            const movies = await Movie.find({}); // Fetch all movies from the database
    
            return res.json(movies); // Return the movies as JSON
        }
      } 
      catch (err) {
        console.error(err); // Log the error
        res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
      }
    })
    .post(authJwtController.isAuthenticated, async (req, res) => {
      try {
        if(!req.body.actors || req.body.actors.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one actor is required.' }); // 400 Bad Request
        }
        else {
          const movie = new Movie(req.body); // Create a new movie with the request body

          await movie.save();

          res.status(201).json({ success: true, msg: 'Movie created successfully.', movie });
        }
      } 
      catch (err) {
        console.error(err); // Log the error
        res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
      }
    });

router.route('/movies/:id')
    .get(authJwtController.isAuthenticated, async (req, res) => {
      try{
        const id = req.params.id

        const includeReviews = req.query.reviews === 'true'; // Check if reviews should be included

        if (includeReviews) {
            const movieWithReviews = await Movie.aggregate([
                {
                    $match: { _id: new mongoose.Types.ObjectId(id) } // Match the movie by ID
                },
                {
                    $lookup: {
                        from: 'reviews', // The collection to join with
                        localField: '_id', // The field from the movies collection
                        foreignField: 'movieId', // The field from the reviews collection
                        as: 'reviews' // The name of the field to add to the movie document
                    },
                    $addFields: {
                        avgRating: { $avg: '$reviews.rating' }
                    },
                    $sort: { 
                        avgRating: -1 
                    }
                }
            ]);

            if (!movieWithReviews.length) {
                return res.status(404).json({ success: false, message: 'Movie With Reviews not found.' }); // 404 Not Found
            }

            res.json({ success: true, msg: "Movie With Reviews Found", movie: movieWithReviews[0] }); // Return the movie with reviews
        }
        else {
            const movie = await Movie.findById(req.params.id); // Find movie by title

            if (!movie) {
                return res.status(404).json({ success: false, message: 'Movie not found.' }); // 404 Not Found
            }

            res.json({ success: true, msg: "Movie Found", movie }); // Return the movie without reviews
        }
      } 
      catch (err) {
        console.error(err); // Log the error
        res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
      }
    })
    .put(authJwtController.isAuthenticated, async (req, res) => {
      try{
        const movie = await Movie.findByIdAndUpdate(req.params.id, req.body, {new: true, runValidators: true});

        if (!movie) {
          return res.status(404).json({ success: false, message: 'Movie not found.' }); // 404 Not Found
        }

        res.json({ success: true, msg: 'Movie updated successfully.', movie }); // Return success message
      } 
      catch (err) {
        console.error(err); // Log the error
        res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
      }
    })
    .delete(authJwtController.isAuthenticated, async (req, res) => {
      try{
        const movie = await Movie.findByIdAndDelete(req.params.id)

        if (!movie) {
          return res.status(404).json({ success: false, message: 'Movie not found.' }); // 404 Not Found
        }

        res.json({ success: true, msg: 'Movie deleted successfully.', movie }); // Return success message
      } 
      catch (err) {
        console.error(err); // Log the error
        res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
      }
    });

router.route('/movies/:movieId/reviews')
    .get(authJwtController.isAuthenticated, async (req, res) => {
        try {
            const { movieId } = req.params;

            if(!movieId) {
                return res.status(404).json({ success: false, message: 'Movie not found.' }); // 404 Not Found
            }

            const reviews = await Review.find({ movieId });

            if(!reviews || reviews.length === 0) {
                return res.status(404).json({ success: false, message: 'No reviews found for this movie.' }); // 404 Not Found
            }

            return res.json(reviews); // Return the reviews as JSON
        } 
        catch (err) {
            console.error(err); // Log the error
            res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
        }
    })
    .post(authJwtController.isAuthenticated, async (req, res) => {
        try {
            const { movieId } = req.params;
            const movie = await Movie.findById(movieId);
            
            if (!movie) {
                return res.status(404).json({ success: false, message: 'Movie not found.' }); // 404 Not Found
            }
            
            const review = new Review({ 
                movieId,
                username: req.body.username, // Use the authenticated user's username
                review: req.body.review,
                rating: req.body.rating
             });
            
            await review.save();

            await sendGAEvent(movie.title, movie.genre); // Send event to Google Analytics

            res.status(201).json({ success: true, msg: 'Review created successfully.', review });
        } 
        catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
        }
    })
    .delete(authJwtController.isAuthenticated, async (req, res) => {
        try {
            const { movieId } = req.params;
            
            if (!movieId) {
                return res.status(404).json({ success: false, message: 'Movie not found.' }); // 400 Bad Request
            }

            const review = await Review.deleteMany({ movieId }); // Delete all review associated with the movie

            res.json({ success: true, msg: 'Review deleted successfully.', review });
        } 
        catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' }); // 500 Internal Server Error
        }
    });

router.route('/reviews/:reviewId')
    .delete(authJwtController.isAuthenticated, async (req, res) => {
        try {
            const { reviewId } = req.params;

            const review = await Review.findByIdAndDelete(reviewId);

            if (!review) {
                return res.status(404).json({ success: false, message: 'Review not found.' });
            }

            res.json({ success: true, msg: 'Review deleted successfully.', review });
        } 
        catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' });
        }
    });

app.use('/', router);

const PORT = process.env.PORT || 8080; // Define PORT before using it
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app; // for testing only