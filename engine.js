
var _ = require('underscore');
_.str = require('underscore.string');
var gm = require('gm');
var mkdirp = require('mkdirp');
var fs = require('fs');
var async = require('async');

/*
 * Private methods
*/

// TODO: replace this with schema.js introspeciton
var value2js = function(value) {
    if (value === 'true') {
        value = true;
    } else if (value === 'false') {
        value = false;
    } else if (parseFloat(value) + '' === value) {
        value = parseFloat(value);
    }
    return value;
};

// TODO: replace this with schema.js introspeciton
var params2pojo = function(query) {
    var key, value;
    for (key in query) {
        value = query[key];
        if (_.isObject(value) && !_.isArray(value)) {
            query[key] = params2pojo(value);
        } else {
            query[key] = value2js(value);
        }
    }
    return query;
};

var validateType = function(db, type) {
    var error = null;
    if (!type) {
        error = 'no type found';
    }
    type = _.str.classify(type);
    if (db[type] === null) {
        error = "unknown type: " + type;
    }
    return error;
};

/** returns true if the property is a relation **/
var isRelation = function(schemas, resource, property) {
    var resourceConfig = schemas[resource].schema;
    propertyConfig = schemas[resource].properties[property];
    if (propertyConfig) { // check if the property exists (_id is often not described in schema)
        var relationType = propertyConfig.type;
        if (schemas[relationType]) {
            return true;
        }
    }
    return false;
};

var parseQuery = function(query, schemas, resource) {
    var results = {
      query: {},
      options: {}
    };
    for (var key in query) {
        var value = query[key];
        if (_.str.startsWith(key, '_') && (key !== '_id' && key !== '_type' && key !== '_ref')) {
            value = value2js(query[key]);
            if (value != null) {
                results.options[key.slice(1)] = value;
            }
        } else {
            if (_.isArray(value)) {
                if (key !== '_ref') {
                    var _allValue = [];
                    value.forEach(function(val) {
                        _allValue.push(value2js(val));
                    });
                    value = {
                        '$all': _allValue
                    };
                }
            } else {
                ['$in', '$nin', '$all', '$nall'].forEach(function($op) {
                    if (value[$op] != null) {
                        if (!_.isArray(value[$op])) {
                            value[$op] = value[$op].split(',');
                        }
                        value[$op] = value[$op].map(function(val) {
                            return value2js(val);
                        });
                    }
                });
                if (value['$exists'] != null) {
                    var exists = false;
                    if (['true', '1', 'yes'].indexOf(value['$exists']) > -1) {
                        exists = true;
                    }
                    value = {
                      '$exists': exists
                    };
                }
                /** the following allows to query relation without specified _id:
                 *
                 *    blog-post?blog._id=theblog -> blog-post?blog=theblog
                 *
                 *   TODO: add this into archimedes ?
                 */
                if (schemas) {
                    if (isRelation(schemas, resource, key)) {
                        key = key+'._id';
                    }
                }
            }
            results.query[key] = value;
        }
    }
    return results;
};

var engine = {};

/** getting started page **/
// TODO remove ?
engine.gettingStarted = function(req, res) {
    var models = req.db.modelsList || [];
    var text = "<h1>" + req.applicationName + "</h1>\n<p>You have " + models.length + " registered models:</p>\n<ul>";
    models.forEach(function(model) {
        text += "<li><a href='/api/1/" + (_.str.underscored(model)) + "'>" + model + "</a></li>";
    });
    text += "</ul>";
    return res.send(text);
};

/* ## count
 * returns the number of documents that match the query
 * options attributes are prefixed by undescore.
 *
 * examples:
 *   /api/1/organism_classification/count?
 *   /api/1/organism_classification/count?internetDisplay=true
 */
engine.count = function(req, res) {
    var error = validateType(req.db, req.params.type);
    if (error) {
        return res.json(500, {error: error });
    }

    var type = _.str.classify(req.params.type);
    var _ref = parseQuery(req.query, req.config.schemas, type);  // schemas and type are used for isRelation TODO: refactor
    var options = params2pojo(_ref.options);
    var query = params2pojo(_ref.query);
    return req.db[type].count(query, options, function(err, results) {
        if (err) {
            if (err.message != null) {err = err.message; }
            return res.json(500, {error: err });
        }
        return res.json({
            total: parseInt(results, 10)
        });
    });
};

