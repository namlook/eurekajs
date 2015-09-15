
import _ from 'lodash';
import joi from 'joi';
// import JsonApi from './plugins/eureka/json-api-builder';
import {resourceObjectLink} from './utils';

let jsonApiSchema = {
    data: joi.object().keys({
        id: joi.string(),
        type: joi.string().required(),
        attributes: joi.object(),
        relationships: joi.object()
    })
};

/**
 * to disable eureka's magic on a route,
 * just set `config.plugins.eureka = false`
 */

var routes = {

    find: {
        method: 'GET',
        path: '/',
        config: {
            validate: {
                query: {
                    token: joi.number(),
                    include: joi.alternatives().try(
                        joi.number(),
                        joi.string()
                    ).default(false)
                }
            }
        },
        handler: function(request, reply) {
            let {queryFilter, queryOptions} = request.pre;
            let {db, apiBaseUri, Model} = request;

            let include;
            if (request.query.include) {
                include = {properties: request.query.include, included: []};
            }

            let kebabModelName = _.kebabCase(request.Model.name);
            let results = {
                links: {
                    self: `${apiBaseUri}/${kebabModelName}`
                }
            };

            Model.find(queryFilter, queryOptions).then((collection) => {
                let jsonApiData = collection.map((instance) => {
                    return instance.toJsonApi(resourceObjectLink(apiBaseUri, instance), include);
                });

                results.data = jsonApiData.map((o) => o.data);

                /**
                 * fetch included if needed
                 */
                let includedPromises = [];
                if (include && include.included.length) {
                    includedPromises = include.included.map((doc) => {
                        return db[doc.type].fetch(doc.id);
                    });
                }

                return Promise.all(includedPromises);
            }).then((docs) => {
                if (docs.length) {
                    results.included = docs.map((o) => {
                        return o.toJsonApi(resourceObjectLink(apiBaseUri, o)).data;
                    });
                }

                return reply.ok(results);
            }).catch((error) => {
                if (error.name === 'ValidationError') {
                    return reply.badRequest(error, error.extra);
                }
                return reply.badImplementation(error);
            });
        }
    },

    fetchRelationships: {
        method: 'GET',
        path: '/{id}/relationships/{propertyName}',
        handler: function(request, reply) {
            let instance = request.pre.document;
            let propertyName = request.params.propertyName;
            let apiBaseUri = request.apiBaseUri;


            let resourceLink = resourceObjectLink(apiBaseUri, instance);
            let jsonApiData = instance.toJsonApi(resourceLink);

            let results;

            if (jsonApiData.data.relationships) {
                results = jsonApiData.data.relationships[propertyName];
            }

            if (!results) {
                return reply.notFound();
            }

            reply.ok(results);
        }
    },


    fetch: {
        method: 'GET',
        path: '/{id}/{relation?}',
        config: {
            validate: {
                query: {
                    include: joi.alternatives().try(
                        joi.number(),
                        joi.string()
                    ).default(false)
                }
            }
        },
        handler: function(request, reply) {
            let instance = request.pre.document;
            let propertyName = request.params.relation;
            let {db, apiBaseUri} = request;

            /** if a relation is specified in url,
             * then redirect and fetch this relation instead
             */
            if (propertyName) {
                // let value = instance.get(propertyName);
                // return routes.fetch.handler(request, reply);
                return reply.notImplemented();
            }

            let include;
            if (request.query.include) {
                include = {properties: request.query.include, included: []};
            }


            let results = instance.toJsonApi(resourceObjectLink(apiBaseUri, instance), include);

            /**
             * fetch included if needed
             */

            let includedPromises = [];
            if (include && include.included.length) {
                includedPromises = include.included.map((doc) => {
                    return db[doc.type].fetch(doc.id);
                });
            }

            Promise.all(includedPromises).then((docs) => {
                if (docs.length) {
                    results.included = docs.map((o) => {
                        return o.toJsonApi(resourceObjectLink(apiBaseUri, o)).data;
                    });
                }

                return reply.ok(results);
            }).catch((error) => {
                return reply.badImplementation(error);
            });
        }
    },


    count: {
        method: 'GET',
        path: `/i/count`,
        handler: function(request, reply) {
            let {queryFilter, queryOptions} = request.pre;
            request.Model.count(queryFilter, queryOptions).then((total) => {
                return reply.ok({data: total});
            }).catch((err) => {
                if (err.name === 'ValidationError') {
                    return reply.badRequest(err, err.extra);
                }
                return reply.badImplementation(err);
            });
        }
    },


    create: {
        method: 'POST',
        path: '/',
        handler: function(request, reply) {
            let {payload, Model, apiBaseUri} = request;

            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch (parseError) {
                    return reply.badRequest('The payload should be a valid JSON', {payload: payload, parseError: parseError});
                }
            }

            /** validate the jsonapi payload
             */
            // let builder = new JsonApiBuilder();
            let {error: validationError} = joi.validate(payload, jsonApiSchema);
            if (validationError) {
                return reply.badRequest('ValidationError', validationError);
            }


            /** build archimedes pojo from jsonapi data
             */
            let jsonApiData = payload.data;

            let doc = {
                _type: jsonApiData.type
            };

            if (jsonApiData.id) {
                doc._id = jsonApiData.id;
            }

            if (jsonApiData.attributes) {
                doc = _.assign(doc, jsonApiData.attributes);
            }

            if (jsonApiData.relationships) {
                doc = _.assign(doc, jsonApiData.relationships);
            }

            /** build a promise that will check the instance existance
             * if needed
             */
            let checkExistancePromise = new Promise((resolve) => {
                if (doc._id) {
                    Model.fetch(doc._id).then((docExists) => {
                        if (docExists) {
                            return reply.conflict(`${doc._id} already exists`);
                        }
                        return resolve();
                    });
                } else {
                    return resolve();
                }
            });

            /** fire the engine !
             */
            checkExistancePromise.then(() => {
                return Model.create(doc).save();
            }).then((data) => {
                let resourceLink = resourceObjectLink(apiBaseUri, data);
                let results = data.toJsonApi(resourceLink);
                return reply.created(results);
            }).catch((err) => {
                if (err.name === 'ValidationError') {
                    return reply.badRequest(
                        `${err.name}: ${err.extra}`, {failedDocument: payload});
                } else {
                    return reply.badImplementation(err);
                }
            });
        }
    },


    update: {
        method: ['PATCH'],
        path: `/{id}`,
        handler: function(request, reply) {
            let {payload, apiBaseUri} = request;

            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch (parseError) {
                    return reply.badRequest('The payload should be a valid JSON', {payload: payload, parseError: parseError});
                }
            }

            // let jsonApi = new JsonApiBuilder();
            let {error: validationError} = joi.validate(payload, jsonApiSchema);
            if (validationError) {
                return reply.badRequest('malformed payload', validationError);
            }

            let jsonApiData = payload.data;
            let instance = request.pre.document;

            if (jsonApiData.attributes) {
                _.forEach(jsonApiData.attributes, (value, propertyName) => {
                    instance.set(propertyName, value);
                });
            }

            if (jsonApiData.relationships) {
                _.forEach(jsonApiData.relationships, (value, propertyName) => {
                    if (_.isArray(value.data)) {
                        value = value.data.map((item) => {
                            return {_id: item.id, _type: item.type};
                        });
                    } else {
                        value = {_id: value.data.id, _type: value.data.type};
                    }
                    instance.set(propertyName, value);
                });
            }

            instance.save().then((savedDoc) => {
                let resourceLink = resourceObjectLink(apiBaseUri, savedDoc);
                let results = savedDoc.toJsonApi(resourceLink);
                return reply.ok(results);
            }).catch((error) => {
                if (error.name === 'ValidationError') {
                    return reply.badRequest(
                        `${error.name}: ${error.extra}`, {failedDocument: payload});
                } else {
                    return reply.badImplementation(error);
                }
            });
        }
    },


    updateRelationships: {
        method: 'PATCH',
        path: '/{id}/relationships/{propertyName}',
        handler: function(request, reply) {
            let instance = request.pre.document;
            let propertyName = request.params.propertyName;

            let {payload} = request;

            if (typeof payload === 'string') {
                try {
                    payload = JSON.parse(payload);
                } catch (parseError) {
                    return reply.badRequest('The payload should be a valid JSON', {payload: payload, parseError: parseError});
                }
            }

            let value;
            if (_.isArray(payload.data)) {
                value = payload.data.map((item) => {
                    return {_id: item.id, _type: item.type};
                });
            } else {
                value = {_id: payload.data.id, _type: payload.data.type};
            }
            instance.set(propertyName, value);

            instance.save().then(() => {
                return reply.noContent();
            }).catch((error) => {
                if (error.name === 'ValidationError') {
                    return reply.badRequest(
                        `${error.name}: ${error.extra}`);
                } else {
                    return reply.badImplementation(error);
                }
            });
        }
    },


    delete: {
        method: 'DELETE',
        path: `/{id}`,
        handler: function(request, reply) {
            request.pre.document.delete().then(() => {
                return reply.noContent();
            }).catch((err) => {
                return reply.badImplementation(err);
            });
        }
    },


    groupBy: {
        method: 'GET',
        path: '/i/group-by/{property}',
        handler: function(request, reply) {
            let {Model} = request;

            let property = request.params.property;

            let {queryFilter} = request.pre;

            Model.groupBy(property, queryFilter).then((data) => {
                return reply.ok({data: data});
            }).catch((err) => {
                if (err.name === 'ValidationError') {
                    return reply.badRequest(err.message, err.extra);
                }
                return reply.badImplementation(err);
            });
        }
    },


    stream: {
        method: 'GET',
        path: '/i/stream/{format}',
        handler: function(request, reply) {
            return reply.notImplemented();

            // return reply(Model.stream(queryFilter, queryOptions))

            // return reply.ok(request.pre.total);

            // var Model = req.Model;
            // var {format, total, asJSONArray} = req.attrs;
            // var {query, options} = req.parsedQuery;

            // options.sortBy = [];

            // var getData = function(opt, callback) {
            //     query = _.clone(query);
            //     opt = _.clone(opt);

            //     Model.find(query, opt, function(_err, results) {
            //         if (_err) {
            //             if (_err.message != null) {_err = _err.message; }
            //             req.logger.error({error: _err});
            //             return callback({error: _err, query: query, options: opt });
            //         }

            //         var items;
            //         if (format === 'json') {
            //             items = results.map(function(o) {
            //                 return o.toJSON({
            //                     populate: opt.populate,
            //                     dereference: true
            //                 });
            //             });
            //         } else if (format === 'csv') {
            //             items = results.map(function(o) {
            //                 return o.toCSV({
            //                     delimiter: opt.delimiter,
            //                     fields: opt.fields
            //                 });
            //             });
            //         }

            //         if (format === 'json' && asJSONArray) {
            //             if (opt.__index === 0) {
            //                 res.write(items.join(',\n'));
            //             } else {
            //                 if (items.length) {
            //                     res.write(',' + items.join(',\n'));
            //                 } else {
            //                     req.logger.error('something wrong, no items for', opt);
            //                 }
            //             }
            //         } else {
            //             res.write(items.join('\n') + '\n');
            //         }

            //         return callback(null, 'ok');

            //     });
            // };

            // var tripOptions = [];
            // if (options.limit) {
            //     total = options.limit;
            // }
            // var bulkLimit = 100;
            // var nbTrip = Math.round(total / bulkLimit);
            // if (total < bulkLimit) {
            //     bulkLimit = total;
            // }

            // var _options;
            // for (var i = 0; i <= nbTrip; i++) {
            //     _options = _.clone(options);
            //     _options.limit = bulkLimit;
            //     _options.offset = bulkLimit * i;
            //     _options.__index = i;
            //     tripOptions.push(_options);
            // }

            // var fileExtension = format;
            // if (format === 'csv' && options.delimiter === '\t') {
            //     fileExtension = 'tsv';
            // }

            // res.attachment(`${req.resource.name}.${fileExtension}`);
            // // res.setHeader('Content-Type', 'application/json');
            // // res.setHeader('Content-Type', 'text/html');

            // if (format === 'csv') {
            //     var csvHeader = new Model().toCSVHeader({fields: options.fields});
            //     res.write(csvHeader + '\n');
            // } else if (format === 'json' && asJSONArray) {
            //     res.write('[');
            // }

            // async.eachSeries(tripOptions, getData, function(asyncErr){
            //     if (asyncErr) {
            //         if (asyncErr.message != null) {asyncErr = asyncErr.message; }
            //         req.logger.error({error: asyncErr});
            //     }
            //     if (format === 'json' && asJSONArray) {
            //         res.write(']');
            //     }
            //     res.end('');
            // });



        },
        config: {
            validate: {
                params: {
                    format: joi.string().only('json', 'csv', 'tsv').label('format')
                },
                query: {
                    asJsonArray: joi.boolean()
                }
            },
            pre: [
                {assign: 'total', method: function(request, reply) {
                    let {Model} = request;
                    let {queryFilter, queryOptions} = request.pre;

                    // count will modify the query and options so we have to clone them
                    // TODO sanitize this in archimedes

                    let query = _.cloneDeep(queryFilter);
                    let options = _.cloneDeep(queryOptions);

                    Model.count(query, options, function(err, total) {
                        if (err) {
                            return reply.badImplementation(err);
                        }

                        if (options.populate) {
                            if (total >= 5000) {
                                return reply.entityTooLarge('The response has to many results (>5000). Try to narrow down your query');
                            }
                        } else {
                            if (total >= 10000) {
                                return reply.entityTooLarge('The response has to many results (>10000). Try to narrow down your query');
                            }
                        }

                        reply(total);
                    });
                }}
            ]
        }
    }
};

routes.all = _.values(routes);
export default routes;
