const path = require('path');
const { tests } = require('@iobroker/testing');

// Run unit tests - See https://github.com/ioBroker/testing for a detailed explanation and further options
tests.unit(path.join(__dirname, '..'), {
    // Add dummy config so the onReady doesn't fail deriving more
    overwriteAdapterConfig(config) {
        config = {
            homeGraphJSONKey: '{"project_id": "dummy"}',
            publicFQDN: "dummy"
        };
        return config;
    }
});
