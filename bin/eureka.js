#!/usr/bin/env node

var program = require('commander');
var path = require('path');
var fs = require('fs');
var Handlebars = require('handlebars');
var _ = require('underscore');
_.str = require('underscore.string');
var child_process = require('child_process');
var merge = require('deepmerge');
var flat = require('flat');
var async = require('async');
var colors = require('colors');
var rmdir = require('rimraf');
var _generateConfig = require('./eureka-config');
var readlineSync = require('readline-sync');
var gitConfig = require('git-config');

var generateConfig = function(environment, options, callback) {
    if (!environment) {
        environment = process.env.NODE_ENV||'development';
    }
    _generateConfig(environment, options, callback);
};

var execCmd = function(cmd, callback) {

    child_process.exec(cmd, {cwd: path.resolve('.')}, function (error, stdout, stderr) {
        if (stdout) {
            console.log(stdout);
        }
        if (stderr) {
            console.log(stderr);
        }
        if (error !== null) {
            console.log('error: ' + error);
        }

        if (callback) {
            if (error) {return callback(error);}
            else {return callback(null);}
        }
    });
};

var spawnCmd = function(cmd, args, options, callback) {
    console.log(cmd, args, options);
    var child = child_process.spawn(cmd, args, options);

    child.stdout.on('data', function(chunk) {
        process.stdout.write(chunk.toString('utf-8'));
    });

    child.stderr.on('data', function(chunk) {
        process.stdout.write(chunk.toString('utf-8'));
    });


    child.on('error', function(err) {
        console.log(err);
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

var dasherize = function(string) {
    return _.str.dasherize(string).slice(1);
};


var generateBlueprint = function(targetPath, fileName, options) {
    var blueprintPath = path.resolve(__dirname, '..', 'blueprint');

    if (options.desc) {
        options.description = options.desc;
    }

    var templateFilePath = path.resolve(blueprintPath, fileName);
    var templateFile = fs.readFileSync(templateFilePath, {encoding: 'utf8'});
    var template = Handlebars.compile(templateFile);
    var content = template(options);

    // writing templates
    var isFileExists = fs.existsSync(targetPath);
    overwrite = false;
    if (isFileExists) {
        if (options.force) {
            overwrite = true;
        }
        if (!options.force) {
            var answer = readlineSync.question('Overwrite '+targetPath+'? (N/y): ');
            if (answer.toLowerCase() === 'y') {
                overwrite = true;
            }
        }
    }
    if (!isFileExists || overwrite) {
        console.log('writing', targetPath);
        fs.writeFileSync(targetPath, content, {encoding: 'utf8'});
    }
};


var newCommand = function(projectName, options) {
    var projectDirectoryPath = path.resolve(dasherize(projectName));

    var projectDirectory;
    try {
        projectDirectory = fs.statSync(projectDirectoryPath);
    } catch (e) {
        projectDirectory = null;
    }

    if (projectDirectory) {
        if (!options.force) {
            return console.log(projectDirectoryPath.red+' already exits, please use --force to overwrite'.red);
        } else {
            rmdir.sync(projectDirectoryPath);
        }
    }

    fs.mkdirSync(projectDirectoryPath);
    process.chdir(projectDirectoryPath);

    options.force = true;
    initCommand(projectName, options, function(err) {
        if (err) {return console.log(err);}
        var message = '\nNow "cd '+dasherize(projectName)+'" and "npm start" to launch the server';
        console.log(message.bold.green);
        console.log('Have fun !'.green);

    });
};


var initCommand = function(projectName, options, callback) {
    if (options.uri === undefined) {
        options.uri = 'http://'+projectName.toLowerCase()+'.com';
    }
    options.testUri = 'http://'+options.uri.slice(7);
    options.projectName = projectName;
    if (!options.author) {
        var config = gitConfig.sync();
        var author = '';
        if (config.user.name) {
            author = config.user.name;
        }
        if (config.user.email) {
            author += ' <'+config.user.email+'>';
        }
        options.author = author;
    }

    // building skeleton directories
    dirPaths = ['app', 'app/server', 'app/frontend', 'config', 'config/server', 'config/frontend'];

    dirPaths.forEach(function(dirpath){
        if (!fs.existsSync(dirpath)) {
            fs.mkdirSync(dirpath);
        }
    });

    // generate blueprint templates
    var blueprints = [
        {targetPath: '.gitignore', fileName: 'gitignore.hbs'},
        {targetPath: 'package.json', fileName: 'package.json.hbs'},
        {targetPath: 'bower.json', fileName: 'bower.json.hbs'},
        {targetPath: 'Gruntfile.js', fileName: 'Gruntfile.js.hbs'},
        {targetPath: 'karma.conf.js', fileName: 'karma.conf.js.hbs'},
        {targetPath: 'config/vendors-list.js', fileName: 'config.vendors-list.js.hbs'},
        {targetPath: 'config/server/server.js', fileName: 'config.server.server.js.hbs'},
        {targetPath: 'config/server/development.js', fileName: 'config.server.development.js.hbs'},
        {targetPath: 'config/server/test.js', fileName: 'config.server.test.js.hbs'},
        {targetPath: 'config/server/production.js', fileName: 'config.server.production.js.hbs'},
        {targetPath: 'config/frontend/frontend.js', fileName: 'config.frontend.frontend.js.hbs'},
        {targetPath: 'config/frontend/development.js', fileName: 'config.frontend.development.js.hbs'},
        {targetPath: 'config/frontend/test.js', fileName: 'config.frontend.test.js.hbs'},
        {targetPath: 'config/frontend/production.js', fileName: 'config.frontend.production.js.hbs'},
        {targetPath: 'app/server/index.js', fileName: 'app.server.index.js.hbs'},
        {targetPath: 'app/frontend/index.js', fileName: 'app.frontend.index.js.hbs'},
        {targetPath: 'app/schemas.js', fileName: 'schemas.js.hbs'},
        {targetPath: 'app/app.css', fileName: 'app.css.hbs'},
        {targetPath: 'app/index.html', fileName: 'app.index.html.hbs'}
    ];

    blueprints.forEach(function(blueprint) {
        generateBlueprint(blueprint.targetPath, blueprint.fileName, options);
    });

    var finishMessage = '\nNow "npm start" to launch the server\nHave fun !'.green.bold;
    if (options.install) {
        installCommand(options, function(err) {
            if (callback) {
                return callback(err);
            }

            if (err) {return console.log(err.red);}
            console.log(finishMessage);
        });
    } else {
        if (callback) {
            return callback(null);
        } else {
            console.log(finishMessage);
        }
    }
};


var installCommand = function(options, callback) {
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
            console.log(options.projectName.green+' installed with success'.green);
            if (callback) {
                return callback(null, options);
            }
        });
    });
};

