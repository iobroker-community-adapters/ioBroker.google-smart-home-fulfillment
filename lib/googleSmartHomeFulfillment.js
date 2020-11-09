function GoogleSmartHomeFulfillment(server, webSettings, adapter, instanceSettings, app) {
    adapter.log.info('Starting : GoogleSmartHomeFulfillment');
    // Hello World!
    app.get('/hello', function(req, res){
        adapter.log.info('/hello');
        res.send('Hello World!');
    });
}

module.exports = GoogleSmartHomeFulfillment;