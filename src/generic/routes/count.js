
import queryParserMiddleware from '../../middlewares/query-parser';

export default {
    _generic: true,
    path: '/i/count',
    method: 'get',
    policies: [queryParserMiddleware],
    action: function(req, res) {
        var {query, options} = req.parsedQuery;

        return req.resource.Model.count(query, options, function(err, data) {
            if (err) {
                return res.serverError(err, {query: query, options: options});
            }

            return res.sendResults(data);
        });
    }
};