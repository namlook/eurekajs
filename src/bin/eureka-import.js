import Promise from 'bluebird';
// import mimes from 'mime-types';
import _ from 'lodash';
import path from 'path';
import fs from 'fs';
import eureka from '../index';
import ProgressBar from 'progress';
import shell from 'shelljs';

let argv = require('yargs');

let args = argv
    .usage('Usage: $0 <resource> <filename> [options]')
    .example('$0 BlogPost blogposts.csv -d "\\t"', 'impot the tsv file as blog post')
    .demand(['f', 'r', 'c'])
    .alias('r', 'resource')
    .nargs('r', 1)
    .alias('f', 'file')
    .nargs('f', 1)
    .alias('d', 'delimiter')
    .describe('d', 'the csv delimiter')
    .alias('c', '--config')
    .nargs('c', 1)
    .describe('config', 'the server config path')
    .boolean('ignore-unknown')
    .describe('ignore-unknown', 'ignore unknown properties')
    .boolean('dry-run')
    .describe('dry-run', 'perform just a validation')
    .alias('p', 'port')
    .nargs('p', 1)
    .describe('p', 'the port to use')
    .help('h')
    .alias('h', 'help')
    .epilog('copyright 2015')
    .argv;



let NB_CSV_PROCEED = 0;
let NB_WRITTEN = 0;



let loadDatabase = function(serverConfigPath) {
    return new Promise((resolve, reject) => {

        let config = require(serverConfigPath);
        config.port = args.port || config.port;
        var eurekaServer = eureka(config);

        eurekaServer.beforeRegister = function(_server, next) {
            _server.on('log', function(message) {
                console.log(message.tags, message.data);
            });
            next(null);
        };

        eurekaServer.start().then((server) => {
            return resolve(server.plugins.eureka.database);
        }).catch((error) => {
            reject(error);
        });
    });
};



let importCsv = function(serverConfig, resource, filename, options) {
    let db;
    let modelName = _.capitalize(_.camelCase(resource));
    let filepath = path.resolve(filename);

    let csvOptions = {
        delimiter: options.delimiter,
        escapeChar: options.escapeChar,
        enclosedChar: options.enclosedChar,
        stripUnknown: options.ignoreUnknown
    };


    return Promise.resolve().then(() => {
        return loadDatabase(path.resolve(serverConfig));
    }).then((_db) => {
        db = _db;

        if (!db[modelName]) {
            throw new Error(`unknown resource: ${resource}"`);
        }

        let clearDb;
        if (!options.dryRun) {
            console.log('cleaning database...');
            clearDb = db.clearResource(modelName);
        } else {
            clearDb = Promise.resolve();
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
    }).then(() => {
        return new Promise(function(resolve, reject) {

            let numLines = parseFloat(
                shell.exec(`wc -l ${filepath}`, {silent: true})
                    .output
                    .trim()
                    .split(' ')[0]
            );

            console.log(`${numLines} lines to process`);

            let action = options.dryRun && 'validating' || 'uploading';

            let progressBar = new ProgressBar(`${action} [:bar] :percent :etas`, {
                complete: '=',
                incomplete: ' ',
                width: 20,
                total: numLines
            });

            let file = fs.createReadStream(filepath);
            let csvStream = db.csvStreamParse(modelName, file, csvOptions);
            let writableStream = db.writableStream(modelName, {dryRun: options.dryRun, stripUnknown: true});
            csvStream.pipe(writableStream);

            csvStream.on('error', function(err) {
                file.destroy();
                reject(err);
            });

            writableStream.on('error', function(err) {
                file.destroy();
                csvStream.destroy();
                reject(err);
            });

            csvStream.on('data', () => {
                NB_CSV_PROCEED++;
                progressBar.tick(1);
            });

            writableStream.on('data', () => {
                NB_WRITTEN++;
                // progressBar.tick(1);
            });

            writableStream.on('end', function() {
                resolve();
            });

            file.on('error', function(err) {
                file.destroy();
                csvStream.destroy();
                reject(err);
            });
        });
    }).catch(function(err) {
        if (err.message === 'Bad value') {
            var lineNumber = parseFloat(err.line.count) + 1;
            console.error('\n\nerror at line ' + lineNumber);
            throw new Error(err.extra);
        } else {
            throw err;
        }
    });
};

let _options = {
    delimiter: args.delimiter,
    dryRun: args.dryRun,
    ignoreUnknown: args.ignoreUnknown
};

importCsv(args.config, args.resource, args.file, _options).then(() => {
    console.log('');
    console.log('nb csv proceed>', NB_CSV_PROCEED);
    console.log('nb written>', NB_WRITTEN);
    console.log('done.');
    process.exit(); //eslint-disable-line no-process-exit
}).catch((err) => {
    console.error(err);
    // console.error(err.stack);
    console.log('');
    console.log('nb csv proceed>', NB_CSV_PROCEED);
    console.log('nb written>', NB_WRITTEN);
    process.exit(); //eslint-disable-line no-process-exit
});

