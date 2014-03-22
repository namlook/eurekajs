
express = require 'express'
engine = require './engine'

class Server

    constructor: (@config) ->

        @baseURI = @config.baseURI or "/api/#{config.version}"
        @applicationName = @config.name or 'Oreka project'
        @db = @getDatabase()

        @app = express()
        path = require("path");
        # @app.use("/app/", express.static("#{__dirname}/../../public"))
        console.log("#{path.resolve('.')}/public")
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
        @app.get     "#{@baseURI}/:type",                  engine.find
        @app.post    "#{@baseURI}/:type",                  engine.sync
        @app.put     "#{@baseURI}/:type",                  engine.sync
        @app.get     "#{@baseURI}/_id",                    engine.findIds
        @app.delete  "#{@baseURI}",                        engine.clear
        @app.get     "#{@baseURI}",                        engine.gettingStarted


    getDatabase: () ->
        unless @config.database?
            return 'EurekaServer: database is required'
        if @config.database.dbtype?
            return @config.database

        unless @config.database.adapter?
            return 'EurekaServer: database adapter is required'

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
