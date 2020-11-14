function getRoom(device) {
    // The first value of the enums object
    return device.enums[Object.keys(device.enums)[0]];
}

class LoxonePlugin {
    constructor(adapter, instanceSettings, app) {
        this.adapter = adapter;
        this.instanceSettings = instanceSettings;
        this.app = app;
        this.adapter.log.debug('GSHLoxone Constructed');
    }

    async lightExecuteHandler(id, execution) {
        this.adapter.log.debug(`lightExecuteHandler for ${id}...`);
        // TODO: this should probably use the masterValue on/off states but they seem broken
        if (execution[0].params.on) {
            await this.adapter.setForeignStateAsync(`${id}.activeMoods`, 'Bright');
        } else {
            await this.adapter.setForeignStateAsync(`${id}.activeMoods`, 'Off');
        }
        return {
            ids: [id],
            status: 'SUCCESS'
        };
    }

    async lightQueryHandler(id) {
        this.adapter.log.debug(`lightQueryHandler for ${id}...`);
        // TODO: this should probably use the masterValue on/off states but they seem broken
        const activeMoods = await this.adapter.getForeignStateAsync(`${id}.activeMoods`);
        const on = (activeMoods.val == 'Off') ? false : true;
        return {
            [id]: {
                online: true,
                status: 'SUCCESS',
                on: on
            }
        };
    }

    async shutterHandler(id, execution) {
        this.adapter.log.debug(`shutterHandler for ${id}...`);
        switch (execution[0].command) {
            case 'action.devices.commands.OpenClose':
                this.adapter.setForeignState(`${id}.position`, 100 - execution[0].params.openPercent);
                break;
            case 'action.devices.commands.StartStop':
                if (!execution[0].params.start) {
                    let stop = false;
                    const down = await this.adapter.getForeignStateAsync(`${id}.down`);
                    if (down.val) {
                        stop = true;
                    } else {
                        const up = await this.adapter.getForeignStateAsync(`${id}.down`);
                        stop = up.val;
                    }

                    if (stop) {
                        // Just hit any button to stop movement
                        await this.adapter.setForeignStateAsync(`${id}.fullUp`, true);
                    }
                }
                break;
            default:
                this.adapter.error(`shutterHandler doesn't know how to execute ${execution[0].command}`);
        }
        return {
            ids: [id],
            status: 'SUCCESS'
        };
    }

    async getDevices() {
        this.adapter.log.debug('GSHLoxone getDevices...');

        // Remember the list of devices we create so when the exec handler
        // calls come in the ID can be used to determine which device type
        // this is.
        this.devices = [];

        const srcObjects = await this.adapter.getForeignObjectsAsync('loxone.0.*', 'device', ['rooms']);

        // Loop over states looking for devices we know how to convert to Google Actions
        for (const [id, device] of Object.entries(srcObjects)) {
            switch (device.native.type) {
                case 'LightControllerV2':
                    this.adapter.log.debug(`Found ${device.native.type} ${id}`);
                    this.devices[id] = {
                        handlers: {
                            onExecute: (id, execution) => { return this.lightExecuteHandler(id, execution); },
                            onQuery: (id) => { return this.lightQueryHandler(id); }
                        },
                        gDevice: {
                            id: id,
                            type: 'action.devices.types.LIGHT',
                            traits: ['action.devices.traits.OnOff'],
                            name: { name: device.common.name },
                            willReportState: false, // Change to true when we subscribe and send changes
                            roomHint: getRoom(device)
                        }
                    };
                    break;

                case 'Jalousie':
                    this.adapter.log.debug(`Found ${device.native.type} ${id}`);
                    this.devices[id] = {
                        handlers: {
                            onExecute: (id, execution) => { return this.shutterHandler(id, execution); }
                        },
                        gDevice: {
                            id: id,
                            type: 'action.devices.types.SHUTTER',
                            traits: ['action.devices.traits.OpenClose', 'action.devices.traits.StartStop'],
                            name: { name: device.common.name },
                            willReportState: false, // Change to true when we subscribe and send changes
                            roomHint: getRoom(device),
                            attributes: {
                                openDirection: ['UP'],
                                commandOnlyOpenClose: true // TODO: remove when we handle QUERY
                            }
                        }
                    };
                    break;

                default:
                    this.adapter.log.debug(`Skipping ${device.native.type} ${id}`);
            }
        }

        this.adapter.log.debug('GSHLoxone getDevices returning: ' + JSON.stringify(this.devices));
        return this.devices;
    }

    async init() {
        this.adapter.log.debug('GSHLoxone init...');
        // TODO: Later on we will loop through devices and subscribe to events so we can call reportState
        //const devices = await this.buildDevices();
    }
}

module.exports = LoxonePlugin;