var bowerInstall = function(options, callback) {
    var bowerBin = "./node_modules/eurekapi/node_modules/.bin/bower";
    spawnCmd(bowerBin, ['install'], {cwd: path.resolve('.')}, callback);
};


var postInstallCommand = function(options, callback) {
    bowerInstall(options, function(err) {
        if (err) {
            if (callback) {return callback(err);}
            return console.log(err);
        }
        buildCommand(options, function(err) {
            if (err) {
                if (callback) {return callback(err);}
                return console.log(err);
            }
            console.log('done');
        });
    });
};

var buildApp = function(options, callback) {
    var browserifyBin = path.resolve('./node_modules/eurekapi/node_modules/.bin/browserify');
    var currentPath = path.resolve('.');
    execCmd(browserifyBin+" app/frontend -o public/app.js", function(err) {
        console.log('app built into public/app.js...'.green);
        if (callback) {
            if (err) {return callback(err);}
            return callback(null);
        }
    });

};


var buildTemplatesCommand = function(options, callback) {
    var publicTemplatesPath = path.resolve('./public/templates.js');

    // rm public/templates.js
    try {
        fs.unlinkSync(publicTemplatesPath);
    } catch (e) {

    }

    // touch public/templates.js
    fs.openSync(publicTemplatesPath, 'w');

    var templatesExists;
    try {
        templatesExists = fs.statSync('./app/frontend/templates').isDirectory();
    } catch (e) {
        templatesExists = false;
    }

    var emberPrecompileBin = path.resolve('./node_modules/eurekapi/node_modules/.bin/ember-precompile');
    if (templatesExists) {
        execCmd(emberPrecompileBin+' app/frontend/templates/*.hbs > public/templates.js', function(err) {
            console.log('templates compiled into public/templates.js...'.green);
            if (callback) {
                if (err) {return callback(err);}
                return callback(null);
            }

        });
    }

};

