'use strict';

/*
 * Created with @iobroker/create-adapter v1.30.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

const { WebServer } = require('@iobroker/webserver');

class GoogleSmartHomeFulfillment extends utils.Adapter {

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'google-smart-home-fulfillment',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */

    async onReady() {
        // Construct more config from that given
        let configPass = false;
        try {
            const keyObject = JSON.parse(this.config.homeGraphJSONKey);
            this.config.homeGraphJSONKey = keyObject;
            this.config.publicUrl = `https://${this.config.publicFQDN}/oidc`;
            this.config.oauthRedirect = `https://oauth-redirect.googleusercontent.com/r/${this.config.homeGraphJSONKey.project_id}`;
            this.config.oauthWritePeriod = 300000; // Flush memory cache to disk every 5 minutes
            this.config.agentUserId = 'dummy'; // ... as we don't care about this
            configPass = true;
        } catch (error) {
            this.terminate(
                'Failed to construct added configuration from that given. Please check adapter configuration.',
                utils.EXIT_CODES.INVALID_ADAPTER_CONFIG);
        }

        if (configPass) {
            // Create ExpressJS server
            const express = require('express');
            const app = express();

            const webServer = new WebServer({ app, adapter: this, secure: this.config.useSsl });
            const server = await webServer.init();
            server.listen(this.config.port);

            // Slightly odd require here but this is so the main code is compatible with possible
            // use as an ioBroker.web extension (well - that's how it started out anyhow).
            require('./lib/googleSmartHomeFulfillment.js')(server, { secure: true, port: this.config.port }, this, this.config, app);
        }
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);

            callback();
        } catch (e) {
            callback();
        }
    }

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  * @param {string} id
    //  * @param {ioBroker.Object | null | undefined} obj
    //  */
    // onObjectChange(id, obj) {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
            // Call the handler for whoever created this subscription
            this.subscribedStatesHandlers[id](id, state);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    //     if (typeof obj === 'object' && obj.message) {
    //         if (obj.command === 'send') {
    //             // e.g. send email or pushover or whatever
    //             this.log.info('send command');

    //             // Send response in callback if required
    //             if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
    //         }
    //     }
    // }

}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new GoogleSmartHomeFulfillment(options);
} else {
    // otherwise start the instance directly
    new GoogleSmartHomeFulfillment();
}