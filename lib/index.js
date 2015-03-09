var express = require('express');
var genericRoutes = require('./engine');
var _ = require('underscore');
var path = require("path");

/*
Exemple:

var Eurekapi = require('eurekapi');

var server = new Eurekapi({
    name: 'projectName',
    version: 1,
    host: '0.0.0.0'
    port: 4000,
    enableCORS: false,
    database: {
        adapter: 'rdf',
        config: {
            store: 'virtuoso',
            graphURI: 'http://projectName.com'
        }
    },
    schemas: require('./schemas'),
    customRoutes: [
        {method: 'delete', url: '/nugget', func: deleteNugget}
    ],
    publicDirectory: '/dist'
});
server.start();
 */


var Server = function(config) {
    this.config = config;
    if (!this.config.name) {
        throw 'EurekaServer: name is required';
    }
    this.apiVersion = this.config.version || 1;
    this.baseURI = this.config.baseURI || ("/api/" + config.version);
    this.applicationName = this.config.name;
    this.db = this.getDatabase();
    this.app = express();
    this.registerMiddlewares();

    var routesAdded = [];
    var routes = [];

    // add the custom routes
    if (this.config.customRoutes) {
        var customRoutes = _.sortBy(this.config.customRoutes, 'url').reverse();
        customRoutes.forEach(function(route) {
            routes.push(route);
            routesAdded.push(route.url);
        });
    }

    // add the generic routes only if the url hasn't already been added
    // useful to overwrite generic routes
    genericRoutes.forEach(function(route) {
        if (routesAdded.indexOf(route.url) === -1) {
            routes.push(route);
        }
    });

    // actually attach the routes to the app
    routes = _.sortBy(routes, 'url').reverse();
    var _this = this;
    routes.forEach(function(route) {
        _this.app[route.method]("" + _this.baseURI + route.url, route.func);
    });

    /** redirect all the non-api requests to the ember app **/
    _this.app['get']('/*', function(req, res) {
        return res.redirect('#'+req.url);
    });

};

// overload to add your owns middlewares
Server.prototype.registerMiddlewares = function() {
    // this.app.use("/app", express["static"]("" + (path.resolve('.')) + "/public"));
    if (this.config.publicDirectory) {
        var publicDirectoryPath = (path.resolve('.')) + this.config.publicDirectory;
        console.log('serving public directory from ', publicDirectoryPath);
        this.app.use("/", express["static"]("" + publicDirectoryPath));
    }
    // this.app.use("/", express["static"]("" + (path.resolve('.')) + "/backend/public"));
    this.app.use(express.urlencoded());
    this.app.use(express.json());
    var _this = this;
    this.app.use(function(req, res, next) {
        req.db = _this.db;
        req.applicationName = _this.applicationName;
        req.config = _this.config;
        return next();
    });

    // enable CORS if needed
    if (this.config.enableCORS) {
        var cors = require('cors');
        console.log("CORS is enabled");
        this.app.use(cors());
    }

    // error handling
    this.app.use(function(req, res, next) {
        var request = require('domain').create();
        request.add(req);
        request.add(res);
        request.on('error', function(er) {
            console.error('XXX Error', req.url, ':', er.message);
            try {
                res.json(500, {
                  error: er.message
                });
            } catch (_error) {
                res.writeHead(500);
                res.end('Error occurred, sorry.');
            }
            return next(er);
        });

        request.run(function() {
            return next();
        });
    });
};

// return the database instance
Server.prototype.getDatabase = function() {
    if (this.config.database === null) {
        throw 'EurekaServer: database is required';
    }
    if (this.config.database.dbtype !== undefined) {
        return this.config.database;
    }
    if (this.config.database.adapter === null) {
        throw 'EurekaServer: database adapter is required';
    }

    var Model = require("archimedes/lib/" + this.config.database.adapter + "/model");
    var models = {};
    var _ref = this.config.schemas;
    var modelInfos;
    for (var modelName in _ref) {
        modelInfos = _ref[modelName];
        if (modelName === 'Basic') {
            throw "EurekaServer: 'Basic' is a reserved word and can not be used as model name";
        }
        models[modelName] = Model.extend({
            schema: modelInfos.schema
        });
    }

    var Database = require("archimedes/lib/" + this.config.database.adapter + "/database");
    var db = new Database(this.config.database.config);
    db.registerModels(models);
    return db;
};

// start the server
Server.prototype.start = function(port, callback) {
    var host;
    if (!callback && typeof port === 'function') {
        callback = port;
        port = this.config.port;
    }
    if (!port) {
        port = this.config.port;
    }
    host = this.config.host || "0.0.0.0";
    console.log("starting http://" + host + ":" + port + "...");
    console.log("api accessible at http://" + host + ":" + port + this.baseURI);
    this.server = require('http').createServer(this.app);
    this.server.listen(port, callback);
 };

// stop the server
Server.prototype.stop = function(callback) {
    if (!this.server) {
        throw "Server not started";
    }
    this.server.close(callback);
};

module.exports = Server;
