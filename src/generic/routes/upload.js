
export default {
    _generic: true,
    path: /^\/api\/1\/_files\/([^\/]+?(?:\/[^\/]+?)*)(?:\/(?=$))?$/i,
    method: 'post',
    handler: function(req, res) {
        return res.sendResults(`upload file`);
    }
};