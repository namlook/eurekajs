
import express from 'express';
import http from 'http';
import requireDir from 'require-dir';
import _ from 'lodash';
import bunyan from 'bunyan';

import Resource from './resource';
// import eurekaMiddlewares from './middlewares';

import ModelSchema from './utils/model-schema';

import archimedes from 'archimedes';

import {pascalCase} from './utils';

/**
 * the base middleware which will be present in all routes
 *
 * @api private
 * @param {Server} server
 */
var eurekaBaseMiddleware = function(server) {
    return function baseMiddleware(req, res, next) {
        req.db = server.database;
        req.logger = server.logger;
        req.server = server;
        req.attrs = {};
        return next();
    };
};

/**
 * @class
 */
export default class Server {

    constructor(config) {
        this.config = config;
        this.logger = bunyan.createLogger({name: this.config.name, level: this.config.logLevel});
        this.app = express();
        this.app.use(eurekaBaseMiddleware(this));
    }

    get path() {
        return this.config.apiPathPrefix; // TODO CHANGE THAT
    }

    use(middleware) {
        this.app.use(middleware);
    }

    /**
     * Registers some plugins
     *
     * @api public
     * @param {Object|Array.<Object>} plugins - the plugin should take the
     *      form of {name: fn}
     */
    registerPlugins(plugins) {
        // TODO
        if (!_.isArray(plugins)) {
            plugins = [plugins];
        }

        plugins.forEach((plugin) => {
            if (typeof plugin === 'object') {
                _.forOwn(plugin, (pluginFn) => {
                    let {resources, schemas} = pluginFn(this);
                    _.forOwn(resources, (conf) => {
                        conf._plugin = true;
                    });
                    _.assign(this.config.resources, resources);
                    _.assign(this.config.schemas, schemas);
                });
            } else {
                throw `plugins should be an object: {name: fn}`;
            }
        });
    }


    /**
     * Registers all the routes defined from the resources into the
     * expres application
     *
     * @api public
     * @params {Object} app - the express application (this.app)
     */
    mount() {
        _.forOwn(this._resourcesConfig, (resourceConfig, resourceName) => {
            if (resourceName[0] === '_') {
                this.logger.warn(`skipping private resource: ${resourceName}`);
            } else {
                let resource = new Resource(resourceName, resourceConfig, this);
                resource.mount(this.app);
            }
        });

        /** redirect all the non-api requests to the ember app **/
        // this.app.get('/*', function(req, res) {
        //     return res.redirect('#' + req.url);
        // });
    }

    /**
     * Mounts all routes and starts the server
     *
     * @api public
     * @param {callback} [callback]
     */
    start(callback) {
        // this.prepare();
        this.mount();
        this.logger.debug(this.config);
        this._httpServer = http.createServer(this.app);
        this._httpServer.listen(this.config.port, callback);
        this.logger.info(`application started at http://${this.config.host}:${this.config.port}`);
    }


    /**
     * Stop the server
     *
     * @api public
     * @param {callback} [callback]
     */
    stop(callback) {
        if (!this._httpServer) {
           throw 'Server not started';
        }
        this._httpServer.close(callback);
    }


    /**
     * Returns the database with the model defined in schema registered
     *
     * @api public
     * @returns the database
     */
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
            Object.keys(this.config.schemas).forEach((modelName) => {
                var modelNamePascalCase = pascalCase(modelName);

                if (modelName === 'Basic') {
                    throw "EurekaServer: 'Basic' is a reserved word and can not be used as model name"; //
                }

                let modelInfos = this.config.schemas[modelName];
                if (!modelInfos.properties) {
                    this.logger.warn(modelName, 'has no properties');
                }

                this.logger.debug('register model', modelNamePascalCase, '(with', Object.keys(modelInfos.properties).length, 'properties)');

                models[modelNamePascalCase] = Model.extend({
                    schema: modelInfos.properties
                });

                // TODO put the following line in archimedes ?
                models[modelNamePascalCase].schema = new ModelSchema(modelNamePascalCase, modelInfos, db);
            });

            db.registerModels(models);
            this._database = db;
        }
        return this._database;
    }


    /**
     * Fill the configuration with default values
     *
     * @api public
     * @param {Object} config - the configuration object
     */
    set config(config) {
        config.environment = process.env.NODE_ENV || 'devel';
        config.host = config.host || '0.0.0.0';
        config.port = config.port || 4000;
        config.version = config.version || 1;
        config.apiPathPrefix = config.baseURI || (`/api/${config.version}`);
        config.logLevel = config.logLevel || config.environment === 'production' && 'info' || 'debug';
        config.publicDirectoryPath = config.publicDirectory || '/dist';
        config.middlewares = config.middlewares || [];
        this._config = config;
    }


    /**
     * Returns the server configuration object
     *
     * @api public
     * @returns the configuration object
     */
    get config() {
        return this._config;
    }


    /*
     *    Private methods
     */


    /**
     * Returns all the resource configurations
     *
     * @api private
     * @returns the resource configurations
     */
    get _resourcesConfig() {
        var resources = this.config.resources;
        if (!resources) {
            throw 'config.resources not specified';
        }
        if (typeof resources === 'string') { // its the directory path
            return requireDir(resources);
        }
        return resources; // its the resources object
    }


}