// # ## findReference
// # returns all documents that match the query
// # options attributes are prefixed by undescore.
// #
// #   get /api/<version>?_ref=<documentReference>&[_ref=<documentReference2>]
// #
// # examples:
// #   /api/1/_ref?_id=http://ceropath.org/instances/individual/c0030
// #   /api/1/_ref?_id=http://ceropath.org/instances/individual/c0030&_ref=http://ceropath.org/instances/individual/c0006
// engine.findReference = (req, res) ->

//     {query, options} = parseQuery(req.query)

//     unless options.populate?
//         options.populate = false

//     options = params2pojo(options)
//     query = params2pojo(query)

//     if _.isString(options.populate) and options.populate.indexOf(',') > -1
//         options.populate = options.populate.split(',')

//     req.db[type].find query, options, (err, results) ->
//         if err
//             err = err.message if err.message?
//             return res.json(500, {error: err})
//         return res.json {
//             results: (o.toJSONObject({populate: options.populate, dereference: true}) for o in results)

/*
 * ## find
 * returns all documents that match the query
 * options attributes are prefixed by undescore.
 *
 * if an id is passed, fetch only the document which match the id
 *
 * get /api/<version>/<type>/[<id>]?[<query>]&[<option>]
 *
 * examples:
 *  /api/1/organism_classification?title@la=bandicota%20indica
 *  /api/1/publication&_limit=30&_offset=30
 *  /api/1/organism_classification?_populate=true&internetDisplay=true
 *  /api/1/individual/C0012
 *  /api/1/individual?_id=C0012
 *  /api/1/individual/C0012,C0013,C0032
 *  /api/1/individual?_id[$all]=C0012,C0013,C0032
 *  /api/1/individual/C0012?_populate=true
 *  /api/1/individual?species.citations.publication._id=50999553&voucherBarcoding=true
 */
engine.find = function(req, res) {
    var error = validateType(req.db, req.params.type);
    if (error) {
        return res.json(500, {error: error });
    }

    var type = _.str.classify(req.params.type);
    var _ref = parseQuery(req.query, req.config.schemas, type);  // schemas and type are used for isRelation TODO: refactor
    var query = _ref.query;
    var options = _ref.options;

    if (options.limit == null) {
      options.limit = 30;
    }
    if (options.populate == null) {
      options.populate = 0;
    }

    options = params2pojo(options);
    query = params2pojo(query);

    if ((options.sortBy != null) && _.isString(options.sortBy)) {
        options.sortBy = options.sortBy.split(',');
    }

    if (_.isString(options.populate) && options.populate.indexOf(',') > -1) {
        options.populate = options.populate.split(',');
    }

    if (options.fields != null && _.isString(options.fields)) {
        options.fields = options.fields.split(',');
    }

    if (req.params.id != null) {
        if (req.params.id.indexOf(',') > -1) {
            query = {_id: req.params.id.split(',')};
        } else {
            query = req.db.reference(type, req.params.id);
        }
    } else if (query._id != null) {
        if (!!query._id['$in']) {
            query._id = query._id['$in'];
        } else {
            query = req.db.reference(type, query._id);
        }
    }


    return req.db[type].find(query, options, function(err, results) {
        if (err) {
            if (err.message != null) {err = err.message; }
            req.logger.error({error: err});
            return res.json(500, {error: err, query: query, options: options });
        }


        return res.json({
            results: results.map(function(o) {
                return o.toJSONObject({
                    populate: options.populate,
                    dereference: true
                });
            })
        });
    });
};


/*
 * ## exportData
 * Returns the data as a file in a specified format.
 * The data must be ordered. If no '_sortBy' options are specified,
 * the data is ordered by type.
 *
 * get /api/<version>/<type>/export/<format>?[<query>]&[<option>]
 *
 * examples:
 *  /api/1/individual/export/csv?isTrappedAlive=true
 *  /api/1/individual/export/json?gender=male&_sortBy=maturity
 *  /api/1/individual/export/json?gender=male&_sortBy=maturity&_asJSONArray=true
 */
