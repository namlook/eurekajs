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


var generateBlueprint = function(targetPath, fileName, options) {
    var blueprintPath = path.resolve(__dirname, '..', 'blueprint');

    var templateFilePath = path.resolve(blueprintPath, fileName);
    var templateFile = fs.readFileSync(templateFilePath, {encoding: 'utf8'});
    var template = Handlebars.compile(templateFile);
    var content = template(options);
     //    projectName: options.projectName,
     //    author: options.author,
     //    license: options.license,
     //    port: options.port,
     //    projectURI: options.uri,
     //    dasherizedProjectName: options.dasherizedProjectName
     // });

    // writing templates
    var isFileExists = fs.existsSync(targetPath);
    if (!isFileExists || isFileExists && options.force) {
        console.log('writing', targetPath);
        fs.writeFileSync(targetPath, content, {encoding: 'utf8'});
    } else {
        console.log(targetPath, 'already exits, skipping...');
    }
};


var init = function(projectName, author, options) {
    if (options.uri === undefined) {
        options.uri = 'http://'+projectName.toLowerCase()+'.com';
    }
    options.projectName = projectName;
    options.author = author;

    // building skeleton directories
    dirPaths = ['app', 'app/server', 'app/frontend', 'public', 'public/css'];

    dirPaths.forEach(function(dirpath){
        if (!fs.existsSync(dirpath)) {
            fs.mkdirSync(dirpath);
        }
    });

    // create empty file for /public/css/style.css and /public/templates.js
    fs.writeFileSync('public/css/style.css', '', {encoding: 'utf8'});
    fs.writeFileSync('public/templates.js', '', {encoding: 'utf8'});


    // generate blueprint templates
    var blueprints = [
        {targetPath: 'app/frontend/index.js', fileName: 'frontend.index.js.hbs'},
        {targetPath: 'app/frontend/config.js', fileName: 'frontend.config.js.hbs'},
        {targetPath: 'app/server/index.js', fileName: 'server.index.js.hbs'},
        {targetPath: 'app/server/config.js', fileName: 'server.config.js.hbs'},
        {targetPath: 'package.json', fileName: 'package.json.hbs'},
        {targetPath: 'bower.json', fileName: 'bower.json.hbs'},
        {targetPath: 'public/index.html', fileName: 'public.index.html.hbs'},
        {targetPath: 'app/schemas.js', fileName: 'schemas.js.hbs'}
    ];

    blueprints.forEach(function(blueprint) {
        generateBlueprint(blueprint.targetPath, blueprint.fileName, options);
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

var _dockerize = function(options, callback) {
    var projectPackage = require(path.resolve('./package.json'));
    var projectName = projectPackage.name;
    options.version = projectPackage.version;
    options.author = projectPackage.author;
    options.port = 4000; // TODO
    options.dasherizedProjectName = _.str.dasherize(projectName).slice(1);
    console.log(options, options.version);

    // generate Dockerfile from blueprints
    generateBlueprint('Dockerfile', 'Dockerfile.hbs', options);

    console.log("docker build --force-rm=true -t "+options.dasherizedProjectName+":"+options.version+" .");
    var child = spawn('docker', ['build', '--force-rm=true', '-t', options.dasherizedProjectName+':'+options.version, '.']);

    child.stdout.on('data', function(chunk) {
        process.stdout.write(chunk.toString('utf-8'));
    });

    child.stderr.on('data', function(chunk) {
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

    var callback = function(err) {
        if (err) {
            console.log(err);
        }
    };

    if (options.build) {
        build(options, function(err) {
            _dockerize(options, callback);
        });
    } else {
        _dockerize(options, callback);
    }
};

program
  .command('init <projectName> <author>')
  .description('generate the base structure of the application')
  .usage('<projectName> <author> [options]')
  .option('-d, --description <description>', 'the description of the project', '')
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
  .option('--build', "don't build the project after init", false)
  .option('-f, --force', 'force overwriting files')
  .action(dockerize);

program.parse(process.argv);

