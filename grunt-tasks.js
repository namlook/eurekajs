
module.exports = function(grunt, vendorFiles){
    var environment = process.env.NODE_ENV || 'development';
    environment = environment.toLowerCase();

    var config = {

        env : {
            dev: {
                NODE_ENV : 'development'
            },

            prod : {
                NODE_ENV : 'production'
            },
            test: {
                NODE_ENV: 'test'
            }
        },

        preprocess : {
            'default' : {
                src : 'app/index.html',
                dest : 'public/index.html'
            },
        },

        clean: {
            'default': [
                'public'
            ]
        },

        // install bower components
        "bower-install-simple": {
            options: {
                color: true

            },
            "default": {
                options: {
                    production: environment === 'production'
                }
            }
        },

        // build the application with browserify
        browserify: {
            options: {
                transform: ['envify']
            },
            'default': {
                src: ['app/frontend/index.js'],
                dest: 'public/app.js'
                // options: {
                    // external: ['jquery', 'momentWrapper'],
                // }
            }
        },

        // link bower_components in public
        symlink: {
            options: {
                overwrite: true
            },
            'bower_components': {
                src: 'bower_components',
                dest: 'public/bower_components'
            },
            "config": {
                files: [
                    {src: 'config/frontend/'+environment+'.js', dest: 'config/frontend/index.js'},
                    {src: 'config/server/'+environment+'.js', dest: 'config/server/index.js'}
                ]
            }
        },

        copy: {
            "assets": {
                files: [
                    {nonull: true, cwd: 'app', src: 'assets/**/*', dest: 'public', expand: true},
                ]
            }
        },

        // build templates into public/templates
        emberTemplates: {
            'default': {
                options: {
                    templateRegistration: function(name, content) {
                        name = name.split('/').slice(-1)[0].replace('.', '/');
                        return 'Ember.TEMPLATES["' + name + '"] = ' + content;
                    }
                },
                files: {
                    "./public/templates.js": ["app/frontend/templates/**/*.hbs", "app/frontend/templates/**/*.handlebars"]
                }
            }
        },

        // concat javascript
        concat: {
            'default': {
                src: vendorFiles.js,
                dest: 'public/vendors.js'
            }
        },

        // minify js
        uglify: {
            'default': {
                options: {
                    mangle: false
                },
                files: {
                    'public/vendors.min.js': ['public/vendors.js'],
                    'public/app.min.js': ['public/app.js'],
                    'public/templates.min.js': ['public/templates.js']
                }
            }
        },

        // minify css
        cssmin: {
            'default': {
                options: {
                    target: './public'
                },
                files: {
                    'public/vendors.min.css': vendorFiles.css,
                    'public/app.min.css': 'app/app.css'
                }
            }
        },

        // watch assets and server
        watch: {
            'default': {
                files: ['app/**/*', 'config/**/*'].concat(vendorFiles.js).concat(vendorFiles.css),
                tasks: ['build'],
            }
        },

        // restart server if public/app.js is changed
        nodemon: {
            'default': {
                script: 'app/server',
                options: {
                    watch: 'public/app.js'
                }
            }
        },

        concurrent: {
            'default': {
                options: {
                    logConcurrentOutput: true
                },
                tasks: ['nodemon', 'watch']
            }
        },

        karma: {
            unit: {
                configFile: 'karma.conf.js'
            }
        },

        attention: {
            'environment': {
                options: {
                    message: 'Building for the *'+environment+'* environment\n',
                    border: 'comment',
                    borderColor: 'gray'
                }
            },
            'build-success': {
                options: {
                    message: 'Built with success!\n\nTo start the server, type\n *$ npm start*',
                    border: 'comment',
                    borderColor: 'gray'
                }
            }
        }
    };

    require('jit-grunt')(grunt);
    grunt.loadNpmTasks("grunt-extend-config");
    grunt.initConfig(config);

    grunt.registerTask('eureka:setenv-development', ['env:dev']);
    grunt.registerTask('eureka:setenv-production', ['env:prod']);
    grunt.registerTask('eureka:setenv-test', ['env:test']);
    grunt.registerTask('eureka:clean', ['clean']);
    grunt.registerTask('eureka:configure', ['attention:environment', 'symlink:config']);
    grunt.registerTask('eureka:build-templates', ['emberTemplates']);
    grunt.registerTask('eureka:_build', ['eureka:clean', 'eureka:configure' , 'preprocess', 'symlink:bower_components', 'concat', 'cssmin', 'browserify', 'copy:assets', 'eureka:build-templates']);
    grunt.registerTask('eureka:build-test', ['eureka:_build']);
    grunt.registerTask('eureka:build', ['eureka:_build', 'attention:build-success']);
    grunt.registerTask('eureka:dist', ['eureka:_build', 'uglify', 'attention:build-success']);
    grunt.registerTask('eureka:live', ['concurrent']);
    grunt.registerTask('eureka:test', ['karma']);
    grunt.registerTask('eureka:install', ['bower-install-simple', 'eureka:configure', 'eureka:build']);
    grunt.registerTask('build', ['eureka:build']);
};