engine.exportData = function(req, res) {
    var error = validateType(req.db, req.params.type);
    if (error) {
        return res.json(500, {error: error });
    }

    var type = _.str.classify(req.params.type);
    var _ref = parseQuery(req.query, req.config.schemas, type);  // schemas and type are used for isRelation TODO: refactor
    var query = _ref.query;
    var options = _ref.options;

    options = params2pojo(options);
    query = params2pojo(query);

    if (!options.sortBy) {
        options.sortBy = '_type';
    } else if ((options.sortBy != null) && _.isString(options.sortBy)) {
        options.sortBy = options.sortBy.split(',');
    }

    if (_.isString(options.populate) && options.populate.indexOf(',') > -1) {
        options.populate = options.populate.split(',');
    }

    if (options.fields != null && _.isString(options.fields)) {
        options.fields = options.fields.split(',');
    }

    var exportFormat = req.params.format;
    if (exportFormat === 'tsv') {
        exportFormat = 'csv';
        options.delimiter = '\t';
    }


    req.db[type].count(_.clone(query), _.clone(options), function(err, total) {
        if (err) {
            if (err.message != null) {err = err.message; }
            req.logger.error({error: err});
            return res.json(500, {error: err, query: query, options: options });
        }

        if (total >= 10000) {
            return res.json(413, {error: 'the response has to many results. Try to narrow down your query'});
        }

        var getData = function(options, callback) {
             req.db[type].find(_.clone(query), _.clone(options), function(err, results) {
                if (err) {
                    if (err.message != null) {err = err.message; }
                    req.logger.error({error: err});
                    return callback({error: err, query: query, options: options });
                }

                var items;
                if (exportFormat === 'json') {
                    items = results.map(function(o) {
                        return o.toJSON();
                    });
                } else if (exportFormat === 'csv') {
                    items = results.map(function(o) {
                        return o.toCSV({
                            delimiter: options.delimiter,
                            fields: options.fields
                        });
                    });
                }
                if (exportFormat === 'json' && options.asJSONArray) {
                    if (options.__index === 0) {
                        res.write(items.join(',\n'));
                    } else {
                        if (items.length) {
                            res.write(','+items.join(',\n'));
                        } else {
                            console.error('something wrong, no items for', options);
                        }
                    }
                } else {
                    res.write(items.join('\n')+'\n');
                }
                return callback(null, 'ok');

            });
        };

        var tripOptions = [];
        if (options.limit) {
            total = options.limit;
        }
        var bulkLimit = 100;
        var nbTrip = Math.round(total/bulkLimit);
        if (total < bulkLimit) {
            bulkLimit = total;
        }
        var _options;
        for (var i=0; i<=nbTrip; i++) {
            _options = _.clone(options);
            _options.limit=bulkLimit;
            _options.offset=bulkLimit*i;
            _options.__index = i;
            tripOptions.push(_options);
        }

        var fileExtension;
        if (exportFormat === 'json') {
            fileExtension = '.json';
        } else if (exportFormat === 'csv') {
            fileExtension = '.csv';
            if (options.delimiter === '\t') {
                fileExtension = '.tsv';
            }
        }

        res.attachment(req.params.type+fileExtension);
        // res.setHeader('Content-Type', 'text/html');

        if (exportFormat === 'csv') {
            var csvHeader = new req.db[type]().toCSVHeader({fields: options.fields});
            res.write(csvHeader+'\n');
        } else if (exportFormat == 'json' && options.asJSONArray) {
            res.write('[');
        }

        async.eachSeries(tripOptions, getData, function(err, results){
            if (err) {
                if (err.message != null) {err = err.message; }
                req.logger.error({error: err});
                return res.json(500, {error: err, query: query, options: options });
            }
            if (exportFormat == 'json' && options.asJSONArray) {
                res.write(']');
            }
            res.end('');
        });
    });
};

/* ## facets
 * Group the data by a specified field
 *
 *   get /api/<version>/<type>/facet/<field>?[<query>]&[<options>]
 *
 * examples:
 *
 *   /api/1/organism_classification/facets/internetDisplay&_limit=15
 *   /api/1/individual/facets/species.title
 *   /api/1/individual/facets/species.title?voucherBarcoding=true
 *   /api/1/organism_classification/facets/identificationDate?_aggregation=$year-$month&_limit=15
 */
