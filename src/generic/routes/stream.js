
import queryParserMdw from '../../middlewares/query-parser';
import async from 'async';
import _ from 'lodash';
import joi from 'joi';

/** validate and attach the export format **/
var attachFormatMdw = function(req, res, next) {
    let format = req.params.format || 'json';

    let valideFormats = ['json', 'csv', 'tsv'];

    if (!_.contains(valideFormats, format.toLowerCase())) {
        return res.badRequest(`unknown format: ${format}`);
    }


    if (format === 'tsv') {
        format = 'csv';
        req.parsedQuery.options.delimiter = '\t';
    }

    req.attrs.format = format.toLowerCase();
    return next();
};

/** cast and attach the options asJSONArray **/
var attachAsJSONArrayMdw = function(req, res, next) {
        var {options} = req.parsedQuery;

        var {error, value} = joi.boolean()
                                .default(true)
                                .label('asJSONArray')
                                .validate(options.asJSONArray);
        if (error) {
            return res.badRequest(error);
        }

        req.attrs.asJSONArray = value;
        next();
};


/** check if the total results is small enough and attach it **/
var attachTotalResultsMdw = function(req, res, next) {

    var {query, options} = req.parsedQuery;

    // count will modify the query and options so we have to clone them
    // TODO sanitize this in archimedes

    query = _.clone(query);
    options = _.clone(options);

    req.resource.Model.count(query, options, function(err, total) {
        if (err) {
            return res.serverError(err);
        }

        if (options.populate) {
            if (total >= 5000) {
                return res.requestTooLarge('The response has to many results (>5000). Try to narrow down your query');
            }
        } else {
            if (total >= 10000) {
                return res.requestTooLarge('The response has to many results (>10000). Try to narrow down your query');
            }
        }

        req.attrs.total = total;

        next();
    });
};

export default {
    _generic: true,
    doc: {
        description: 'return all the documents that matches the query',
        params: {
            format: {
                type: 'string',
                default: 'json',
                description: `the format the results must be returned. Should be json, tsv or csv
                    if the format is not specified, json is used by default`
            }
        },
        options: {
            asJSONArray: {
                type: 'boolean',
                default: true,
                description: 'if true, returns the results as a big json array'
            }
        },
        usage: '/api/<version>/<resource>/i/stream/<format>?[query]&[options]',
        note: `Use stream if you want to fetch a lot (> 100) documents.
               Use find instead (which is faster with small sets of documents)`
    },
    path: '/i/stream/:format?',
    method: 'get',
    beforeHandler: [
        queryParserMdw,
        attachFormatMdw,
        attachAsJSONArrayMdw,
        attachTotalResultsMdw
    ],
    handler: function(req, res) {

        var {format, total, asJSONArray} = req.attrs;
        var {query, options} = req.parsedQuery;

        options.sortBy = [];

        var getData = function(opt, callback) {
            query = _.clone(query);
            opt = _.clone(opt);

            req.resource.Model.find(query, opt, function(_err, results) {
                if (_err) {
                    if (_err.message != null) {_err = _err.message; }
                    req.logger.error({error: _err});
                    return callback({error: _err, query: query, options: opt });
                }

                var items;
                if (format === 'json') {
                    items = results.map(function(o) {
                        return o.toJSON({
                            populate: opt.populate,
                            dereference: true
                        });
                    });
                } else if (format === 'csv') {
                    items = results.map(function(o) {
                        return o.toCSV({
                            delimiter: opt.delimiter,
                            fields: opt.fields
                        });
                    });
                }

                if (format === 'json' && asJSONArray) {
                    if (opt.__index === 0) {
                        res.write(items.join(',\n'));
                    } else {
                        if (items.length) {
                            res.write(',' + items.join(',\n'));
                        } else {
                            req.logger.error('something wrong, no items for', opt);
                        }
                    }
                } else {
                    res.write(items.join('\n') + '\n');
                }

                return callback(null, 'ok');

            });
        };

        var tripOptions = [];
        if (options.limit) {
            total = options.limit;
        }
        var bulkLimit = 100;
        var nbTrip = Math.round(total / bulkLimit);
        if (total < bulkLimit) {
            bulkLimit = total;
        }

        var _options;
        for (var i = 0; i <= nbTrip; i++) {
            _options = _.clone(options);
            _options.limit = bulkLimit;
            _options.offset = bulkLimit * i;
            _options.__index = i;
            tripOptions.push(_options);
        }

        var fileExtension = format;
        if (format === 'csv' && options.delimiter === '\t') {
            fileExtension = 'tsv';
        }

        res.attachment(`${req.resource.name}.${fileExtension}`);
        // res.setHeader('Content-Type', 'application/json');
        // res.setHeader('Content-Type', 'text/html');

        if (format === 'csv') {
            var csvHeader = new req.resource.Model().toCSVHeader({fields: options.fields});
            res.write(csvHeader + '\n');
        } else if (format === 'json' && asJSONArray) {
            res.write('[');
        }

        async.eachSeries(tripOptions, getData, function(asyncErr){
            if (asyncErr) {
                if (asyncErr.message != null) {asyncErr = asyncErr.message; }
                req.logger.error({error: asyncErr});
            }
            if (format === 'json' && asJSONArray) {
                res.write(']');
            }
            res.end('');
        });
    }
};