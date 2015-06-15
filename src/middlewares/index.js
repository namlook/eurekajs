
import express from 'express';
import bodyParser from 'body-parser';
import compression from 'compression';
import favicon from 'serve-favicon';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';


import loadResponseHelpers from './load-response-helpers';

var errorHandlerMiddleware = function(err, req, res, next) { // eslint-disable-line
    req.logger.error(err.stack);
    return res.status(500).json({error: 'an error occured', stack: err});
};

// var errorHandlerMiddleware2 = function(req, res, next) {
//     var request = require('domain').create();
//     request.add(req);
//     request.add(res);
//     request.on('error', function(er) {
//         console.error('XXX Error', req.url, ':', er.message);
//         try {
//             res.json(500, {
//               error: er.message
//             });
//         } catch (_error) {
//             res.writeHead(500);
//             res.end('Error occurred, sorry.');
//         }
//         return next(er);
//     });

//     request.run(function() {
//         return next();
//     });
// };


var staticMiddleware = function(server) {
    var directoryPath = server.config.publicDirectoryPath;
    if (fs.existsSync(directoryPath)) {
        server.use('/', express.static(directoryPath));
    } else {
        server.logger.warn('static directory:', directoryPath, 'not found for /');
    }
};

var faviconMiddleware = function(server) {
    if (server.config.publicDirectoryPath) {
        var faviconPath = path.resolve('.', server.config.publicDirectoryPath, 'favicon.ico');
        if (fs.existsSync(faviconPath)) {
            server.use(favicon(faviconPath));
        } else {
            server.logger.warn('favicon not found at', faviconPath);
        }
    } else {
        server.logger.warn('publicDirectoryPath not specified in config');
    }
};

var morganMiddleware = function(server) {
    var logPath = path.resolve(__dirname, 'access.log');
    server.logger.info('log file in', logPath);
    var accessLogStream = fs.createWriteStream(logPath, {flags: 'a'});
    server.use(morgan('combined', {stream: accessLogStream}));
};


var corsMiddleware = function(server) {
    server.use(function(req, res, next) {
        if (server.config.enableCORS) {
          res.header('Access-Control-Allow-Origin', '*');
          res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        }
        return next();
    });
};


// passport.use(new BasicStrategy(
//     {},
//     function(userId, password, done) {
//         // Find the user by username.  If there is no user with the given
//         // username, or the password is not correct, set the user to `false` to
//         // indicate failure.  Otherwise, return the authenticated `user`.
//         server.db.User.first(userId, function(err, user) {
//             if (err) {
//                 return done(err);
//             }

//             if (!user) {
//                 return done(null, false);
//             }

//             if (user.password != password) { // TODO bcrypt and salt
//                 return done(null, false);
//             }

//             return done(null, user);
//         });
//     }
// ));




// export default function(server) {
//     console.log('---->', server.baseMiddlewares);
//     return [
//         faviconMiddleware(server),
//         staticMiddleware(server),
//         morganMiddleware(server),
//         corsMiddleware(server),
//         bodyParser.json(),
//         bodyParser.urlencoded({extended: true}), // parse with qs instead of node's querystring;
//         compression(),
//         loadResponseHelpers,
//         errorHandlerMiddleware
//         // passport.initialize()
//     ];
// }

export default function(server) {
    faviconMiddleware(server);
    staticMiddleware(server);
    morganMiddleware(server);
    corsMiddleware(server);
    server.use(bodyParser.json());
    server.use(bodyParser.urlencoded({extended: true})); // parse with qs instead of node's querystring;
    server.use(compression());
    server.use(loadResponseHelpers);
    server.use(errorHandlerMiddleware);
    // passport.initialize()
}



// export default function(server) {
//     return [
//         {favicon: faviconMiddleware(server)},
//         {static: staticMiddleware(server)},
//         {morgan: morganMiddleware(server)},
//         {cors: corsMiddleware(server)},
//         {bodyParserJson: bodyParser.json()},
//         {bodyParserForm: bodyParser.urlencoded({extended: true}), // parse with qs instead of node's querystring};
//         {compression: compression()},
//         {responseHelpers: loadResponseHelpers},
//         {errorHandler: errorHandlerMiddleware}
//         // passport.initialize()
//     ];
// }