const express = require("express")
const {
    check,
    validationResult
} = require("express-validator")
const uniqid = require("uniqid")
const multer = require("multer");
const {
    getmovies,
    writemovies
} = require("../lib/utilities")
const fs = require("fs")
const {
    writeFile,
    createReadStream
} = require("fs-extra")
const path = require("path")
const moviesRouter = express.Router()
const upload = multer({});
const axios = require("axios")
const sgMail = require("@sendgrid/mail")



const moviesValidation = [
    check("title").exists().withMessage("title is required!"),
    check("category").exists().withMessage("category is required!"),
    check("imdbID").exists().withMessage("id must be inserted")
]

const reviewsValidation = [
    check("rate").exists().withMessage("Rate is required!"),
    check("comment").exists().withMessage("Comment is required!"),
]
const fileReader = (file) => {
    const myPath = path.join(__dirname, file);
    const myFileAsBuffer = fs.readFileSync(myPath);
    const fileAsString = myFileAsBuffer.toString();
    return JSON.parse(fileAsString);
};


moviesRouter.get("/", async (req, res, next) => {
    try {
        const movies = await getmovies()

        if (req.query && req.query.category) {
            const filteredmovies = movies.filter(
                movie =>
                movie.hasOwnProperty("category") &&
                movie.category === req.query.category
            )
            res.send(filteredmovies)
        } else {
            res.send(movies)
        }
    } catch (error) {
        console.log(error)
        next(error)
    }
})

moviesRouter.get("/:movieId", async (req, res, next) => {
    try {
        const movies = await getmovies()

        const movieFound = movies.find(
            movie => movie.imdbID === req.params.movieId
        )

        if (movieFound) {
            res.send(movieFound)
        } else {
            const err = new Error()
            err.httpStatusCode = 404
            next(err)
        }
    } catch (error) {
        console.log(error)
        next(error)
    }
})

moviesRouter.post("/", moviesValidation, async (req, res, next) => {
    try {
        const validationErrors = validationResult(req)

        if (!validationErrors.isEmpty()) {
            const error = new Error()
            error.httpStatusCode = 400
            error.message = validationErrors
            console.log(error.message)
            next(error)
        } else {
            const movies = await getmovies()
            const newmovie = {
                ...req.body,
                createdAt: new Date(),
                updatedAt: new Date(),
                reviews: [],
            }

            movies.push(newmovie)
            await writemovies(movies)
            res.status(201).send(newmovie)
        }
    } catch (error) {
        console.log(error)
        next(error)
    }

})

const movieFolderPath = path.join(__dirname, "../../public/img/movies")

moviesRouter.post("/:id/upload", upload.single("moviePhoto"), async (req, res, next) => {
    try {
        const moviefile = fileReader("movies.json");

        await writeFile(
            path.join(movieFolderPath, req.file.originalname),
            req.file.buffer
        );
        const filteredFile = moviefile.filter((movie) => movie.imdbID !== req.params.id);
        const movie = await moviefile.filter((movie) => movie.imdbID === req.params.id);
        movie[0].image = `http://localhost:3001/img/movies/${req.file.originalname.toString()}`;
        console.log(movie[0].image)
        filteredFile.push(movie[0]);
        fs.writeFileSync(path.join(__dirname, "movies.json"), JSON.stringify(filteredFile));
        res.send("added");
    } catch (error) {
        console.log(error);
        next(error);
    }
});


moviesRouter.put(
    "/:movieId",
    moviesValidation,
    async (req, res, next) => {
        try {
            const validationErrors = validationResult(req)

            if (!validationErrors.isEmpty()) {
                const error = new Error()
                error.httpStatusCode = 400
                error.message = validationErrors
                next(error)
            } else {
                const movies = await getmovies()

                const movieIndex = movies.findIndex(
                    movie => movie.imdbID === req.params.movieId
                )

                if (movieIndex !== -1) {
                    const updatedmovies = [
                        ...movies.slice(0, movieIndex),
                        {
                            ...movies[movieIndex],
                            ...req.body
                        },
                        ...movies.slice(movieIndex + 1),
                    ]
                    await writemovies(updatedmovies)
                    res.send(updatedmovies)
                } else {
                    const err = new Error()
                    err.httpStatusCode = 404
                    next(err)
                }
            }
        } catch (error) {
            console.log(error)
            next(error)
        }
    }
)

moviesRouter.delete("/:movieId", async (req, res, next) => {
    try {
        const movies = await getmovies()

        const movieFound = movies.find(
            movie => movie.imdbID === req.params.movieId
        )

        if (movieFound) {
            const filteredmovies = movies.filter(
                movie => movie.imdbID !== req.params.movieId
            )

            await writemovies(filteredmovies)
            res.status(204).send()
        } else {
            const error = new Error()
            error.httpStatusCode = 404
            next(error)
        }
    } catch (error) {
        console.log(error)
        next(error)
    }
})


