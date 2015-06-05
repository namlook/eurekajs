
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
        server.app.use('/', express.static(directoryPath));
    } else {
        server.logger.warn('static directory:', directoryPath, 'not found for /');
    }
};

var faviconMiddleware = function(server) {
    if (server.config.publicDirectoryPath) {
        var faviconPath = path.resolve('.', server.config.publicDirectoryPath, 'favicon.ico');
        if (fs.existsSync(faviconPath)) {
            return favicon(faviconPath);
        } else {
            server.logger.warn('favicon not found at', faviconPath);
        }
    } else {
        server.logger.warn('publicDirectoryPath not specified in config');
    }
    return function(req, res, next){ next(); }; // return dummy middleware
};

var morganMiddleware = function(server) {
    var logPath = path.resolve(__dirname, 'access.log');
    server.logger.info('log file in', logPath);
    var accessLogStream = fs.createWriteStream(logPath, {flags: 'a'});
    return morgan('combined', {stream: accessLogStream});
};


var corsMiddleware = function(server) {
    return function(req, res, next) {
        if (server.config.enableCORS) {
          res.header('Access-Control-Allow-Origin', '*');
          res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        }
        return next();
    };
};


export default function(server) {
    return [
        faviconMiddleware(server),
        staticMiddleware(server),
        morganMiddleware(server),
        corsMiddleware(server),
        bodyParser.json(),
        bodyParser.urlencoded({extended: true}), // parse with qs instead of node's querystring;
        compression(),
        loadResponseHelpers,
        errorHandlerMiddleware
    ];
}
