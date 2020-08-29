const express = require('express')
const mongoose = require('mongoose')
const app = express();
let server = require('http').createServer(app);
const WebSocket = require('ws');
const wss = new WebSocket.Server({server: server});
const session = require("express-session")
const connectStore = require("connect-mongo")
const sessionRouter = require("./routes/sessions")
const cors = require('cors')
const usersRouter = require("./routes/users")
const requestsRouter = require("./routes/requests")
const convoRouter = require('./routes/conversations')
const { Conversation } = require('./models/conversation')
require('dotenv').config();


const {PORT, NODE_ENV, MONGO_URI, SESS_NAME, SESS_SECRET, SESS_LIFETIME} = process.env;
(async () => {
try{
app.disable('x-powered-by'); //Hides info that the app is powered by express
app.use(express.urlencoded({ extended: true })); //Parses url-encoded bodies. Extended: true - The values of the object body can be of any type.
app.use(express.json()); //Parses JSON bodies

//Allows cross domain requests, credentials true is needed for the sessions to work
app.use(cors({origin: 'http://localhost:3000', allowedHeaders: 'Content-Type', credentials: true, methods: 'PUT, POST, PATCH, DELETE, GET'}))

mongoose.connect(MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true}); //Connect to Mongo database

const monConnection = mongoose.connection;

const convertURLtoQuery = (URL)=>{
  let params = new URLSearchParams(URL.slice(2));
  let token = params.get('token');
  return token;
}

let wsClients = {};
monConnection.once('open', ()=>{
  console.log('MongoDB Connected');

  const conversationsChangeStream = monConnection.collection('conversations').watch();
  conversationsChangeStream.on('change', data=>{
    if(data.operationType==='update'){
    let sentMessage = Object.values(data.updateDescription.updatedFields)[0];
    let {receiverId, senderId} = sentMessage;

    if(wsClients[receiverId]) wsClients[receiverId].send(JSON.stringify(sentMessage));
    }})
  
    wss.on('connection', function connection(ws, req) {
    let userId = convertURLtoQuery(req.url);
    wsClients[userId] = ws;
    console.log('websocket connected user: ' + userId);

    //Socket needs to be initiated when there is a change
  })
})
//Connect-mongo configuration
const MongoStore = connectStore(session);
const sessionStore = new MongoStore({mongooseConnection: monConnection, collection: 'sessions'}); 
app.use(session({
  name: SESS_NAME,
  secret: SESS_SECRET,
  rolling:true, //Saves a new session each time the user returns to the site
  resave: false, 
  saveUninitialized: false,
  store: sessionStore,
  cookie: {httpOnly: true, secure:NODE_ENV === 'production', maxAge: +SESS_LIFETIME} //https://owasp.org/www-community/HttpOnly - http only prevents the cookie from being accessed client side
}));

//Routes
app.use('/sessions' ,sessionRouter)
app.use('/users' ,usersRouter)
app.use('/requests' ,requestsRouter)
app.use('/conversations', convoRouter)

//Mongo Listener
//If time also add to the pipeline match requesterId or helperId







//Error handling
app.use((err, req, res, next) => {
  res.status(err.status || 500)
  res.send({error: {status: err.status || 500, message: err.message}})
});

//Connect to port 
server.listen(PORT, () => console.log('Listening on port ' + PORT));

}
catch (err) {console.log(err);}
})();