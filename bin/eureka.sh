#!/bin/sh


case "$1" in
        new)
            ember new $2
            cd $2
            npm uninstall --save-dev ember-data

            ember install:npm eurekajs

            ember install:addon ember-typeahead-input
            ember install:addon ember-dynamic-component
            ember install:addon ember-bootstrap-hurry
            ember install:addon ember-moment

            ember install:addon ember-eureka

            ember install:addon eureka-mixin-actionable-widget
            ember install:addon eureka-mixin-query-parametrable-widget
            ember install:addon eureka-widget-application-menu
            ember install:addon eureka-widget-application-navbar
            ember install:addon eureka-widget-collection-display
            ember install:addon eureka-widget-collection-navbar
            # ember install:addon eureka-widget-collection-query
            ember install:addon eureka-widget-model-display
            ember install:addon eureka-widget-model-form
            ember install:addon eureka-widget-model-navbar
            ;;

        watch)
            ./node_modules/eurekajs/node_modules/nodemon/bin/nodemon.js  backend/index.js --watch config &
            ./node_modules/eurekajs/node_modules/nodemon/bin/nodemon.js  --exec "ember serve --proxy http://localhost:4000" --watch config
            ;;

        deploy)
            echo 'production'
            ;;

        resource)
            ember generate eureka-resource $2
            ;;

        # restart)
        #     stop
        #     start
        #     ;;
        # condrestart)
        #     if test "x`pidof anacron`" != x; then
        #         stop
        #         start
        #     fi
            # ;;

        *)
            echo $"Usage: $0 {new|watch}"
            exit 1

esac

