
import Route from './route';
import _ from 'lodash';
import {pascalCase} from './utils';

import genericResource from './generic';


var baseResourceMiddleware = function(resource) {
    return function _baseResourceMiddleware(req, res, next) {
        req.resource = resource;
        req.Model = resource.Model;
        return next();
    };
};


/**
 * @class
 *
 */
export default class Resource {

    constructor(name, config, server) {
        this.name = name;
        this.config = config;
        this.server = server;
        this.logger = server.logger;
        this.app = server.app; // eslint-disable-line
        this.app.use(baseResourceMiddleware(this));
    }


    /**
     * Returns the path prefix
     *
     * @api public
     * @returns {string} The path prefix
     */
    get path() {
        let path = this.config.pathPrefix;
        if (path == null) {
            path = `/${this.name}`;
        } else if (path === '/') {
            path = '';
        }
        return path;
    }

    get fullPath() {
        return `${this.server.path}${this.path}`;
    }

    set config(config) {
        config.routes = config.routes || {};
        config.beforeHandlers = config.beforeHandlers || [];
        this._config = config;
    }

    get config() {
        return this._config;
    }

    get isPlugin() {
        return !!this.config._plugin;
    }

    /**
     * Returns the related model class
     *
     * @api public
     * @returns {Model} The model class
     */
    get Model() {
        return this.server.database[pascalCase(this.name)];
    }


    /**
     * Returns all the routes for the resource
     *
     * @api public
     * @returns {Route[]} The routes
     */
    get routes() {
        var routes = [];

        /**
         * to prevent overloading custom routes by generic routes,
         * we have to track the routes that have been already added
         */
        var routeIds = [];

        _.forOwn(this.config.routes, (routeConfig, routeName) => {
            if (routeName[0] === '_') {
                this.logger.warn(`skipping private route: ${this.name}.${routeName}`);
                return null;
            }

            if (routeConfig === false) {
                this.logger.warn(`disabling route: ${this.name}.${routeName}`);
                return null;
            }

            let route = new Route(routeName, routeConfig, this);
            routes.push(route);
            routeIds.push(route.id);
        });


        /**
         * Loading generic routes.
         * only attach them if there is a Model
         */
        if (this.Model) {
            _.forOwn(genericResource.routes, (routeConfig, routeName) => {
                let genericRoute = new Route(routeName, routeConfig, this);
                if (!_.contains(routeIds, genericRoute.id)) {
                    routes.push(genericRoute);
                    routeIds.push(genericRoute.id);
                } else {
                    this.logger.warn(`disabling generic route ${this.name}.${routeName} reason: "${genericRoute.id}" already taken`);
                }
            });

        }

        return _.sortBy(routes, 'path').reverse();
    }



    /**
     * returns all middlewares present in beforeHandlers hook
     *
     * @api private
     */
    get beforeHandlers() {
        var handlers = this.config.beforeHandlers;
        if (handlers) {
            if (typeof handlers === 'function') {
                handlers = handlers(this.server, this);
            }
        }
        return handlers;
    }


    mount(app) {
        let plugin = this.isPlugin && 'plugin ' || '';
        this.logger.debug(`mounting ${plugin}${this.name} on ${this.fullPath}`);


        /*** register routes ***/
        this.routes.forEach((route) => {
            route.mount(app);
        });
    }
}