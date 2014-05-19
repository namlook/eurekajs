
express = require 'express'
engine = require './engine'

###
Exemple:

var Eurekapi = require('eurekapi');

var server = new Eurekapi({
    name: 'projectName',
    version: 1,
    port: 4000,
    database: {
        adapter: 'rdf',
        config: {
            store: 'virtuoso',
            graphURI: 'http://projectName.com'
        }
    },
    schemas: require('./schemas')
});
server.start();
###

class Server

    constructor: (@config) ->

        if not config.name
            throw 'EurekaServer: name is required'
        @apiVersion = config.version or 1
        @baseURI = @config.baseURI or "/api/#{config.version}"
        @applicationName = @config.name or 'Oreka project'
        @db = @getDatabase()

        @app = express()
        path = require("path");
        # @app.use("/app/", express.static("#{__dirname}/../../public"))
        @app.use("/app", express.static("#{path.resolve('.')}/public"))
        @app.use(express.urlencoded())
        @app.use(express.json())
        @app.use (req, res, next) =>
            req.db = @db
            req.applicationName = @applicationName
            req.config = @config
            next()

        @app.get     "#{@baseURI}/:type/count",            engine.count
        @app.get     "#{@baseURI}/:type/facets/:field",    engine.facets
        @app.get     "#{@baseURI}/:type/describe",         engine.describe
        @app.get     "#{@baseURI}/:type/:id",              engine.find
        @app.delete  "#{@baseURI}/:type/:id",              engine.delete
        @app.get     "#{@baseURI}/:type",                  engine.find
        @app.post    "#{@baseURI}/:type",                  engine.sync
        # @app.put     "#{@baseURI}/:type/:id",              engine.sync
        @app.get     "#{@baseURI}/_ref",                   engine.findReference
        @app.get     "#{@baseURI}",                        engine.gettingStarted


    getDatabase: () ->
        unless @config.database?
            throw 'EurekaServer: database is required'
        if @config.database.dbtype?
            return @config.database

        unless @config.database.adapter?
            throw 'EurekaServer: database adapter is required'

        Model = require "archimedes/lib/#{@config.database.adapter}/model"

        models = {}
        for modelName, modelInfos of @config.schemas
            models[modelName] = Model.extend(modelInfos)

        Database = require "archimedes/lib/#{@config.database.adapter}/database"
        db = new Database @config.database.config
        db.registerModels models
        return db


    start: (port, callback) ->
        if not callback and typeof(port) is 'function'
            callback = port
            port = @config.port
        unless port
            port = @config.port
        console.log "starting http://localhost:#{port}..."
        console.log "api accessible at http://localhost:#{port}#{@baseURI}"

        @server = require('http').createServer(@app)
        @server.listen port, callback


    stop: (callback) ->
        unless @server
            throw "Server not started"
        @server.close callback


# app.get     '/api/facets/:facet',       api.facets
# app.get     '/api/facets',              api.facets
# app.get     '/api/describes',           api.describes
# app.get     '/api/documents',           api.find
# app.get     '/api/query',               api.describeQuery
# app.get     '/api/count',               api.count
# app.get     '/api/:type/describes',     api.describes
# app.get     '/api/:type/facets/:facet', api.facets
# app.get     '/api/:type/facets',        api.facets
# app.get     '/api/:type/documents/:id', api.findOne
# app.get     '/api/:type/documents',     api.find
# app.get     '/api/:type/query',         api.describeQuery
# app.get     '/api/:type/count',         api.count
# app.get     '/api/:type',               api.all

module.exports = Server