var buildDist = function(options, callback) {
    var publicBowerPath = path.resolve('./public/vendors');
    var link;
    try {
        link = fs.readlinkSync(publicBowerPath);
    } catch (e) {
        link = null;
    }

    if (link !== '../bower_components') {
        try {
            fs.unlinkSync(publicBowerPath);
        } catch (e) {}
        fs.symlinkSync('../bower_components', publicBowerPath);
    }
    if (callback) {
        return callback(null);
    }
};

var buildCommand = function(options, callback) {
    console.log('building the project...');
    generateConfig(options.env || 'development', options, function() {

        buildDist(options, function() {
            async.parallel([
                function(callback){
                    buildApp(options, callback);
                },
                function(callback){
                    buildTemplatesCommand(options, callback);
                }
            ],
            function(err, results) {
                console.log('done.'.bold.green);
                if (callback) {
                    if (err) {return callback(err);}
                    return callback(null);
                }
            });

        });

    });
};


var _dockerize = function(organization, options, callback) {
    var projectPackage = require(path.resolve('./package.json'));
    var projectName = projectPackage.name;
    options.version = projectPackage.version;
    options.author = projectPackage.author;
    options.port = require(path.resolve('./app/server/config.json')).port;
    options.dasherizedProjectName = dasherize(projectName);
    options.organization = organization;

    // generate Dockerfile from blueprints
    generateBlueprint('Dockerfile', 'Dockerfile.hbs', options);

    var imageName = options.organization+'/'+options.dasherizedProjectName+':'+options.version;
    console.log("docker build --force-rm=true -t "+imageName+" .");
    spawnCmd('docker', ['build', '--force-rm=true', '-t', imageName, '.'], callback);
};


var dockerizeCommand = function(options) {

    var callback = function(err) {
        if (err) {
            console.log(err);
        }
    };

    if (options.build) {
        installCommand(options, function(err) {
            _dockerize(options, callback);
        });
    } else {
        _dockerize(options, callback);
    }
};


program
  .version('0.0.1')
  .usage("[command] [options]\n\n  Command-Specific Help\n\n    eureka [command] --help");

program
  .command('new <projectName>')
  .description('init the project in a new directory and install it')
  .usage('<projectName> [options]')
  .option('-a, --author <author>', 'the author of the project')
  .option('-d, --desc <description>', 'the description of the project', '')
  .option('-u, --uri <projectURI>', 'the uri of the project (ex: http://<projectName>.com)')
  .option('-p, --port <port>', 'the port the server has to use (defaults to 4000)', 4000)
  .option('-l, --license <license>', 'the license of the project (default to "MIT")', 'MIT')
  .option('-f, --force', 'force overwriting files')
  .option('--no-install', "don't install the project after init")
  .action(newCommand);

program
  .command('init <projectName>')
  .description('generate the base structure of the application in the current directory and install it')
  .usage('<projectName> [options]')
  .option('-a, --author <author>', 'the author of the project')
  .option('-d, --desc <description>', 'the description of the project', '')
  .option('-u, --uri <projectURI>', 'the uri of the project (ex: http://<projectName>.com)')
  .option('-p, --port <port>', 'the port the server has to use (defaults to 4000)', 4000)
  .option('-l, --license <license>', 'the license of the project (default to "MIT")', 'MIT')
  .option('-f, --force', 'force overwriting files')
  .option('--install', "install the project after init")
  .action(initCommand);

// program
//   .command('install')
//   .description('install the project and its dependencies')
//   .option('--env <environment>', 'build the project for a specific environment (will generate a config for the environment)', process.env.NODE_ENV||'development')
//   .action(installCommand);

// program
//   .command('build')
//   .description('build the project')
//   .option('--env <environment>', 'build the project for a specific environment (will generate a config for the environment)', process.env.NODE_ENV||'development')
//   .action(buildCommand);

// program
//   .command('build-template')
//   .description('pre-compile the templates')
//   .action(buildTemplatesCommand);

program
  .command('dockerize <organization>')
  .description('put the application into a docker image called <organization>/<project-name>:<project-version>')
  .option('--build', "build the project before dockerization", false)
  .option('-f, --force', 'force overwriting files')
  .action(dockerizeCommand);

program
  .command('config [environment]')
  .description('generate configuration files for a specific environment')
  .action(generateConfig);


// program
//   .command('postinstall')
//   .description('install bower dependencies and build the project')
//   .option('--env <environment>', 'build the project for a specific environment (will generate a config for the environment)', process.env.NODE_ENV||'development')
//   .action(postInstallCommand);

program.parse(process.argv);

if (!program.args.length) {
    program.help();
}


