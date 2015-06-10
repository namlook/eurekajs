
import queryParserMiddleware from '../../middlewares/query-parser';

export default {
    _generic: true,
    path: '/:id?',
    method: 'get',
    beforeHandler: [queryParserMiddleware],
    handler: function(req, res) {
        var {query, options} = req.parsedQuery;

        if (req.params.id) {
            query._id = req.params.id;
        }

        var fetchOne = false;
        if (query._id) {
            if (query._id.$in) {
                query._id = query._id.$in; // Hack waiting the implementation in archimedes
            } else {
                fetchOne = true;
            }
        }

        req.logger.trace({query: query, options: options});

        return req.resource.Model.find(query, options, function(err, data) {
            if (err) {
                return res.serverError(err, {query: query, options: options});
            }

            var results = data.map(function(o) {
                return o.toJSONObject({
                    populate: options.populate,
                    dereference: true
                });
            });

            if (fetchOne) {
                results = results[0];
                if (!results) {
                    return res.notFound();
                }
            }
            return res.sendResults(results);
        });
    }
};