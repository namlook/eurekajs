'use strict';

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

// import mimes from 'mime-types';

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _index = require('../index');

var _index2 = _interopRequireDefault(_index);

var _progress = require('progress');

var _progress2 = _interopRequireDefault(_progress);

var _shelljs = require('shelljs');

var _shelljs2 = _interopRequireDefault(_shelljs);

var argv = require('yargs');

var args = argv.usage('Usage: $0 <resource> <filename> [options]').example('$0 BlogPost blogposts.csv -d "\\t"', 'impot the tsv file as blog post').demand(['f', 'r', 'c']).alias('r', 'resource').nargs('r', 1).alias('f', 'file').nargs('f', 1).alias('d', 'delimiter').describe('d', 'the csv delimiter').alias('c', '--config').nargs('c', 1).describe('config', 'the server config path').boolean('ignore-unknown').describe('ignore-unknown', 'ignore unknown properties').boolean('dry-run').describe('dry-run', 'perform just a validation').alias('p', 'port').nargs('p', 1).describe('p', 'the port to use').help('h').alias('h', 'help').epilog('copyright 2015').argv;

var NB_CSV_PROCEED = 0;
var NB_WRITTEN = 0;

var loadDatabase = function loadDatabase(serverConfigPath) {
    return new _bluebird2['default'](function (resolve, reject) {

        var config = require(serverConfigPath);
        config.port = args.port || config.port;
        var eurekaServer = (0, _index2['default'])(config);

        eurekaServer.beforeRegister = function (_server, next) {
            _server.on('log', function (message) {
                console.log(message.tags, message.data);
            });
            next(null);
        };

        eurekaServer.start().then(function (server) {
            return resolve(server.plugins.eureka.database);
        })['catch'](function (error) {
            reject(error);
        });
    });
};

var importCsv = function importCsv(serverConfig, resource, filename, options) {
    var db = undefined;
    var modelName = _lodash2['default'].capitalize(_lodash2['default'].camelCase(resource));
    var filepath = _path2['default'].resolve(filename);

    var csvOptions = {
        delimiter: options.delimiter,
        escapeChar: options.escapeChar,
        enclosedChar: options.enclosedChar,
        stripUnknown: options.ignoreUnknown
    };

    return _bluebird2['default'].resolve().then(function () {
        return loadDatabase(_path2['default'].resolve(serverConfig));
    }).then(function (_db) {
        db = _db;

        if (!db[modelName]) {
            throw new Error('unknown resource: ' + resource + '"');
        }

        var clearDb = undefined;
        if (!options.dryRun) {
            console.log('cleaning database...');
            clearDb = db.clearResource(modelName);
        } else {
            clearDb = _bluebird2['default'].resolve();
        }

        if (!filename) {
            throw new Error('file not found');
        }

        // let mimeType = mimes.lookup(filename);

        // if (mimeType !== 'text/csv') {
        //     console.error('the file should be in csv format');
        //     process.exit();
        // }

        return clearDb;
    }).then(function () {
        return new _bluebird2['default'](function (resolve, reject) {

            var numLines = parseFloat(_shelljs2['default'].exec('wc -l ' + filepath, { silent: true }).output.trim().split(' ')[0]);

            console.log(numLines + ' lines to process');

            var action = options.dryRun && 'validating' || 'uploading';

            var progressBar = new _progress2['default'](action + ' [:bar] :percent :etas', {
                complete: '=',
                incomplete: ' ',
                width: 20,
                total: numLines
            });

            var file = _fs2['default'].createReadStream(filepath);
            var csvStream = db.csvStreamParse(modelName, file, csvOptions);
            var writableStream = db.writableStream(modelName, { dryRun: options.dryRun, stripUnknown: true });
            csvStream.pipe(writableStream);

            csvStream.on('error', function (err) {
                file.destroy();
                reject(err);
            });

            writableStream.on('error', function (err) {
                file.destroy();
                csvStream.destroy();
                reject(err);
            });

            csvStream.on('data', function () {
                NB_CSV_PROCEED++;
                progressBar.tick(1);
            });

            writableStream.on('data', function () {
                NB_WRITTEN++;
                // progressBar.tick(1);
            });

            writableStream.on('end', function () {
                resolve();
            });

            file.on('error', function (err) {
                file.destroy();
                csvStream.destroy();
                reject(err);
            });
        });
    })['catch'](function (err) {
        if (err.message === 'Bad value') {
            var lineNumber = parseFloat(err.line.count) + 1;
            console.error('\n\nerror at line ' + lineNumber);
            throw new Error(err.extra);
        } else {
            throw err;
        }
    });
};

var _options = {
    delimiter: args.delimiter,
    dryRun: args.dryRun,
    ignoreUnknown: args.ignoreUnknown
};

importCsv(args.config, args.resource, args.file, _options).then(function () {
    console.log('');
    console.log('nb csv proceed>', NB_CSV_PROCEED);
    console.log('nb written>', NB_WRITTEN);
    console.log('done.');
    process.exit(); //eslint-disable-line no-process-exit
})['catch'](function (err) {
    console.error(err);
    // console.error(err.stack);
    console.log('');
    console.log('nb csv proceed>', NB_CSV_PROCEED);
    console.log('nb written>', NB_WRITTEN);
    process.exit(); //eslint-disable-line no-process-exit
});