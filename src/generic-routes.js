
import _ from 'lodash';
import joi from 'joi';
import JsonApiBuilder from './plugins/eureka/json-api-builder';

var sync = function(request) {
    let {payload, Model} = request;

    return new Promise((resolve, reject) => {
        /**
         * if the payload is a string, try to parse it as a JSON
         */
        if (typeof payload === 'string') {
            try {
                payload = JSON.parse(payload);
            } catch (parseError) {
                return reject({
                    type: 'ParseError',
                    payload: payload,
                    error: parseError
                });
            }
        }

        /**
         * if the payload is an array, performs a batch sync
         */
        if (_.isArray(payload)) {
            Model.batchSync(payload).then((saved) => {
                return resolve(saved);
            }).catch((err) => {
                return reject({
                    type: 'ValidationError',
                    error: err.extra
                    // infos: {failedDocument: item}
                });
            });

        /**
         * if the payload is an object, perform a regular save
         */
        } else {
            let doc = {
                _type: payload.data.type
            };

            if (payload.id) {
                doc._id = payload.id;
            }

            if (payload.data.attributes) {
                doc = _.assign(doc, payload.data.attributes);
            }

            if (payload.data.relationships) {
                doc = _.assign(doc, payload.data.relationships);
            }

            Model.create(doc).save().then((savedObj) => {
                return resolve(savedObj);
            }).catch((err) => {
                return reject({
                    type: err.name,
                    error: err.extra,
                    infos: {failedDocument: payload}
                });
            });
        }
    });

};



/**
 * to disable eureka magic on a route,
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

            let builder = new JsonApiBuilder();
            let modelName = _.kebabCase(request.Model.name);
            let {db, apiBaseUri} = request;

            request.Model.find(queryFilter, queryOptions).then((collection) => {

                return builder.build(db, apiBaseUri, collection, {
                    include: request.query.include});

            }).then(({data, included}) => {

                let results = {
                    data: data,
                    links: {
                        self: `${apiBaseUri}/${modelName}`
                    }
                };

                if (included && included.length) {
                    results.included = included;
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


    fetch: {
        method: 'GET',
        path: `/{id}`,
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
            let builder = new JsonApiBuilder();

            let {db, apiBaseUri} = request;

            builder.build(db, apiBaseUri, request.pre.document, {
                include: request.query.include
            }).then(({data, included}) => {

                let links = data.links;
                delete data.links;

                let results = {
                    data: data,
                    links: links
                };

                if (included && included.length) {
                    results.included = included;
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
            let builder = new JsonApiBuilder();


            sync(request).then((data) => {

                let {db, apiBaseUri} = request;
                return builder.build(db, apiBaseUri, data);

            }).then((data) => {
                return reply.created(data);

            }).catch((err) => {

                if (err.type === 'ParseError') {
                    return reply.badRequest('The payload should be a valid JSON', {payload: err.payload, parseError: err.error});
                } else if (err.type === 'ValidationError') {
                    return reply.badRequest(
                        `${err.type}: ${err.error}`, err.infos);
                } else {
                    return reply.badImplementation(err);
                }

            });
        }
    },


    update: {
        method: ['PUT', 'POST', 'PATCH'],
        path: `/{id}`,
        handler: function(request, reply) {
            sync(request, function(err, data) {
                if (err) {
                    if (err.type === 'ParseError') {
                        return reply.badRequest('The payload should be a valid JSON', {payload: err.payload, parseError: err.error});
                    } else if (err.type === 'ValidationError') {
                        return reply.badRequest(err.error, err.infos);
                    } else {
                        return reply.badImplementation(err);
                    }
                }
                return reply.ok(data);
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
