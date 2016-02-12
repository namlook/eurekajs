
import _ from 'lodash';
import {pascalCase} from '../../utils';
import Boom from 'boom';
import mimes from 'mime-types';
import requireDir from 'require-dir';
import path from 'path';

import Resource from './resource';

import Bcrypt from 'bcrypt';

import kue from 'kue';

import io from 'socket.io';

// import joi from 'joi';

// var queryOptionValidator = {
//     limit: joi.number().min(1),
//     offset: joi.number().min(0),
//     sort: joi.array().items(joi.string()),
//     fields: joi.array().items(joi.string()),
//     distinct: joi.boolean()
// };


/**
 * fill `reply` with Boom helpers
 */
var decoratePlugin = function(plugin) {

    _.forOwn(Boom, (fn, name) => {
        plugin.decorate('reply', name, function(message, data) {
            let boomError = fn(message);
            if (data) {
                boomError.output.payload.infos = data;
            }
            return this.response(boomError);
        });
    });

    plugin.decorate('reply', 'ok', function (results) {
        return this.response(results);
    });

    plugin.decorate('reply', 'created', function (results) {
        return this.response(results).code(201);
    });

    plugin.decorate('reply', 'accepted', function (results) {
        return this.response(results).code(202);
    });

    plugin.decorate('reply', 'noContent', function() {
        return this.response().code(204);
    });

    plugin.decorate('reply', 'jsonApi', function(results) {
        let {data, links, included} = results;
        return this.response({data, links, included})
                   .type('application/vnd.api+json');
    });


    plugin.ext('onPreResponse', function (request, reply) {

        var response = request.response;
        if (response.isBoom) {
            let payload = response.output.payload;
            var error = {
                title: payload.error,
                status: response.output.statusCode
            };

            if (payload.message) {
                error.detail = payload.message;
            }

            if (payload.infos) {
                error.meta = {infos: payload.infos};
            }

            response.output.payload = { errors: [error] };
            response.output.headers['content-type'] = 'application/vnd.api+json; charset=utf-8';
        }
        return reply.continue();
    });
};

var fillRequest = function(plugin) {

    /**
     * Fill the request with helpers:
     *  - request.resourceName
     *  - request.db
     *  - request.Model (if appropriated)
     */
    plugin.ext('onPostAuth', function(request, reply) {
        let db = request.server.plugins.eureka.database;
        let resourceName = _.get(request, 'route.settings.plugins.eureka.resourceName');
        let Model = db[pascalCase(resourceName)];

        if (Model) {
            request.Model = Model;
        }

        request.resourceName = resourceName;
        request.db = db;
        request.apiBaseUri = `${plugin.settings.app.apiRootPrefix}`;
        // request.pre.arf = 'foo';
        // console.log(request.route);
        // console.log(request.server.table()[0].table[2].settings);

        return reply.continue();
    });



    /**
     * Prefetch the document
     * If request.params.id and request.Model exist, fetch the document
     * and attach it to request.pre.document
     */
    plugin.ext('onPostAuth', function(request, reply) {
        if (request.Model && request.params.id) {

            request.Model.first({_id: request.params.id}).then((document) => {

                if (!document) {
                    return reply.notFound();
                }

                request.pre.document = document;
                return reply.continue();

            }).catch((err) => {
                return reply.badImplementation(err);
            });

        } else {
            return reply.continue();
        }
    });

    /**
     * allow to filter by id
     *
     */
    plugin.ext('onPostAuth', function(request, reply) {
        let {query, Model} = request;

        if (!Model) {
            return reply.continue();
        }

        let queryFilter = query.filter || {};
        if (queryFilter.id) {
            query.filter._id = query.filter.id;
            delete query.filter.id;
        }
        reply.continue();
    });


    // /**
    //  * extract filter from `request.query`, validate it against
    //  * the model properties and add it as `request.pre.queryFilter`
    //  */
    // plugin.ext('onPostAuth', function(request, reply) {
    //     let {query, Model} = request;

    //     if (!Model) {
    //         return reply.continue();
    //     }

    //     let queryFilter = query.filter || {};
    //     if (queryFilter.id) {
    //         queryFilter._id = queryFilter.id;
    //         delete queryFilter.id;
    //     }
    //     request.pre.queryFilter = queryFilter;
    //     // let {value, errors} = queryFilterValidator(db, Model.schema, queryFilter);

    //     // if (errors.length) {
    //     //     return reply.badRequest(errors[0]);
    //     // }

    //     // request.pre.queryFilter = value;

    //     // remove filter from query
    //     // request.query = _.omit(request.query, 'filter');

    //     reply.continue();
    // });


    // /**
    //  * extract options from `request.query`, validate them as jsonApi
    //  * and add them to `request.pre.queryOptions`
    //  */
    // plugin.ext('onPostAuth', function(request, reply) {
    //     let {query, Model} = request;
    //     if (!Model) {
    //         return reply.continue();
    //     }
    //     console.log('>>>', request);
    //     let queryOptions = _.omit(query, 'filter');

    //     // let {value: validatedOptions, error} = joi.validate(
    //     //     queryOptions, queryOptionValidator, {stripUnknown: true});

    //     // if (error) {
    //     //     let paths = error.details.map((i) => i.path);
    //     //     if (_.intersection(paths, ['fields', 'sort']).length) {
    //     //         if (queryOptions.fields && !_.isArray(queryOptions.fields)) {
    //     //             queryOptions.fields = queryOptions.fields.split(',');
    //     //         }

    //     //         if (queryOptions.sort && !_.isArray(queryOptions.sort)) {
    //     //             queryOptions.sort = queryOptions.sort.split(',');
    //     //         }

    //     //         let {value: validatedOptions2, error: error2} = joi.validate(
    //     //             queryOptions, queryOptionValidator, {stripUnknown: true});

    //     //         if (error2) {
    //     //             return reply.badRequest(error2);
    //     //         } else {
    //     //             validatedOptions = validatedOptions2;
    //     //         }
    //     //     }
    //     // }

    //     // /** check if all sortBy properties are specified in model **/
    //     // if (validatedOptions.sortBy) {
    //     //     var sortByProperties = validatedOptions.sortBy.split(',');
    //     //     for (let index in sortByProperties) {
    //     //         let propName = sortByProperties[index];
    //     //         propName = _.trimLeft(propName, '-');
    //     //         if (!Model.schema.getProperty(propName)) {
    //     //             return reply.badRequest(`sort: unknown property ${propName} for model ${Model.schema.name}`);
    //     //         }
    //     //     }
    //     // }


    //     // /** check if all fields properties are specified in model **/
    //     // if (validatedOptions.fields) {
    //     //     for (let index in validatedOptions.fields) {
    //     //         let propName = validatedOptions.fields[index];
    //     //         if (!Model.schema.getProperty(propName)) {
    //     //             return reply.badRequest(`fields: unknown property ${propName} for model ${Model.schema.name}`);
    //     //         }
    //     //     }
    //     // }

    //     // request.pre.queryOptions = validatedOptions;

    //     // remove model specific options from query
    //     // request.query = _.omit(request.query, _.keys(validatedOptions));

    //     reply.continue();
    // });
};


