
import express from 'express';
import Route from './route';
import _ from 'lodash';
import {pascalCase} from './utils';

import loadResourceInfos from './middlewares/load-resource-infos';
import genericResourceView from './generic';


export default class ResourceView {

    constructor(name, config, server) {
        this.name = name;
        this.config = config;
        this.router = express.Router(); // eslint-disable-line
        this.server = server;
        this.logger = this.server.logger;
        this._updateServerConfig();
    }

    get defaultMiddlewares() {
        return [
            loadResourceInfos(this)
        ];
    }

    get schema() {
        return this.config.schema;
    }

    get pathPrefix() {
        return this.config.pathPrefix || `/${this.name}`;
    }

    get policies() {
        var _policies = this.config.policies || [];
        if (typeof _policies === 'function') {
            _policies = _policies(this);
        }
        return _policies;
    }

    get middlewares() {
        var _middlewares = this.config.middlewares || genericResourceView.middlewares.concat(this.policies);
        return this.defaultMiddlewares.concat(_middlewares);
    }

    get genericRoutes() {
        return genericResourceView.routes;
    }

    /** return the related model class **/
    get Model() {
        return this.server.database[pascalCase(this.name)];
    }

    /** returns all the routes for the resource **/
    get routes() {
        var resourceRoutes = this.config.routes || {};

        var routes = [];
        var routeIds = [];
        Object.keys(resourceRoutes).forEach(routeName => {
            if (routeName[0] === '_') {
                this.logger.warn(`skipping private route: ${this.name}.${routeName}`);
                return;
            }
            let routeConfig = this.config.routes[routeName];
            if (routeConfig === false) {
                this.logger.warn(`disabling generic route: ${this.name}.${routeName}`);
                return;
            }
            let route = new Route(routeName, routeConfig, this);
            routes.push(route);
            routeIds.push(route.id);
        });

        Object.keys(this.genericRoutes).map((routeName) => {
            var routeConfig = resourceRoutes[routeName];
            if (routeConfig == null) {
                routeConfig = this.genericRoutes[routeName];
                let route = new Route(routeName, routeConfig, this);
                if (routeIds.indexOf(route.id) === -1) {
                    routes.push(route);
                    routeIds.push(route.id);
                } else {
                    this.logger.warn(`disabling generic route ${this.name}.${routeName} reason: "${route.id}" already taken`);
                }
            }
        });

        routes = _.sortBy(routes, 'path').reverse();
        return routes;
    }

    register() {
        this.logger.debug(`mounting ${this.server.config.apiPathPrefix}${this.pathPrefix}`);

        var _this = this;
        this.routes.forEach(function(route) {
            route.middlewares.forEach(function(middleware) {
                _this.router[route.method](route.path, middleware);
            });
            _this.logger.debug(`register route: ${route.method} ${route.path}`);
            _this.router[route.method](route.path, route.handler);
        });

        this.server.app.use(`${this.server.config.apiPathPrefix}${this.pathPrefix}`, _this.router);
    }

    /** update the server config with the resource's one (if specified in config) **/
    _updateServerConfig() {
        var configUpdater = this.config.config;
        if (configUpdater) {
            if (typeof configUpdater === 'function') {
                configUpdater(this.server.config, this);
            } else {
                Object.keys(configUpdater).forEach((key) => {
                    this.server.config[key] = configUpdater[key];
                });
            }
        }
    }

}