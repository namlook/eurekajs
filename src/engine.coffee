
_ = require 'underscore'
_.str = require 'underscore.string'


#
# Private methods
#

value2js = (value) ->
    if value is 'true'
        value = true
    else if value is 'false'
        value = false
    else if parseFloat(value)+'' is value
        value = parseFloat(value)
    return value

params2pojo = (query) ->
    for key, value of query
        if _.isObject(value) and not _.isArray(value)
            query[key] = params2pojo(value)
        else
            query[key] = value2js(value)
    return query

validateType = (db, type) ->
    error = null
    unless type
        error = 'no type found'
    type = _.str.classify type
    unless db[type]?
        error = "unknown type: #{type}"
    return error

parseQuery = (query) ->
    results = {query: {}, options: {}}
    for key, value of query
        if _.str.startsWith(key, '_') and key not in ['_id', '_type', '_ref']
            value = value2js(query[key])
            if value?
                results.options[key[1..]] = value
        else
            if _.isArray(value)
                if key isnt '_ref'
                    value = {'$all': (value2js(i) for i in value)}
            else
                for $op in ['$in', '$nin', '$all', '$nall']
                    if value[$op]?
                        unless _.isArray(value[$op])
                            value[$op] = value[$op].split(',')
                        value[$op] = (value2js(i) for i in value[$op])

                if value['$exists']?
                    val = if value['$exists'] in ['true', '1', 'yes'] then true else false
                    value = {'$exists': val}
            results.query[key] = value
    return results


# ## gettingStarted
# display a getting started
#
# examples:
#   /api/1
exports.gettingStarted = (req, res) ->
    models = req.db.modelsList or []
    text = """
    <h1>#{req.applicationName}</h1>
    <p>You have #{models.length} registered models:</p>
    <ul>
    """
    for model in models
        text += "<li><a href='/api/1/#{_.str.underscored(model)}'>#{model}</a></li>"
    text += "</ul>"
    return res.send(text)

# ## count
# returns the number of documents that match the query
# options attributes are prefixed by undescore.
#
# examples:
#   /api/1/organism_classification/count?
#   /api/1/organism_classification/count?internetDisplay=true
exports.count = (req, res) ->
    error = validateType(req.db, req.params.type)
    if error
        return res.json(500, {error: error})
    type = _.str.classify req.params.type

    {query, options} = parseQuery(req.query)

    query = params2pojo(query)
    options = params2pojo(options)

    req.db[type].count query, options, (err, results) ->
        if err
            err = err.message if err.message?
            return res.json(500, {error: err})
        return res.json {total: parseInt(results, 10)}


# ## find
# returns all documents that match the query
# options attributes are prefixed by undescore.
#
# if an id is passed, fetch only the document which match the id
#
#   get /api/<version>/<type>/[<id>]?[<query>]&[<option>]
#
# examples:
#   /api/1/organism_classification?title@la=bandicota%20indica
#   /api/1/publication&_limit=30
#   /api/1/organism_classification?_populate=true&internetDisplay=true
#   /api/1/individual/C0012
#   /api/1/individual/C0012?_populate=true
exports.find = (req, res) ->
    error = validateType(req.db, req.params.type)
    if error
        return res.json(500, {error: error})
    type = _.str.classify req.params.type

    {query, options} = parseQuery(req.query)

    unless options.limit?
        options.limit = 30
    unless options.populate?
        options.populate = false

    options = params2pojo(options)
    query = params2pojo(query)

    if options.sortBy? and _.isString(options.sortBy)
        options.sortBy = options.sortBy.split(',')
    if _.isString(options.populate) and options.populate.indexOf(',') > -1
        options.populate = options.populate.split(',')

    if req.params.id?
        query = req.db.reference(type, req.params.id)
    else if query._id?
        query = req.db.reference(type, query._id)

    req.db[type].find query, options, (err, results) ->
        if err
            err = err.message if err.message?
            return res.json(500, {error: err})
        return res.json {
            results: (o.toJSONObject({
                populate: options.populate, dereference: true
            }) for o in results)
        }