/**
 * set the authentification layer
 */
var setAuthentification = function(plugin) {

    let basicValidation = function(request, username, password, callback) {
        let db = plugin.plugins.eureka.database;
        // let UserModel = plugin.plugins.eureka.userModel;
        // let usernameField = plugin.plugins.eureka.usernameField;
        // let passwordField = plugin.plugins.eureka.passwordField;

        let UserModel = 'User';
        let usernameField = 'email';
        let passwordField = 'password';

        let query = {[usernameField]: username};

        db[UserModel].first(query).then((user) => {
            if (!user) {
                return callback(null, false);
            }

            Bcrypt.compare(password, user.get(passwordField), (compareErr, isValid) => {
                return callback(null, isValid, user.attrs());
            });

        }).catch((err) => {
            return callback(err);
        });
    };

    plugin.auth.strategy('simple', 'basic', {validateFunc: basicValidation});


    plugin.auth.strategy('token', 'jwt', {
        key: plugin.settings.app.secret,
        validateFunc: function(request, credentials, callback) {

            /**
             * process the scope
             */
            let scope = credentials.scope;


            scope = scope || [];

            if (!_.isArray(scope)) {
                scope = [scope];
            }

            scope = _.flatten(scope);

            /**
             * an authentificated user has the user scope by default
             */
            if (scope.indexOf('user') === -1) {
                scope.push('user');
            }

            credentials.scope = scope;

            return callback(null, true, credentials);
        }
    });
};

/**
 * process policies
 */
