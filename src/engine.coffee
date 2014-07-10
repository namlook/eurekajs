
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


engine = {}

# ## gettingStarted
# display a getting started
#
# examples:
#   /api/1
engine.gettingStarted = (req, res) ->
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
engine.count = (req, res) ->
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
engine.find = (req, res) ->
    error = validateType(req.db, req.params.type)
    if error
        return res.json(500, {error: error})

    type = _.str.classify req.params.type

    {query, options} = parseQuery(req.query)

    unless options.limit?
        options.limit = 30
    unless options.populate?
        options.populate = 0

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
engine.findReference = (req, res) ->

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
engine.facets = (req, res) ->
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



# # ## clear
# # Clear all data of the db
# #
# #   delete /api/<version>
# #
# exports.clear = (req, res) ->
#     req.db.clear (err) ->
#         if err
#             err = err.message if err.message?
#             return res.json(500, {error: err, status: 'failed'})
#         return res.json({status: 'ok'})


engine.delete = (req, res) ->
    req.db.delete {_id: req.params.id, _type: req.params.type}, (err) ->
        if err
            err = err.message if err.message?
            return res.json(500, {error: err, status: 'failed'})
        return res.json({status: 'ok', _id: req.params.id, _type: req.params.type})

# ## describe
# Returns the model's schema
#
#   delete /api/<version>/<type>/describe
#
engine.describe = (req, res) ->
    type = _.str.classify(req.params.type)
    unless req.db[type]?
        return res.json(500, {error: "unknown model: #{type}"})
    return res.json({modelName: type, schema: req.db[type]::schema})

# ## sync
# Sync a document. If not `_id` field is present, it will create a new
# document. Otherwise, the matching document will be updated.
#
#   post /api/<version>/<type>
#       data: payload=<jsonString>
#
#
# Batch sync can be done by passing to the payload an array of objects
#
#   post /api/<version>/<type> --> create a batch of documents
#       data: payload=[<jsonString1>, <jsonString2>, ...]
engine.sync = (req, res) ->
    type = _.str.classify(req.params.type)

    try
        payload = JSON.parse(req.body.payload)
    catch e
        e = e.message if e.message?
        console.log('err: cannot parse payload. Reason: ', e)
        return res.json(500, {error: 'cannot parse payload. Reason: '+e})

    # Handle batchsync if needed
    if _.isArray(payload)
        pojos = []
        for pojo in payload
            delete pojo._type
            try
                pojos.push(new req.db[type](pojo).toSerializableObject())
            catch e
                e = e.message if e.message?
                console.log('xxx', e)
                return res.json(500, {error: e})
        req.db.batchSync pojos, (err, data) ->
            if err
                err = err.message if err.message?
                return res.json(500, {error: err})
            for result in data
                result.result._type = type
                result.result = new req.db[type](result.result).toJSONObject({dereference: true})
            return res.json({result: o.result, options: o.options} for o in data)
    else
        delete payload._type
        try
            obj = new req.db[type](payload)
        catch e
            e = e.message if e.message?
            console.log('xxx', e)
            return res.json(500, {error: e})
        obj.save (err, obj, infos) ->
            if err
                console.log('yyy', err)
                return res.json(500, {error: err})
            return res.json({object: obj.toJSONObject({dereference: true}), infos: infos})


module.exports = [
    {method: 'get',    url: "/:type/count",          func: engine.count},
    {method: 'get',    url: "/:type/facets/:field",  func: engine.facets},
    {method: 'get',    url: "/:type/describe",       func: engine.describe},
    {method: 'get',    url: "/:type/:id",            func: engine.find},
    {method: 'delete', url: "/:type/:id",            func: engine.delete},
    {method: 'get',    url: "/:type",                func: engine.find},
    {method: 'post',   url: "/:type",                func: engine.sync},
    {method: 'get',    url: "/_ref",                 func: engine.findReference},
    {method: 'get',    url: "/",                      func: engine.gettingStarted}
]
