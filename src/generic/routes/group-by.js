
import queryParserMiddleware from '../../middlewares/query-parser';

export default {
    _generic: true,
    description: 'Group the data by a specified field',
    usage: 'get /api/<version>/<type>/i/group-by/<field>?[<query>]&[<options>]',
    examples: [
        '/api/1/organism_classification/facets/internetDisplay&_limit=15',
        '/api/1/individual/facets/species.title',
        '/api/1/individual/facets/species.title?voucherBarcoding=true',
        '/api/1/organism_classification/facets/identificationDate?_aggregation=$year-$month&_limit=15'
    ],
    path: '/i/group-by/:property',
    method: 'get',
    beforeHandler: [queryParserMiddleware],
    handler: function(req, res) {
        var {query, options} = req.parsedQuery;
        req.resource.Model.facets(req.params.property, query, options, function(err, results) {
            if (err) {
                return res.serverError(err);
            }
            return res.sendResults(results);
        });
    }
};