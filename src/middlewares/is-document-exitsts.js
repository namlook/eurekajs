
/** check if the document exists and attach it to the request.
 * send a 404 response otherwise
 */
export default function(req, res, next) {
    req.Model.first({_id: req.params.id}, function(err, model) {
        if (err) {
            return res.serverError(err);
        }

        if (!model) {
            return res.notFound();
        }

        next();
    });
}