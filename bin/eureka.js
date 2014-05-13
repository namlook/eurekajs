#!/usr/bin/env node

var program = require('commander');
var path = require('path');
var fs = require('fs');
var Handlebars = require('handlebars');

program
  .version('0.0.1')
  .usage("[command] [options]\n\n  Command-Specific Help\n\n    eureka [command] --help");


var init = function(projectName, options) {
    if (options.uri === undefined) {
        options.uri = 'http://'+projectName.toLowerCase()+'.com';
    }

    // building skeleton directories
    dirPaths = ['js', 'js/client', 'public', 'public/css'];

    dirPaths.forEach(function(dirpath){
        if (!fs.existsSync(dirpath)) {
            fs.mkdirSync(dirpath);
        }
    });


    // create empty file for /public/css/style.css and /public/templates.js
    fs.writeFileSync('public/css/style.css', '', {encoding: 'utf8'});
    fs.writeFileSync('public/templates.js', '', {encoding: 'utf8'});


    // generate blueprint templates
    var blueprintPath = path.resolve(__dirname, '..', 'blueprint');

    var blueprints = [
        {targetPath: 'js/client/index.js', fileName: 'client.index.js.hbs'},
        {targetPath: 'package.json', fileName: 'package.json.hbs'},
        {targetPath: 'public/index.html', fileName: 'public.index.html.hbs'},
        {targetPath: 'js/schemas.js', fileName: 'schemas.js.hbs'},
        {targetPath: 'js/server.js', fileName: 'server.js.hbs'}
    ];

    blueprints.forEach(function(blueprint) {
        var templateFilePath = path.resolve(blueprintPath, blueprint.fileName);
        var templateFile = fs.readFileSync(templateFilePath, {encoding: 'utf8'});
        var template = Handlebars.compile(templateFile);
        var content = template({
            projectName: projectName,
            port: options.port,
            projectURI: options.uri
         });

        // writing templates
        var isFileExists = fs.existsSync(blueprint.targetPath);
        if (!isFileExists || isFileExists && options.force) {
            console.log('writing', blueprint.targetPath);
            fs.writeFileSync(blueprint.targetPath, content, {encoding: 'utf8'});
        } else {
            console.log(blueprint.targetPath, 'already exits, skipping...');
        }
    });


    // installing project with NPM
    console.log('Installing project...');

    var npm = require('npm');
    var npmOptions = {
      // loglevel: options.verbose ? 'log' : 'error',
      // logstream: ui.outputStream,
      color: 'always'
    };
    npm.load(npmOptions, function(err) {
        if (err) {
            return console.log(err);
        }
        npm.commands.install([], function(err, data) {
            if (err) {
                return console.log(err);
            }
            console.log('\n');
            console.log('Done...');
            console.log('"npm start" to launch the server');
            console.log('Have fun !');
        });
    });
};

program
  .command('init <projectName>')
  .description('generate the base structure of the application')
  .usage('<projectName> [options]')
  .option('-u, --uri <projectURI>', 'the uri of the project (ex: http://<projectName>.com)')
  .option('-p, --port <port>', 'the port the server has to use (defaults to 4000)', 4000)
  .option('-f, --force', 'force overwriting files')
  .action(init);


program.parse(process.argv);

