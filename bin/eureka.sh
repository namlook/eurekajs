#!/bin/sh


case "$1" in
    new)
        ember new $2 --skip-npm --skip-bower
        cd $2
        npm uninstall --save-dev ember-data

        npm install

        npm install --save namlook/eurekajs
        npm install --save-dev bower nodemon
        npm install --save require-dir docker-links

        ./node_modules/.bin/bower install

        ## remove files which will be updated by eureka
        ## so we don't have the prompt asking us to confirm
        rm app/app.js
        rm app/router.js
        rm app/templates/application.hbs
        rm config/environment.js

        echo "{\"secret\": \"`uuidgen`\", \"email\": \"contact@example.com\"}" >> ./config/secret.json
        mkdir -p config/schemas
        touch config/schemas/.gitkeep

        mkdir -p config/eureka/resources
        touch config/eureka/resources/.gitkeep

        mkdir -p backend/routes
        touch backend/routes/.gitkeep

        mkdir -p backend/resources
        touch backend/resources/.gitkeep

        mkdir -p backend/tasks
        touch backend/tasks/.gitkeep

        ember install \
            namlook/ember-eureka \
            namlook/ember-bootstrap-hurry \
            ember-moment \
            namlook/eureka-mixin-actionable-widget \
            namlook/eureka-widget-application-menu \
            namlook/eureka-widget-application-navbar \
            namlook/eureka-widget-collection-navbar \
            namlook/eureka-mixin-query-parametrable-widget \
            namlook/eureka-widget-collection-display \
            namlook/eureka-widget-model-navbar \
            namlook/eureka-widget-model-display \
            namlook/eureka-widget-model-form

        git add app config backend bower.json package.json \
            .dockerignore docker-compose.yml \
            Dockerfile_backend Dockerfile_frontend \
            nginx.conf
        git commit -m "initialize eureka"

        echo "project initialized with success !"
        ;;


    # oldnew)
    #     ember new $2 --skip-npm --skip-bower
    #     cd $2
    #     npm uninstall --save-dev ember-data
    #
    #     ## fixes ember-cli@0.1.15
    #     # npm uninstall --save-dev glob
    #     # npm install --save-dev glob@4.4.0
    #
    #     npm install
    #     npm install --save namlook/eurekajs
    #     bower install
    #
    #     # ember install:npm eurekajs
    #
    #     ember install:addon namlook/ember-select2-hurry#v0.0.4
    #     ember install:addon ember-bootstrap-hurry
    #     ember install:addon ember-moment
    #
    #     ## remove files which will be updated by eureka
    #     ## so we don't have the prompt asking us to confirm
    #     rm app/app.js
    #     rm app/router.js
    #     rm app/templates/application.hbs
    #     rm config/environment.js
    #
    #     ember install:addon namlook/ember-eureka#v0.0.14
    #
    #     git add app config backend bower.json package.json
    #     git commit -m "initialize eureka"
    #
    #     ember install:addon namlook/eureka-mixin-actionable-widget#v0.0.1
    #     ember install:addon namlook/eureka-mixin-query-parametrable-widget#v0.0.1
    #     ember install:addon namlook/eureka-widget-application-menu#v0.0.5
    #     ember install:addon namlook/eureka-widget-application-navbar#v0.0.6
    #     ember install:addon namlook/eureka-widget-collection-display#v0.0.5
    #     ember install:addon namlook/eureka-widget-collection-navbar#v0.0.1
    #     # ember install:addon namlook/eureka-widget-collection-query
    #     ember install:addon namlook/eureka-widget-model-navbar#v0.0.2
    #     ember install:addon namlook/eureka-widget-model-form#v0.0.3
    #     ember install:addon namlook/eureka-widget-model-display#v0.0.4
    #     ;;

    watch-backend)
        ./node_modules/.bin/nodemon -w config/schemas -w config/server.js -w backend backend/index.js
        ;;

    watch-frontend)
        ./node_modules/.bin/ember server
        ;;

    generate-resource)
        ember g eureka-resource $2
        ember g eureka-resource-schema $2
        ;;

    # oldwatch)
    #     if [ -z "$EUREKA_SERVER_PORT" ]; then echo "\nERROR: the variable EUREKA_SERVER_PORT is not defined, please set it:\n\t export EUREKA_SERVER_PORT=<port number>\n"; exit; fi
    #     ./node_modules/eurekajs/node_modules/nodemon/bin/nodemon.js  backend/index.js --watch config &
    #     ./node_modules/eurekajs/node_modules/nodemon/bin/nodemon.js  --exec "./node_modules/ember-cli/bin/ember serve --proxy http://localhost:$EUREKA_SERVER_PORT" --watch config
    #     ;;

    dockerize)
        VERSION=`grep '"version"' package.json | cut -d '"' -f 4`
        NAME=`grep '"name"' package.json | cut -d '"' -f 4`
        AUTHOR=`grep '"author"' package.json | cut -d '"' -f 4`

        if [ -z "$AUTHOR" ]; then echo "\nERROR: no author found in package.json"; exit; fi

        read -p "Do you want do build the app for production? [y/N] " RESP
        if [ "$RESP" = "y" ]; then
            echo "building ember app for production"
            ./node_modules/.bin/ember build --env=production

            DOCKER_IMAGE="$AUTHOR/$NAME-frontend:$VERSION"
            DOCKER_PID=`docker ps | grep $DOCKER_IMAGE | cut -d " " -f 1`

            echo "purging existing $DOCKER_IMAGE..."
            docker stop $DOCKER_PID 2>/dev/null && docker rm $DOCKER_PID 2>/dev/null
            docker rmi $DOCKER_IMAGE 2>/dev/null

            echo "building the docker image $DOCKER_IMAGE..."
            docker build -f Dockerfile_frontend --rm -t $DOCKER_IMAGE .
        fi

        DOCKER_IMAGE="$AUTHOR/$NAME-backend:$VERSION"
        DOCKER_PID=`docker ps | grep $DOCKER_IMAGE | cut -d " " -f 1`

        echo "purging existing $DOCKER_IMAGE..."
        docker stop $DOCKER_PID 2>/dev/null && docker rm $DOCKER_PID 2>/dev/null
        docker rmi $DOCKER_IMAGE 2>/dev/null

        echo "building the docker image $DOCKER_IMAGE..."
        docker build -f Dockerfile_backend --rm -t $DOCKER_IMAGE .
        ;;


    # olddockerize)
    #     VERSION=`grep '"version"' package.json | cut -d '"' -f 4`
    #     NAME=`grep '"name"' package.json | cut -d '"' -f 4`
    #     AUTHOR=`grep '"author"' package.json | cut -d '"' -f 4`
    #
    #     if [ -z "$AUTHOR" ]; then echo "\nERROR: no author found in package.json"; exit; fi
    #
    #
    #     read -p "Do you want do build the app for production? [y/N] " RESP
    #     if [ "$RESP" = "y" ]; then
    #         echo "building ember app for production"
    #         ./node_modules/.bin/ember build --env=production
    #     fi
    #
    #     DOCKER_IMAGE="$AUTHOR/$NAME:$VERSION"
    #     DOCKER_PID=`docker ps | grep $DOCKER_IMAGE | cut -d " " -f 1`
    #
    #     echo "purging existing $DOCKER_IMAGE..."
    #     docker stop $DOCKER_PID 2>/dev/null && docker rm $DOCKER_PID 2>/dev/null
    #     docker rmi $DOCKER_IMAGE 2>/dev/null
    #
    #     echo "building the docker image $DOCKER_IMAGE..."
    #     docker build --rm -t $DOCKER_IMAGE .
    #     ;;

    deploy)
        VERSION=`grep '"version"' package.json | cut -d '"' -f 4`
        NAME=`grep '"name"' package.json | cut -d '"' -f 4`
        AUTHOR=`grep '"author"' package.json | cut -d '"' -f 4`
        if [ -z "$AUTHOR" ]; then echo "\nERROR: no author found in package.json"; exit; fi

        DOCKER_IMAGE="$AUTHOR/$NAME:$VERSION"

        echo "uploading the docker image $DOCKER_IMAGE..."
        docker push $DOCKER_IMAGE
        ;;

    resource)
        ember generate eureka-resource $2
        ember generate eureka-resource-schema $2
        ;;

    # drop-data)
    #     GRAPHNAME=`grep graph config/server.js | cut -d ':' -f 2- |head -n 1|tr -d '[[:space:]]'|tr -d "'" |tr -d '"'`
    #     echo "SPARQL CLEAR GRAPH '$GRAPHNAME'"
    #     isql exec="SPARQL CLEAR GRAPH '$GRAPHNAME'"
    #     ;;
    #
    # import-data)
    #     TTLDATA=$2
    #     FILENAME=$(basename $2)
    #     NAME=`grep '"name"' package.json | cut -d '"' -f 4`
    #     echo "coping data to /tmp/$NAME-$FILENAME"
    #     cp $TTLDATA /tmp/$NAME-$FILENAME
    #     GRAPHNAME=`grep graph config/server.js | cut -d ':' -f 2- |head -n 1|tr -d '[[:space:]]'|tr -d "'" |tr -d '"'`
    #     echo "loading data"
    #     isql exec="DB.DBA.TTLP (file_to_string_output ('/tmp/$NAME-$FILENAME'), '', '$GRAPHNAME');"
    #     ;;
    #
    # push-version)
    #     VERSION=$2
    #     echo "publishing version $VERSION"
    #     npm version $2
    #     (git push origin master && git push origin --tags) # && npm publish)
    #     ;;

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
        echo $"Usage: $0 {new|watch-backend|watch-frontend|dockerize}"
        exit 1

esac