engine.facets = function(req, res) {
    var error = validateType(req.db, req.params.type);
    if (error) {
        return res.json(500, {error: error });
    }

    var type = _.str.classify(req.params.type);
    var field = req.params.field;
    var aggregation = null;

    if (req.query._aggregation != null) {
        aggregation = req.query._aggregation;
        delete req.query._aggregation;
    }

    var _ref = parseQuery(req.query, req.config.schemas, type);  // schemas and type are used for isRelation TODO: refactor
    query = params2pojo(_ref.query);
    options = params2pojo(_ref.options);

    if (options.limit == null) {
        options.limit = 30;
    }

    /** if aggregation then use time series ?!?!? **/
    if (aggregation) {
        return req.db[type].timeSeries(field, aggregation, query, options, function(err, results) {
            if (err) {
              if (err.message != null) {err = err.message; }
              return res.json(500, {error: err });
            }
            return res.json({results: results });
        });

    /** else use regular facets method **/
    } else {
        // console.log('>> facet: ', field, query);
        return req.db[type].facets(field, query, options, function(err, results) {
            if (err) {
                if (err.message != null) {err = err.message; }
                return res.json(500, {error: err });
            }
            return res.json({results: results });
        });
    }
};

var deleteModelWithAttachments = function(req, res, type, filePathProperties) {
    req.db[type].first({_id: req.params.id}, function(err, model) {
        var fileFullPath;
        filePathProperties.forEach(function(propName) {
            fileFullPath = './'+req.config.uploadDirectory+model.get(propName);
            console.log('removing', fileFullPath);
            fs.unlink(fileFullPath, function(err) {
                if (err) {
                    console.error(err);
                }
            });
        });
        model.delete(function(err) {
            if (err) {
                if (err.message != null) {err = err.message; }
                return res.json(500, {error: err, status: 'failed'});
            }
            return res.json({
                status: 'ok',
                _id: req.params.id,
                _type: req.params.type
            });
        });
    });
};

engine["delete"] = function(req, res) {

    /** search for attached file that need to be delete as well */
    var type = _.str.classify(req.params.type);
    var filePathProperties = [];
    var property;
    var properties = req.config.schemas[type].properties;
    Object.keys(properties).forEach(function(propName) {
        /** if the property is a string, and propagateDeletion is true,
         *  it means that the property is represente the path of the file
         *  that we have to delete as well
         */
        if (properties[propName].propagateDeletion && properties[propName].type === 'string') {
            filePathProperties.push(propName);
        }
    });

    req.db[type].first({_id: req.params.id}, function(err, model) {
        /** if the model references any attached files, delete those files **/
        if (filePathProperties.length) {
            var fileFullPath;
            filePathProperties.forEach(function(propName) {
                fileFullPath = './'+req.config.uploadDirectory+model.get(propName);
                console.log('removing', fileFullPath);
                fs.unlink(fileFullPath, function(err) {
                    if (err) {
                        console.error(err);
                    }
                });
            });
        }

        /** delete regular model **/
        model.delete(function(err) {
            if (err) {
                if (err.message != null) {err = err.message; }
                return res.json(500, {error: err, status: 'failed'});
            }
            return res.json({
                status: 'ok',
                _id: req.params.id,
                _type: req.params.type
            });
        });
    });

};

// # ## clear
// # Clear all data of the db
// #
// #   delete /api/<version>
// #
// engine.clear = function(req, res) {
//     req.db.clear(function(err) {
//         if (err) {
//             if (err.message != null) {
//                 err = err.message
//             }
//             return res.json(500, {error: err, status: 'failed'});
//         }
//         return res.json({status: 'ok'});
//     });
// };

/* ## describe
 * Returns the model's schema
 *
 *   delete /api/<version>/<type>/describe
 *
 */
engine.describe = function(req, res) {
    var type = _.str.classify(req.params.type);
    if (!req.db[type]) {
        return res.json(500, {
            error: "unknown model: " + type
        });
    }
    return res.json({
        modelName: type,
        schema: req.db[type].prototype.schema
    });
};

/* ## files upload
 *
 *
 */
var buildThumbnail = function(filePath, uploadDirectory, callback) {
    /** build the thumbPath from the filePath **/
    var thumbDirectory = filePath.split('/').slice(0, -1).join('/')+'/thumbnails/';
    var thumbDirectoryFullPath = './'+uploadDirectory+thumbDirectory;
    mkdirp.sync(thumbDirectoryFullPath);     // create the thumbnails folder if needed
    var fileName = filePath.split('/').slice(-1)[0];
    var thumbPath = thumbDirectory + fileName;

    /** the full path where the images are stored **/
    var fileFullPath = './'+uploadDirectory+filePath;
    var thumbFullPath = './'+uploadDirectory+thumbPath;


    /** fire graphicsmagick to do the job **/
    gm(fileFullPath)
      .gravity('Center')
      .resize('200', '200' + "^>")
      .quality(90)
      .crop('200', '200').write(thumbFullPath, function(err) {
        return callback(err, thumbPath);
      });
};