var initPolicies = function(plugin) {

    plugin.ext('onPreAuth', function(request, reply) {
        const access = _.get(request, 'route.settings.auth.access', []);
        if (!access.length) {
            return reply.continue();
        }

        var _scopes = access[0].scope.selection;

        if (!_scopes) {
            return reply.continue();
        }

        if (!_.isArray(_scopes)) {
            _scopes = [_scopes];
        }

        let policies = [];
        let scopes = [];

        for (let scope of _scopes) {
            // let scope = _scopes[index];
            if (_.contains(scope, ':')) {
                policies.push(scope);
            } else {
                scopes.push(scope);
            }
        }

        request.route.settings.plugins.eureka.policies = policies;

        if (scopes.length) {
            if (scopes.indexOf('admin') === -1) {
                scopes.push('admin'); // admin can always access to routes
            }
            // request.route.settings.auth.access.scope = scopes;
            request.route.settings.auth.access = [{scope: {selection: scopes}}];
        } else {
            // delete request.route.settings.auth.access.scope;
            delete request.route.settings.auth.access;
            // request.route.settings.auth.access = [];
        }

        reply.continue();
    });



    plugin.ext('onPreHandler', function(request, reply) {
        var _policies = _.get(request, 'route.settings.plugins.eureka.policies') || [];
        if (!_policies.length) {
            return reply.continue();
        }


        var credentials = request.auth.credentials;
        credentials.scope = credentials.scope || [];

        /**
         * if the user has 'admin' in his scope, is a superuser
         * let's get him in
         */
        if (credentials.scope.indexOf('admin') > -1) {
            return reply.continue();
        }

        /**
         * process prolicies
         */
        var policies = [];
        for (let index in _policies) {
            let policy = _policies[index];
            let match = policy.match(/(userId|userScope):doc\.(.+)/);

            if (match == null) {
                request.server.log(['error', 'eureka', 'policies'], `malformed policy ${policy}`);
                continue;
                // return reply.badImplementation(`malformed policy ${policy}`);
            }

            let [, key, propertyName] = match;

            if (key === 'userId') {
                key = '_id';
            } else if (key === 'userScope') {
                key = 'scope';
            }

            let credentialValues = _.get(credentials, key);

            if (!_.isArray(credentialValues)) {
                credentialValues = [credentialValues];
            }

            policies.push({propertyName, credentialValues});
        }

        /**
         * check the policies against the document
         * or fill the request.pre.queryFilter
         */
        var doc = request.pre.document;
        var queryFilter = request.pre.queryFilter;

        if(doc) {
            var hasAuthorization = false;

            for (let index in policies) {
                let {propertyName, credentialValues} = policies[index];

                let documentScopes = doc.get(propertyName);
                if (!_.isArray(documentScopes)) {
                    documentScopes = [documentScopes];
                }

                if (_.intersection(documentScopes, credentialValues).length) {
                    hasAuthorization = true;
                }
            }

            if (!hasAuthorization) {
                return reply.unauthorized("you don't have the authorization to access this document");
            }

        } else if(queryFilter) {
            var query = {};
            for (let index in policies) {
                let {propertyName, credentialValues} = policies[index];
                if (!query[propertyName]) {
                    query[propertyName] = [];
                }
                query[propertyName].push(credentialValues);
            }

            _.forOwn(query, (values, propertyName) => {
                values = _.flatten(values);
                if (values.length > 1) {
                    _.set(queryFilter, `${propertyName}.$in`, values);
                } else {
                    queryFilter[propertyName] = values[0];
                }
            });

        }
        return reply.continue();
    });

};

// var registerTasksBull = function(plugin, options) {
//     let redisInfos = options.serverConfig.redis;
//
//     plugin.log(['info', 'tasks'], `task runner need redis on ${redisInfos.host}:${redisInfos.port}`);
//
//     let tasks = {};
//     _.forOwn(options.serverConfig.tasks, (taskHandler, taskName) => {
//         plugin.log(['info', 'tasks'], `register task "${taskName}"`);
//
//         tasks[taskName] = function(data) {
//             let queue = Queue(taskName, redisInfos.port, redisInfos.host);
//             queue.clean(5000);
//
//             queue.on('cleaned', function (job, type) {
//                 plugin.log(['debug', 'tasks'], 'Cleaned ' + job.length + ' ' + type + ' jobs');
//             });
//
//             queue.on('ready', function() {
//                 plugin.log(['info', 'tasks'], 'the queue "'+taskName+'" is ready');
//             });
//
//             queue.on('complete', function(job) {
//                 plugin.log(['info', 'tasks'], '"'+taskName+'">', job.jobId, 'is complete');
//             });
//
//             queue.on('error', function(err) {
//                 plugin.log(['error', 'tasks'], '"'+taskName+'">', err);
//             });
//
//             queue.on('failed', function(job, err){
//                 plugin.log(['error', 'tasks'], taskName+'> the job ' + job.jobId + ' failed. Reason:' + err.message);
//                 console.error(err);
//                 console.error(err.stack);
//             });
//
//             let task = taskHandler(plugin, options);
//             queue.process(task);
//             queue.add(data);
//             return queue;
//         };
//     });
//     return tasks;
// };

