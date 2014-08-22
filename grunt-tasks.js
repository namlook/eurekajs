
module.exports = function(grunt, vendorFiles){
    var config = {

        env : {
            dev: {
                NODE_ENV : 'development'
            },

            prod : {
                NODE_ENV : 'production'
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
                'app/frontend/config.json',
                'app/server/config.json',
                'public',
                '.reboot-server'
            ]
        },

        // install bower components
        "bower-install-simple": {
            options: {
                color: true

            },
            "default": {
                options: {
                    production: process.env.NODE_ENV === 'production'
                }
            }
        },

        // build the application with browserify
        browserify: {
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
                overwrite: false
            },
            'default': {
                src: 'bower_components',
                dest: 'public/bower_components'
            }
        },

        // generate configuration files for a specific environement (see NODE_ENV)
        shell: {
            "eureka-config": {
                command: './node_modules/.bin/eureka config'
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
                    'public/app.min.js': ['public/app.js'],
                    'public/vendors.min.js': ['public/vendors.js'],
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
                    'public/app.min.css': 'app/styles/app.css',
                    'public/vendors.min.css': vendorFiles.css
                }
            }
        },

        // watch assets and server
        watch: {
            'default': {
                files: ['app/**/*', '!app/*/config.json'],
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
        }
    };

    require('jit-grunt')(grunt);
    grunt.loadNpmTasks("grunt-extend-config");
    grunt.initConfig(config);

    grunt.registerTask('eureka:setenv-development', ['env:dev']);
    grunt.registerTask('eureka:setenv-production', ['env:prod']);
    grunt.registerTask('eureka:clean', ['clean']);
    grunt.registerTask('eureka:configure', ['shell:eureka-config']);
    grunt.registerTask('eureka:build', ['preprocess', 'symlink', 'concat', 'cssmin', 'browserify', 'eureka:build-templates']);
    grunt.registerTask('eureka:build-templates', ['emberTemplates']);
    grunt.registerTask('eureka:dist', ['eureka:build', 'uglify']);
    grunt.registerTask('eureka:live', ['concurrent']);
    grunt.registerTask('eureka:install', ['bower-install-simple', 'eureka:configure', 'eureka:build']);
    grunt.registerTask('build', ['eureka:build']);
};