engine.files = function(req, res) {
    var file = req.files.file[0];
    var filePath = file.path.replace(req.config.uploadDirectory, '');

    /** if the file is an image, generate a thumbnail **/
    if (file.mimetype.search(/^image/) > -1) {
        buildThumbnail(filePath, req.config.uploadDirectory, function(err, thumbPath) {
            return res.json({
                path: filePath,
                thumbPath: thumbPath
            });
        });
    } else {
        return res.json({
            path: filePath
        });
    }

};

engine.redirectToFile = function(req, res) {
    var filePath = req.params[0];
    var uploadDirectory = req.config.uploadDirectory;
    return res.redirect(301, '/'+uploadDirectory+'/'+filePath);
};

/* ## sync
 * Sync a document. If not `_id` field is present, it will create a new
 * document. Otherwise, the matching document will be updated.
 *
 *   post /api/<version>/<type>
 *       data: payload=<jsonString>
 *
 *
 * Batch sync can be done by passing to the payload an array of objects
 *
 *   post /api/<version>/<type> --> create a batch of documents
 *       data: payload=[<jsonString1>, <jsonString2>, ...]
 */
engine.sync = function(req, res) {
    var type = _.str.classify(req.params.type);

    try {
        var payload = JSON.parse(req.body.payload);
    } catch (_error) {
        var e = _error;
        if (e.message != null) {
            e = e.message;
        }
        console.log('err: cannot parse payload. Reason: ', e);
        return res.json(500, {error: 'cannot parse payload. Reason: ' + e });
    }

    /** if the payload is an array, use batchSync **/
    if (_.isArray(payload)) {
        var pojos = [];
        payload.forEach(function(pojo) {
            delete pojo._type;
            try {
                pojos.push(new req.db[type](pojo).toSerializableObject());
            } catch (_error) {
                var e = _error;
                if (e.message != null) {e = e.message; }
                console.log('xxx', e);
                return res.json(500, {error: e });
            }
        });

        return req.db.batchSync(pojos, function(err, data) {
            if (err) {
                if (err.message != null) {err = err.message; }
                return res.json(500, {error: err });
            }
            data.forEach(function(result) {
                result.result._type = type;
                result.result = new req.db[type](result.result).toJSONObject({
                    dereference: true
                });
            });

            var _results = {};
            return res.json(data.map(function(obj) {
                return {result: obj.result, options: obj.options};
            }));
          });

    } else {
        /** else, use regular save method **/

        delete payload._type;
        try {
            var obj = new req.db[type](payload);
        } catch (_error) {
            var e = _error;
            if (e.message != null) {e = e.message; }
            console.log('xxxx', e, payload);
            return res.json(500, {error: e });
        }

        return obj.save(function(err, obj, infos) {
            if (err) {
                console.log('yyy', err);
                return res.json(500, {error: err });
            }

            return res.json({
                object: obj.toJSONObject({
                    dereference: true
                }),
                infos: infos
            });
        });
    }
};

module.exports = [
    {
        method: 'get',
        url: "/:type/count",
        func: engine.count
    }, {
        method: 'get',
        url: "/:type/export/:format",
        func: engine.exportData
    }, {
        method: 'get',
        url: "/:type/facets/:field",
        func: engine.facets
    }, {
        method: 'get',
        url: /^\/api\/1\/_files\/([^\/]+?(?:\/[^\/]+?)*)(?:\/(?=$))?$/i,
        func: engine.redirectToFile
    }, {
        method: 'get',
        url: "/:type/describe",
        func: engine.describe
    }, {
        method: 'get',
        url: "/:type/:id",
        func: engine.find
    }, {
        method: 'delete',
        url: "/:type/:id",
        func: engine["delete"]
    }, {
        method: 'get',
        url: "/:type",
        func: engine.find
    }, {
        method: 'post',
        url: /^\/api\/1\/_files\/([^\/]+?(?:\/[^\/]+?)*)(?:\/(?=$))?$/i,
        func: engine.files
    }, {
        method: 'post',
        url: "/:type",
        func: engine.sync
    }, {
        method: 'get',
        url: "/",
        func: engine.gettingStarted
    }
];

