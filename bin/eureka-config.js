#!/usr/bin/env node

var path = require('path');
var fs = require('fs');
var merge = require('deepmerge');
var flat = require('flat');
var async = require('async');
var colors = require('colors');
var _ = require('underscore');
_.str = require('underscore.string');


/*
 * generate the app/frontend/config.json and app/server/config.json
 * for a specific environment: development, test and production
 */
var generateConfig = module.exports =function(_environment, options, callback) {

    var environmentAvailable = ['test', 'production', 'development'];
    var environment = null;
    environmentAvailable.forEach(function(env) {
        if (_.str.startsWith(env, _environment)) {
            environment = env;
        }
    });

    if (!environment) {
        console.log('/!\\ WARNING: unknown environment name, trying with custom environment... /!\\'.red);
        environment = _environment;
    }

    console.log('configuring the project for the '.blue+environment.bold.blue+' environment...'.blue);

    var _generateConfigFor = function(name, cb) {

        var configFile = require(path.resolve('./config/'+name+'.config'));
        var envConf;
        for (var env in configFile) {
            if (env === environment) {
                envConf = configFile[env];
            }
        }

        var config;
        if (envConf) {
            config = merge(configFile, envConf);
        } else {
            config = configFile;
        }

        environmentAvailable.forEach(function(env) {
            delete config[env];
        });

        var flattenedConfig = flat.flatten(config);
        for (var flatkey in flattenedConfig) {
            if (flattenedConfig[flatkey] === undefined) {
                delete flattenedConfig[flatkey];
            }
        }
        config = flat.unflatten(flattenedConfig);

        config.environment = environment;
        fs.writeFile('./app/'+name+'/config.json', JSON.stringify(config, null, 4), function(err) {
            if (cb) {
                if(err) {
                    console.log(err);
                    return cb(err);
                } else {
                    console.log(name+" config file saved in app/"+name+"/config.json");
                    return cb(null);
                }
            }
        });
    };

    async.every(['server', 'frontend'], _generateConfigFor, function(err, results) {
        if (callback) {
            if (err) {return callback(err);}
            return callback(null, results);
        }
    });
};


if (require.main === module) {
    var program = require('commander');
    program
      .version('0.0.1')
      .usage("<environment>\n\n  Command-Specific Help\n\n    eureka-config <environment> --help")
      .parse(process.argv);


    var environment;
    if (program.args.length) {
        environment = program.args[0] ;
    } else {
        environment = process.env.NODE_ENV;
    }

    if (!environment) {
        program.help();
    }

    generateConfig(environment);
}