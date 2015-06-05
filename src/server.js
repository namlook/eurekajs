
import express from 'express';
import http from 'http';
import requireDir from 'require-dir';
import _ from 'lodash';
import bunyan from 'bunyan';

import ResourceView from './resource';
import eurekaMiddlewares from './middlewares';

import ModelSchema from './utils/model-schema';

import archimedes from 'archimedes';

import {pascalCase} from './utils';

var eurekaBaseMiddleware = function(server) {
    return function baseMiddleware(req, res, next) {
        req.db = server.database;
        req.logger = server.logger;
        req.server = server;
        return next();
    };
};

export default class Server {

    constructor(config) {
        this.config = config;
        this.logger = bunyan.createLogger({name: this.config.name, level: this.config.logLevel});
        this.app = express();
        this.app.use(this.middlewares);

        this._registerRoutes();

        /** redirect all the non-api requests to the ember app **/
        this.app.get('/*', function(req, res) {
            return res.redirect('#' + req.url);
        });
    }

    get middlewares() {
        if (!this._middlewares) {
            var middlewares = this.config.middlewares || eurekaMiddlewares;
            if (typeof middlewares === 'function') {
                middlewares = middlewares(this);
            }
            this._middlewares = _.compact(middlewares.concat(eurekaBaseMiddleware(this)));
        }
        return this._middlewares;
    }

    start(callback) {
        this.logger.debug(this.config);
        this.server = http.createServer(this.app);
        this.server.listen(this.config.port, callback);
        this.logger.info(`application started at http://${this.config.host}:${this.config.port}`);
    }

    stop(callback) {
        if (!this.server) {
           throw 'Server not started';
        }
        this.server.close(callback);
    }

    get database() {
        if (!this._database) {
            if (this.config.database == null) {
                throw 'EurekaServer: database is required';
            }
            if (this.config.database.adapter == null) {
                throw 'EurekaServer: database adapter is required';
            }

            var Database = archimedes[this.config.database.adapter].Database;
            var Model = archimedes[this.config.database.adapter].Model;

            var models = {};
            var db = new Database(this.config.database.config);
            db.modelSchemas = {};
            Object.keys(this.config.schemas).forEach((modelName) => {
                if (modelName === 'Basic') {
                    throw "EurekaServer: 'Basic' is a reserved word and can not be used as model name"; //
                }

                let modelInfos = this.config.schemas[modelName];
                if (!modelInfos.properties) {
                    this.logger.warn(modelName, 'has no properties');
                }

                this.logger.debug('register model', pascalCase(modelName), '(with', Object.keys(modelInfos.properties).length, 'properties)');

                models[pascalCase(modelName)] = Model.extend({
                    schema: modelInfos.properties
                });

                // TODO put the following line in archimedes ?
                db.modelSchemas[pascalCase(modelName)] = new ModelSchema(modelInfos, db);

                this.config.resources[modelName].schema = modelInfos;
            });

            db.registerModels(models);
            this._database = db;
        }
        return this._database;
    }

    get _resourceViews() {
        var resources = this.config.resources;
        if (!resources) {
            throw 'config.resources not specified';
        }
        if (typeof resources === 'string') { // its the directory path
            return requireDir(resources);
        }
        return resources; // its the resources object
    }

    set config(config) {
        config.environment = process.env.NODE_ENV || 'devel';
        config.host = config.host || '0.0.0.0';
        config.port = config.port || 4000;
        config.version = config.version || 1;
        config.apiPathPrefix = config.baseURI || (`/api/${config.version}`);
        config.logLevel = config.logLevel || config.environment === 'production' && 'info' || 'debug';
        config.publicDirectoryPath = config.publicDirectory || '/dist';
        this._config = config;
    }

    get config() {
        return this._config;
    }

    _registerRoutes() {
        Object.keys(this._resourceViews).forEach(resourceViewName => {
            var resourceViewConfig = this._resourceViews[resourceViewName];
            var resourceView = new ResourceView(resourceViewName, resourceViewConfig, this);
            resourceView.register();
        });
    }
}