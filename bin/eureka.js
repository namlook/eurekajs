#!/usr/bin/env node

var program = require('commander');
var path = require('path');
var fs = require('fs');
var Handlebars = require('handlebars');
var _ = require('underscore');
_.str = require('underscore.string');
var spawn = require('child_process').spawn;

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
        {targetPath: 'bower.json', fileName: 'bower.json.hbs'},
        {targetPath: 'Dockerfile', fileName: 'Dockerfile.hbs'},
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
            author: options.author,
            license: options.license,
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

    if (options.build) {
        build(options);
    }
};

var build = function(options, callback) {
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
                console.log(err);
                if (callback) {
                    return callback(err);
                }
                return;
            }
            console.log('\n');
            console.log('Done...');
            console.log('"npm start" to launch the server');
            console.log('Have fun !');
            if (callback) {
                return callback(null, options);
            }
        });
    });
};

var _dockerize = function(callback) {
    var projectPackage = require(path.resolve('./package.json'));
    var projectName = projectPackage.name;
    var version = projectPackage.version;
    var dasherizedName = _.str.dasherize(projectName).slice(1);
    console.log("docker build --force-rm=true -t "+dasherizedName+":"+version+" .");
    var child = spawn('docker', ['build', '--force-rm=true', '-t', dasherizedName+':'+version, '.']);

    child.stdout.on('data', function(chunk) {
        process.stdout.write(chunk.toString('utf-8'));
    });

    child.on('error', function(err) {
        if (callback) {
            return callback(err);
        }
    });

    child.on('close', function() {
        if (callback) {
            return callback(null);
        }
    });
};

var dockerize = function(options) {
    if (options.build) {
        build(options, _dockerize);
    } else {
        _dockerize();
    }
};

program
  .command('init <projectName>')
  .description('generate the base structure of the application')
  .usage('<projectName> [options]')
  .option('-u, --uri <projectURI>', 'the uri of the project (ex: http://<projectName>.com)')
  .option('-p, --port <port>', 'the port the server has to use (defaults to 4000)', 4000)
  .option('-a, --author <author>', 'the author of the project', '')
  .option('-l, --license <license>', 'the license of the project (default to "MIT")', 'MIT')
  .option('-f, --force', 'force overwriting files')
  .option('--no-build', "don't build the project after init")
  .action(init);

program
  .command('build')
  .description('build the application')
  .action(build);

program
  .command('dockerize')
  .option('--no-build', "don't build the project after init")
  .action(dockerize);

program.parse(process.argv);

