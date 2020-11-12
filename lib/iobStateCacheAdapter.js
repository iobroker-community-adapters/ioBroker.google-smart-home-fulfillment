const { Mutex } = require('await-semaphore');
const { setIntervalAsync } = require('set-interval-async/fixed');

// Context for adapter and it's settings
const adapterCtx = {};

function grantKeyFor(id) {
    return 'grant.' + id;
}

function sessionUidKeyFor(id) {
    return 'sessionUid.' + id;
}

function userCodeKeyFor(userCode) {
    return 'userCode.' + userCode;
}

// Actual storage class
class iobStateCacheAdapter {
    constructor(model) {
        adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${model} constructor`);

        this.model = model;
        this.dbInit = false;
        this.dbChange = false;
        this.fileName = this.model + '.json';
        this.fileRoot = adapterCtx.adapter.namespace;

        // We use a Mutex for access to the DB object for safety due to using writeFileAsync.
        this.mutex = new Mutex();
    }

    // Adapter & instance settings shared across all instances of 
    static setCtx(adapter, instanceSettings) {
        adapterCtx.adapter = adapter;
        adapterCtx.instanceSettings = instanceSettings;
        adapterCtx.adapter.log.debug('iobStateCacheAdapter setCtx done');
    }

    async checkStorage() {
        adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${this.model} checkStorage`);
        const release = await this.mutex.acquire();
        adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${this.model} aquired mutex`);
        if (!this.dbInit) {
            // Only try and do this once, even if it fails (probably no file so we'll create it)
            this.dbInit = true;
            adapterCtx.adapter.log.debug('iobStateCacheAdapter loading file: ' + this.fileName);
            try {
                const fileWrapper = await adapterCtx.adapter.readFileAsync(this.fileRoot, this.fileName);
                adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${this.model} file loaded`);
                this.db = JSON.parse(fileWrapper.file);
            } catch (error) {
                adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${this.model} failed to load file: ${error}`);
                this.db = new Object();
            }

            // DB is now initialised so dump it regularly (if changed).
            setIntervalAsync(() => {
                this.writeStorage();
            }, adapterCtx.instanceSettings.oauthWritePeriod);
        }
        release();
    }

    checkExpires(key, state) {
        if (('expires' in state) && state.expires < Date.now()) {
            adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${this.model} expiring ${key}`);
            delete this.db[key];
            this.dbChange = true;
            return true;
        }
        adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${this.model} is valid: ${key}`);
        return false;
    }

    async writeStorage() {
        adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${this.model} writeStorage`);
        const release = await this.mutex.acquire();

        // Delete expired objects
        for (const [key, state] of Object.entries(this.db)) {
            adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${this.model} check expire for ${key} (${state.expires})`);
            this.checkExpires(key, state);
        }

        if (this.dbChange) {
            adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${this.model} DB change - writing file`);
            await adapterCtx.adapter.writeFileAsync(this.fileRoot, this.fileName, JSON.stringify(this.db));
            this.dbChange = false;
        } else {
            adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${this.model} no change - skipping`);
        }
        release();
    }

    async storageSet(key, value, expiresIn) {
        await this.checkStorage();
        const state = { val: value, ack: true };
        if (expiresIn) {
            state.expires = Date.now() + expiresIn * 1000;
            adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${this.model} setState: ${key} (expires on ${state.expires})`);
        } else {
            adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${this.model} setState: ${key}`);
        }
        this.db[key] = state;
        this.dbChange = true;
    }

    async storageGet(key) {
        await this.checkStorage();
        adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${this.model} getState: ${key}`);
        if (!(key in this.db)) {
            adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${this.model} key not found: ${key}`);
        } else {
            const state = this.db[key];
            if (!this.checkExpires(key, state)) {
                return state.val;
            }
        }
    }

    // Rest of this is basically copied from the default oidc-provider in-memory adapter.
    // Just modified to call our storage functions above.

    key(id) {
        return `${this.model}.${id}`;
    }

    async set(key, value) {
        adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${this.model} set: ${key}`);
        this.storageSet(key, value);
    }

    async find(id) {
        adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${this.model} find: ${id}`);
        return this.storageGet(this.key(id));
    }

    async findByUid(uid) {
        adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${this.model} findByUid: ${uid}`);
        const id = await this.storageGet(sessionUidKeyFor(uid));
        return this.find(id);
    }

    async upsert(id, payload, expiresIn) {
        adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${this.model} upsert: ${id}`);
        const key = this.key(id);

        if (this.model === 'Session') {
            this.storageSet(sessionUidKeyFor(payload.uid), id, expiresIn);
        }

        const { grantId, userCode } = payload;
        if (grantId) {
            adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${this.model} grantId: ${grantId}`);
            const grantKey = grantKeyFor(grantId);
            const grant = await this.storageGet(grantKey);
            if (!grant) {
                this.storageSet(grantKey, [key]);
            } else {
                grant.push(key);
            }
        }

        if (userCode) {
            adapterCtx.adapter.log.debug(`iobStateCacheAdapter ${this.model} userCode: ${userCode}`);
            this.storageSet(userCodeKeyFor(userCode), id, expiresIn);
        }

        this.storageSet(key, payload, expiresIn);
    }

    async revokeByGrantId(grantId) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter revokeByGrantId: ' + grantId + ' for ' + this.model);
    }

    // Didn't bother to fill these as don't seem to be used. But... if not here
    // OIDC doesn't seem to work properly. Go figure.

    async get(key) {
        throw new Error('Not implemented');
    }

    async clear(key) {
        throw new Error('Not implemented');
    }

    async destroy(id) {
        throw new Error('Not implemented');
    }

    async consume(id) {
        throw new Error('Not implemented');
    }

    async findByUserCode(userCode) {
        throw new Error('Not implemented');
    }
}

module.exports = iobStateCacheAdapter;