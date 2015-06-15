
export const allowedMethods = ['get', 'post', 'delete', 'put', 'head'];

import genericResource from './generic';
// import definePolicies from './utils/define-policies';


export default class Route {
    constructor(name, config, resource) {
        this.name = name;
        this.config = config;
        this.resource = resource;
        this.server = resource.server;
        this.app = resource.app; // eslint-disable-line
        this._validate();
    }

    _validate() {
        var routePathName = 'route';
        if (this.config._generic) {
            routePathName = `[generic].${this.name}`;
        } else {
            routePathName = `${this.resource.name}.${this.name}`;
        }
        if (!this.path) {
            throw `${routePathName}: path not found`;
        }

        if (!this.method) {
            throw `${routePathName}: method not found`;
        }

        if (allowedMethods.indexOf(this.method) === -1) {
            throw `${routePathName}: unknown method ${this.config.method}`;
        }


        if (!this.handler) {
            throw `${routePathName}: handler not found and unknown generic route name`;
        }
    }

    get config() {
        return this._config;
    }

    set config(config) {
        config.beforeHandler = config.beforeHandler || [];
        config.policies = config.policies || [];
        this._config = config;
    }

    /**
     * returns all inherited handlers
     *
     * @api public
     */
    get handlers() {
        return this.resource.beforeHandlers.concat(this.beforeHandler.concat([this.handler]));
    }


    get beforeHandler() {
        var middleware = this.config.beforeHandler;
        if (typeof middleware === 'function') {
            middleware = middleware(this.server, this.resource, this);
        }
        return middleware;
    }

    /**
     * Register the policies hook
     *
     * @api private
     * @TODO
     */
    // get policies() {
    //     return registerPolicies(this.config.policies);
    // }

    /**
     * Returns a registered middleware by its name
     *
     * @api public
     * @param {string} name - the name of the registered middleware
     */
    getMiddleware(middlewareName) {
        return this.server.getMiddleware(middlewareName);
    }



    /**
     * Registers the route
     *
     * @api public
     * @param {ExpressApplication} parentApp
     */
    mount(app) {
        app[this.method](this.fullPath, this.handlers);
    }


    /**
     * Returns the id of the route. A route ID is represented by its method
     * and its full path
     *
     * @api public
     */
    get id() {
        return `${this.method} ${this.fullPath}`;
    }


    get handler() {
        return this.config.handler || this._genericConfig.handler;
    }


    get path() {
        return this.config.path || this._genericConfig.path;
    }

    get fullPath() {
        return `${this.resource.fullPath}${this.path}`;
    }

    get method() {
        return this.config.method && this.config.method.toLowerCase() || this._genericConfig.method;
    }

    get _genericConfig() {
        return genericResource.routes[this.name] || {};
    }
}