moviesRouter.get("/:imdbID/details", async (req, res, next) => {
    try {
        const movies = await getmovies()
        const response = await axios({
            method: "get",
            url: `http://www.omdbapi.com/?apikey=${process.env.IMDB_KEY}=${req.params.imdbID}`,
        });
        res.send(response.data)
    } catch (error) {
        console.log(error);
        next(error);
    }
});

moviesRouter.get("/:movieId/reviews", async (req, res, next) => {
    try {
        const movies = await getmovies()

        const movieFound = movies.find(
            movie => movie.imdbID === req.params.movieId
        )

        if (movieFound) {
            res.send(movieFound.reviews)
        } else {
            const error = new Error()
            error.httpStatusCode = 404
            next(error)
        }
    } catch (error) {
        console.log(error)
        next(error)
    }
})

moviesRouter.get("/:movieId/reviews/:reviewId", async (req, res, next) => {
    try {
        const movies = await getmovies()

        const movieFound = movies.find(
            movie => movie.imdbID === req.params.movieId
        )

        if (movieFound) {
            const reviewFound = movieFound.reviews.find(
                review => review._id === req.params.reviewId
            )
            if (reviewFound) {
                res.send(reviewFound)
            } else {
                const error = new Error()
                error.httpStatusCode = 404
                next(error)
            }
        } else {
            const error = new Error()
            error.httpStatusCode = 404
            next(error)
        }
    } catch (error) {
        console.log(error)
        next(error)
    }
})

moviesRouter.post(
    "/:movieId/reviews",
    reviewsValidation,
    async (req, res, next) => {
        try {
            const movies = await getmovies()

            const movieIndex = movies.findIndex(
                movie => movie.imdbID === req.params.movieId
            )
            if (movieIndex !== -1) {
                // movie found
                movies[movieIndex].reviews.push({
                    ...req.body,
                    _id: uniqid(),
                    elementId: req.params.movieId,
                    createdAt: new Date(),
                })
                await writemovies(movies)
                res.status(201).send(movies)
            } else {
                // movie not found
                const error = new Error()
                error.httpStatusCode = 404
                next(error)
            }
        } catch (error) {
            console.log(error)
            next(error)
        }
    }
)

moviesRouter.put(
    "/:movieId/reviews/:reviewId",
    reviewsValidation,
    async (req, res, next) => {
        try {
            const movies = await getmovies()

            const movieIndex = movies.findIndex(
                movie => movie.imdbID === req.params.movieId
            )

            if (movieIndex !== -1) {
                const reviewIndex = movies[movieIndex].reviews.findIndex(
                    review => review._id === req.params.reviewId
                )

                if (reviewIndex !== -1) {
                    const previousReview = movies[movieIndex].reviews[reviewIndex]

                    const updateReviews = [
                        ...movies[movieIndex].reviews.slice(0, reviewIndex),
                        {
                            ...previousReview,
                            ...req.body,
                            updatedAt: new Date()
                        },
                        ...movies[movieIndex].reviews.slice(reviewIndex + 1),
                    ]
                    movies[movieIndex].reviews = updateReviews
                    await writemovies(movies)
                    res.send(movies)
                } else {
                    console.log("Review not found")
                }
            } else {
                console.log("movie not found")
            }
        } catch (error) {
            console.log(error)
            next(error)
        }
    }
)

moviesRouter.delete(
    "/:movieId/reviews/:reviewId",
    async (req, res, next) => {
        try {
            const movies = await getmovies()

            const movieIndex = movies.findIndex(
                movie => movie.imdbID === req.params.movieId
            )

            if (movieIndex !== -1) {
                movies[movieIndex].reviews = movies[movieIndex].reviews.filter(
                    review => review._id !== req.params.reviewId
                )

                await writemovies(movies)
                res.send(movies)
            } else {}
        } catch (error) {
            console.log(error)
            next(error)
        }
    }
)


moviesRouter.get(
    "/media/sendCatalogue",
    async (req, res, next) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          const err = new Error();
          err.message = errors;
          err.httpStatusCode = 400;
          next(err);
        } else {
            if (req.query && req.query.title) {
                const response = await axios({
                    method: "get",
                    url: `http://www.omdbapi.com/?apikey=${process.env.IMDB_KEY}&s=${req.query.title}`,
                });
                const movies = await response.data;
                const titles=  movies.Search.map((element)=>element.Title)


                    sgMail.setApiKey(process.env.SENDGRID_API_KEY)
                    const msg = {
                      to: `simonacossailearning@gmail.com`,
                      from: "cossaisimona@gmail.com",
                      subject: "Netflix catalogue",
                      text: `Hi,here's your catalogue: ${titles}`,
                      html: `<strong>Hi,here's your catalogue: <p>${titles}</p></strong>`,
                    }
                    await sgMail.send(msg)
                console.log(titles);
                res.send(titles)

                }
          }
      } catch (error) {
        console.log(error);
        next(error);
      }
    }
  );
  


module.exports = moviesRouter