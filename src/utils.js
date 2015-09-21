import _ from 'lodash';

import {Readable as readableStream} from 'stream';
import es from 'event-stream';
import through2 from 'through2';
import streamStream from 'stream-stream';


export var pascalCase = function(string) {
    return _.capitalize(_.camelCase(string));
};

export var resourceObjectLink = function(apiBaseUri, instance) {
    return `${apiBaseUri}/${_.kebabCase(instance._type)}/${instance._id}`;
};

let _stream = function(total, query, options, headerStream, footerStream, throughTransform) {
    let pagination = 2;

    if (options.limit) {
        if (total > options.limit) {
            total = options.limit;
        }
    }
    let nbTrip = Math.ceil(total / pagination);

    let offset = 0;
    let args = _.range(0, nbTrip).map(() => {

        let _options = _.clone(options);
        _options.offset = offset;

        if (offset + pagination > options.limit) {
            _options.limit = (offset + pagination) - options.limit;
        } else {
            _options.limit = pagination;
        }

        let arg = JSON.stringify({query: query, options: _options});
        offset += pagination;
        return arg;
    });

    let nbProceed = 0;
    let contentStream = es.readArray(args)
      .pipe(through2(throughTransform(total, nbProceed)));

    let combinedStream = streamStream();

    if (headerStream) {
        combinedStream.write(headerStream);
    }

    combinedStream.write(contentStream);

    if (footerStream) {
        combinedStream.write(footerStream);
    }

    combinedStream.end();

    return combinedStream;
};

export var streamJsonApi = function(Model, total, query, options, apiBaseUri) {
    let headerStream = (function() {
        let rs = readableStream();
        rs.push(`{"data":[`);
        rs.push(null);
        return rs;
    })();


    let kebabModelName = _.kebabCase(Model.name);
    let footerStream = (function() {
        let rs = readableStream();
        rs.push(`],"links":{"self": "${apiBaseUri}/${kebabModelName}"}}`);
        rs.push(null);
        return rs;
    })();

    let throughTransform = function(_total, _nbProceed) {
        return function(chunk, enc, callback) {
            let arg = JSON.parse(chunk);
            Model.find(arg.query, arg.options).then((array) => {
                array.forEach((instance) => {
                    let resourceLink = resourceObjectLink(apiBaseUri, instance);
                    let jsonApiData = instance.toJsonApi(resourceLink).data;
                    this.push(JSON.stringify(jsonApiData));
                    _nbProceed++;

                    if (_nbProceed < _total) {
                        this.push(',\n');
                    }
                });
                callback();
            });
        };
    };

    return _stream(total, query, options, headerStream, footerStream, throughTransform);
};


export var streamCsv = function(Model, total, query, options, delimiter) {
    // header of the CSV
    let startStream = (function() {
        let rs = readableStream();
        let csvOptions = {fields: options.fields, delimiter: delimiter};
        rs.push(Model.csvHeader(csvOptions) + '\n');
        rs.push(null);
        return rs;
    })();


    // no need for footer
    let footerStream = null;

    let throughTransform = function(_total, _nbProceed) {
        return function(chunk, enc, callback) {
            let arg = JSON.parse(chunk);
            Model.find(arg.query, arg.options).then((array) => {
                let promises = array.map((instance) => {
                    return instance.toCsv({fields: options.fields, delimiter: delimiter});
                });

                Promise.all(promises).then((rows) => {
                    this.push(rows.join('\n'));

                    _nbProceed = _nbProceed + rows.length;

                    if (_nbProceed < _total) {
                        this.push('\n');
                    }

                    callback();
                });
            });
        };
    };

    return _stream(total, query, options, startStream, footerStream, throughTransform);
};

