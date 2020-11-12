class GSHLoxone {
    constructor(adapter, instanceSettings, app) {
        this.adapter = adapter;
        this.instanceSettings = instanceSettings;
        this.app = app;
        this.adapter.log.debug('GSHLoxone Constructed');
    }

    async getDevices() {
        this.adapter.log.debug('GSHLoxone getDevices...');
        const gDevices = [];

        const devices = await this.adapter.getForeignObjectsAsync('loxone.0.*', 'device');
        //        this.adapter.log.debug('Loxone devices to process: ' + JSON.stringify(devices));

        // Loop over states looking for devices we know how to convert to Google Actions
        for (const [id, device] of Object.entries(devices)) {
            switch (device.native.type) {
                case 'LightControllerV2':
                    this.adapter.log.debug(`Found ${device.native.type} ${id}`);
                    gDevices.push({
                        id: id,
                        type: 'action.devices.types.LIGHT',
                        traits: ['action.devices.traits.OnOff'],
                        name: { name: device.common.name }
                    });
                    break;

                case 'Jalousie':
                    this.adapter.log.debug(`Found ${device.native.type} ${id}`);
                    gDevices.push({
                        id: id,
                        type: 'action.devices.types.SHUTTER',
                        traits: ['action.devices.traits.OpenClose'],
                        name: { name: device.common.name },
                        willReportState: false,
                        attributes: {
                            openDirection: ['DOWN'],
                        }
                    });
                    break;

                default:
                    this.adapter.log.debug(`Skipping ${device.native.type} ${id}`);
            }
        }

        this.adapter.log.debug('GSHLoxone getDevices returning: ' + JSON.stringify(gDevices));
        return gDevices;
    }

    async init() {
        this.adapter.log.debug('GSHLoxone init...');
        // TODO: Later on we will loop through devices and subscribe to events so we can call reportState
        //const devices = await this.buildDevices();
    }
}

module.exports = GSHLoxone;
