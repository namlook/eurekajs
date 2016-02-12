'use strict';

var _Object$keys = require('babel-runtime/core-js/object/keys')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _archimedes = require('archimedes');

// import ModelSchema from './model-schema';

var _utils = require('../utils');

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var archimedesPlugin = function archimedesPlugin(plugin, options, next) {

    if (options.log) {
        options.log = _lodash2['default'].isArray(options.log) && options.log || [options.log];

        plugin.on('log', function (message) {
            if (_lodash2['default'].contains(message.tags, 'database')) {
                if (_lodash2['default'].intersection(message.tags, options.log).length) {
                    console.log(message.tags, message.data);
                }
            }
        });
    }

    // let adapter = options.database.adapter;
    // let databaseConfig = options.database.config;
    var schemas = options.schemas;

    // var Database = archimedes[adapter].Database;
    // var Model = archimedes[adapter].Model;

    var db = undefined;
    var models = {};
    if (options.database.adapter === 'rdf') {
        db = (0, _archimedes.triplestore)(options.database.config);
    } else {
        throw new Error('unknown adapter', options.database.adapter);
    }

    _lodash2['default'].forOwn(schemas, function (modelInfos, modelName) {
        var modelNamePascalCase = (0, _utils.pascalCase)(modelName);
        models[modelNamePascalCase] = modelInfos;

        //     if (modelName === 'Basic') {
        //         throw "EurekaServer: 'Basic' is a reserved word and can not be used as model name";
        //     }

        //     if (!modelInfos.properties) {
        //         plugin.log(['warn', 'database'], `${modelName} has no properties`);
        //         modelInfos.properties = {};
        //     }

        plugin.log(['info', 'database'], 'register model ' + modelNamePascalCase + ' (with ' + _Object$keys(modelInfos.properties).length + ' properties)');

        // models[modelNamePascalCase] = Model.extend({
        //     schema: modelInfos.properties
        // });

        //     // TODO put the following line in archimedes ?
        //     models[modelNamePascalCase].schema = new ModelSchema(modelNamePascalCase, modelInfos, db);
    });

    db.register(models).then(function () {
        plugin.expose('db', db);
        next();
    })['catch'](function (error) {
        next(error);
    });
};

archimedesPlugin.attributes = {
    name: 'archimedes'
};

exports['default'] = archimedesPlugin;
module.exports = exports['default'];