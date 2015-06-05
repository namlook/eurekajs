
export const allowedMethods = ['get', 'post', 'delete', 'put', 'head'];


export default class Route {
    constructor(name, config, resourceView) {
        this.name = name;
        this.config = config;
        this._resourceView = resourceView;
        this._validate();
    }

    _validate() {
        var routePathName = `${this._resourceView.name}.${this.name}`;
        if (!this.path) {
            throw `${routePathName} path not found`;
        }

        if (!this.method) {
            throw `${routePathName} method not found`;
        }

        if (allowedMethods.indexOf(this.method) === -1) {
            throw `${routePathName} unknown method ${this.config.method}`;
        }

        if (!this.action) {
            throw `${routePathName} action not found and unknown generic route name`;
        }
    }

    get id() {
        return `${this.method} ${this.path}`;
    }

    get isGeneric() {
        return this.genericConfig.action && this.config.action == null;
    }

    get genericConfig() {
        return this._resourceView.genericRoutes[this.name] || {};
    }

    get action() {
        return this.config.action || this.genericConfig.action;
    }

    get path() {
        return this.config.path || this.genericConfig.path;
    }

    get method() {
        return this.config.method && this.config.method.toLowerCase() || this.genericConfig.method;
    }

    get policies() {
        var _policies = this.config.policies || [];
        if (typeof _policies === 'function') {
            _policies = _policies(this);
        }
        if (!this.isGeneric) {
            return _policies;
        }
        return this.genericConfig.policies.concat(_policies);
    }

    get middlewares() {
        return this.config.middlewares || this._resourceView.middlewares.concat(this.policies);
    }
}