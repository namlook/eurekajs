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

let _stream = function(total, query, options, startStream, endStream, throughTransform) {
    let pagination = 100;
    let nbTrip = Math.ceil(total / pagination);

    let offset = 0;
    let args = _.range(0, nbTrip).map(() => {
        let _options = _.clone(options);
        _options.offset = offset;
        _options.limit = pagination;
        let arg = JSON.stringify({query: query, options: _options});
        offset += pagination;
        return arg;
    });

    let nbProceed = 0;
    let contentStream = es.readArray(args)
      .pipe(through2(throughTransform(total, nbProceed)));

    let combinedStream = streamStream();
    combinedStream.write(startStream);
    combinedStream.write(contentStream);
    combinedStream.write(endStream);
    combinedStream.end();

    return combinedStream;
};

export var streamJsonApi = function(Model, total, query, options, apiBaseUri) {
    let startStream = (function() {
        let rs = readableStream();
        rs.push(`{"data":[`);
        rs.push(null);
        return rs;
    })();


    let kebabModelName = _.kebabCase(Model.name);
    let endStream = (function() {
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

    return _stream(total, query, options, startStream, endStream, throughTransform);
};