# ## findReference
# returns all documents that match the query
# options attributes are prefixed by undescore.
#
#   get /api/<version>?_ref=<documentReference>&[_ref=<documentReference2>]
#
# examples:
#   /api/1/_ref?_id=http://ceropath.org/instances/individual/c0030
#   /api/1/_ref?_id=http://ceropath.org/instances/individual/c0030&_ref=http://ceropath.org/instances/individual/c0006
exports.findReference = (req, res) ->

    {query, options} = parseQuery(req.query)

    unless options.populate?
        options.populate = false

    options = params2pojo(options)
    query = params2pojo(query)

    if _.isString(options.populate) and options.populate.indexOf(',') > -1
        options.populate = options.populate.split(',')

    req.db[type].find query, options, (err, results) ->
        if err
            err = err.message if err.message?
            return res.json(500, {error: err})
        return res.json {
            results: (o.toJSONObject({populate: options.populate, dereference: true}) for o in results)
        }


# ## facets
# Group the data by a specified field
#
#   get /api/<version>/<type>/facet/<field>?[<query>]&[<options>]
#
# examples:
#   /api/1/organism_classification/facets/internetDisplay&_limit=15
#   /api/1/organism_classification/facets/identificationDate?_aggregation=$year-$month&_limit=15
exports.facets = (req, res) ->
    error = validateType(req.db, req.params.type)
    if error
        return res.json(500, {error: error})
    type = _.str.classify req.params.type

    field = req.params.field

    aggregation = null
    if req.query._aggregation?
        aggregation = req.query._aggregation
        delete req.query._aggregation

    {query, options} = parseQuery(req.query)

    options = params2pojo(options)
    query = params2pojo(query)

    unless options.limit?
        options.limit = 30

    if aggregation
        req.db[type].timeSeries field, aggregation, query, options, (err, results) ->
            if err
                err = err.message if err.message?
                return res.json(500, {error: err})
            return res.json({results: results})
    else
        req.db[type].facets field, query, options, (err, results) ->
            if err
                err = err.message if err.message?
                return res.json(500, {error: err})
            return res.json({results: results})



# ## clear
# Clear all data of the db
#
#   delete /api/<version>
#
exports.clear = (req, res) ->
    req.db.clear (err) ->
        if err
            err = err.message if err.message?
            return res.json(500, {error: err, status: 'failed'})
        return res.json({status: 'ok'})


# ## describe
# Returns the model's schema
#
#   delete /api/<version>/<type>/describe
#
exports.describe = (req, res) ->
    type = _.str.classify(req.params.type)
    unless req.db[type]?
        return res.json(500, {error: "unknown model: #{type}"})
    return res.json({modelName: type, schema: req.db[type]::schema})

# ## sync
# Sync a document
#
#   post /api/<version>/<type> --> create a new document (no id)
#   post /api/<version>/<type> --> update an existed document
#
exports.sync = (req, res) ->
    type = _.str.classify(req.params.type)
    if _.isArray(req.body)
        pojos = []
        for pojo in req.body
            delete pojo._type
            pojos.push(new req.db[type](pojo).toSerializableObject())
        req.db.batchSync pojos, (err, data) ->
            if err
                err = err.message if err.message?
                return res.json(500, {error: err})
            for result in data
                result.result._type = type
                result.result = new req.db[type](result.result).toJSONObject()
            return res.json({result: o.result, options: o.options} for o in data)
    else
        delete req.body._type
        try
            obj = new req.db[type](req.body)
        catch e
            e = e.message if e.message?
            return res.json(500, {error: e})
        obj.save (err, obj, infos) ->
            if err
                err = err.message if err.message?
                return res.json(500, {error: err})
            return res.json({object: obj.toJSONObject(), infos: infos})
