const express = require("express")
const listEndpoints = require("express-list-endpoints")
const moviesRouter = require("./movies")
var cors = require('cors')
const {
  badRequestHandler,
  notFoundHandler,
  genericErrorHandler,
} = require("./errorHandlers")
const {join} = require("path")

const publicFolderPath = join(__dirname, "../public");
const server = express()
server.use(express.static(publicFolderPath));
const whiteList =
  process.env.NODE_ENV === "production"
    ? [process.env.FE_URL_PROD]
    : [process.env.FE_URL_DEV]

const corsOptions = {
  origin: function (origin, callback) {
    if (whiteList.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error("UNAUTHORIZED- CORS ISSUES"))
    }
  },
}
server.use(cors(corsOptions)) 

const port = process.env.PORT || 3001

server.use(express.json())
server.use("/movies", moviesRouter)

server.use(badRequestHandler)
server.use(notFoundHandler)
server.use(genericErrorHandler)

console.log(listEndpoints(server))

server.listen(port, () => {
  console.log(`Server listening on port ${port}`)
})