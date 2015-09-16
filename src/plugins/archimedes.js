
import {triplestore} from 'archimedes';
// import ModelSchema from './model-schema';
import {pascalCase} from '../utils';
import _ from 'lodash';

var archimedesPlugin = function(plugin, options, next) {

    if (options.log) {
        options.log = _.isArray(options.log) && options.log || [options.log];

        plugin.on('log', function(message) {
            if (_.contains(message.tags, 'database')) {
                if (_.intersection(message.tags, options.log).length) {
                    console.log(message.tags, message.data);
                }
            }
        });
    }

    // let adapter = options.database.adapter;
    // let databaseConfig = options.database.config;
    let schemas = options.schemas;

    // var Database = archimedes[adapter].Database;
    // var Model = archimedes[adapter].Model;

    let models = {};
    // var db = new Database(databaseConfig);
    let db = triplestore(options.database.config);

    _.forOwn(schemas, (modelInfos, modelName) => {
        var modelNamePascalCase = pascalCase(modelName);
        models[modelNamePascalCase] = modelInfos;

    //     if (modelName === 'Basic') {
    //         throw "EurekaServer: 'Basic' is a reserved word and can not be used as model name";
    //     }

    //     if (!modelInfos.properties) {
    //         plugin.log(['warn', 'database'], `${modelName} has no properties`);
    //         modelInfos.properties = {};
    //     }

        plugin.log(['info', 'database'], `register model ${modelNamePascalCase} (with ${Object.keys(modelInfos.properties).length} properties)`);

        // models[modelNamePascalCase] = Model.extend({
        //     schema: modelInfos.properties
        // });

    //     // TODO put the following line in archimedes ?
    //     models[modelNamePascalCase].schema = new ModelSchema(modelNamePascalCase, modelInfos, db);
    });

    db.register(models).then(() => {
        plugin.expose('db', db);
        next();
    }).catch((error) => {
        next(error);
    });
};

archimedesPlugin.attributes = {
    name: 'archimedes'
};

export default archimedesPlugin;