var registerTasks = function(plugin, options) {
    let redisInfos = options.serverConfig.redis;

    let queue = kue.createQueue({
        redis: {
            port: redisInfos.port,
            host: redisInfos.host
        }
    });

    queue.on( 'error', function( err ) {
        plugin.log(['error', 'tasks'], err);
    });

    queue.on( 'enqueue', function() {
        plugin.log(['error', 'tasks'], 'enqueue');
    });


    plugin.log(['info', 'tasks'], `task runner need redis on ${redisInfos.host}:${redisInfos.port}`);

    let tasks = {};
    _.forOwn(options.serverConfig.tasks, (taskFn, taskName) => {
        let taskHandler = taskFn(plugin, options);
        let concurrency = 1;
        if (typeof taskHandler === 'object') {
            concurrency = taskHandler.concurrency;
            taskHandler = taskHandler.handler;
        }

        queue.process(taskName, concurrency, taskHandler);
        tasks[taskName] = function(data) {
            let job = queue.create(taskName, data)
            job.removeOnComplete(true);
            job.save();
            return job;
        };
        plugin.log(['info', 'tasks'], `register task "${taskName}"`);
    });

    return tasks;
};


var loadRoutes = function(plugin, options) {
    let routesDirectory = path.join(process.cwd(), 'backend/routes')
    let routes = requireDir(routesDirectory);
    for (let routeName in routes) {
        plugin.log(['info', 'eureka'], `mounting route "${routeName}"`);
        routes[routeName](plugin);
    }
};

var registerWebSocket = function(plugin, options) {

    var ws = io(plugin.listener);

    ws.on('connection', function (socket) {
        plugin.log(['debug', 'socket'], 'new connection from '+socket.handshake.address);
    });

    plugin.expose('websocket', ws);

};


var eurekaPlugin = function(plugin, options, next) {

    if (options.log) {
        options.log = _.isArray(options.log) && options.log || [options.log];

        plugin.on('log', function(message) {
            if (_.contains(message.tags, 'eureka')) {
                if (_.intersection(message.tags, options.log).length) {
                    console.log(message.tags, message.data);
                }
            }
        });
    }

    // register websocket first as there is no dependencies
    registerWebSocket(plugin);


    let db = plugin.plugins.archimedes.db;
    plugin.expose('database', db);
    // plugin.expose('userModel', 'User');
    // plugin.expose('usernameField', 'email');
    // plugin.expose('passwordField', 'password');


    let tasks = {};
    if (!_.isEmpty(options.serverConfig.tasks)) {
        tasks = registerTasks(plugin, options);
    }
    plugin.expose('tasks', tasks);

    loadRoutes(plugin);

    setAuthentification(plugin);
    decoratePlugin(plugin);
    fillRequest(plugin);
    initPolicies(plugin);



    /**
     * if config.auth is true, secure all routes
     * with an access token. If so, a User model
     * should be registered.
     */
    if (options.serverConfig.auth) {
        if (!plugin.plugins.archimedes.db.User) {
            return next('config.auth is enabled but no User model has been registered');
        }
        if (options.serverConfig.auth === true) {
            options.serverConfig.auth = {
                strategy: 'token',
                access: {
                    scope: ['admin']
                }
            };
        }
        plugin.log(['info', 'eureka'],
            `config.auth: locking all routes {strategy: "${options.serverConfig.auth.strategy}", scope: "${options.serverConfig.auth.access.scope.toString()}}"`);
        plugin.auth.default(options.serverConfig.auth);
    }


    /**
     * register resources
     */
    _.forOwn(options.resources, (resourceConfig, resourceName) => {
        let resource = new Resource(resourceName, resourceConfig, options.serverConfig, db);

        /**
         * Mounts routes
         */
        let routes = resource.routes;
        try {
            plugin.route(routes);
            plugin.log(['info', 'eureka'], `mounting resource "${resourceName}" (${routes.length} routes)`);
        } catch (e) {
            throw `error while mounting ${resourceName}. Reason: ${e}`;
        }

        /**
         * Loads methods
         */
        if (!_.isEmpty(resource.methods)) {
            try {
                plugin.method(resource.methods);
                plugin.log(['info', 'eureka'], `loading ${resourceName}'s methods`);
            } catch (e) {
                throw `error while loading ${resourceName}'s methods. Reason: ${e}`;
            }
        }
    });


    plugin.route({
        path: '/{param*}',
        method: 'GET',
        handler: function(request, reply) {
            var routePath = request.url.path;

            if (routePath === '/') {
                routePath = 'index.html';
            }

            if (mimes.lookup(routePath)) {
                return reply.file(`./${options.serverConfig.publicDirectory}/${routePath}`);
            } else if (!_.startsWith(routePath, request.apiBaseUri)) {
                return reply.redirect('/#' + routePath);
            }
            return reply.notFound();
        }
    });

    next();
};

eurekaPlugin.attributes = {
    name: 'eureka'
    // version: '1.0.0'
};

export default eurekaPlugin;
