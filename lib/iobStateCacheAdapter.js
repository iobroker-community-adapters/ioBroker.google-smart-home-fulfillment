// Variables that we want to be common to all classes created but set from caller.
// TODO: is there a better way to do this?
const {Mutex} = require('await-semaphore');

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
        adapterCtx.adapter.log.debug('iobStateCacheAdapter adapterCache creating for ' + model);
        this.model = model;
        this.dbInit = false;
        this.fileName = this.model + '.json';
        this.fileRoot = adapterCtx.adapter.namespace;
        this.mutex = new Mutex();
    }

    key(id) {
        return `${this.model}.${id}`;
    }

    async checkStorage() {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter checkStorage');
        const release = await this.mutex.acquire();
        adapterCtx.adapter.log.debug('iobStateCacheAdapter aquired mutex');
        if (!this.dbInit) {
            // Only try and do this once, even if it fails (probably no file so we'll create it)
            this.dbInit = true;
            adapterCtx.adapter.log.debug('iobStateCacheAdapter loading file: ' + this.fileName);
            const that = this;
            try {
                const fileWrapper = await adapterCtx.adapter.readFileAsync(this.fileRoot, this.fileName);
                adapterCtx.adapter.log.debug('iobStateCacheAdapter file loaded: ' + fileWrapper.file);
                that.db = JSON.parse(fileWrapper.file);
            } catch (error) {
                adapterCtx.adapter.log.debug('iobStateCacheAdapter failed to load file: ' + error);
                that.db = new Object();
            }
            adapterCtx.adapter.log.debug('iobStateCacheAdapter init done. db is now: ' + typeof(this.db));
        }
        release();
    }

    // TODO: add some periodic garbage collection for expired objects.

    async writeStorage() {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter writeStorage');
        const release = await this.mutex.acquire();
        adapterCtx.adapter.log.debug('iobStateCacheAdapter aquired mutex');
        await adapterCtx.adapter.writeFileAsync(this.fileRoot, this.fileName, JSON.stringify(this.db));
        release();
    }

    async storageSet(key, value, expiresIn) {
        await this.checkStorage();
        const state = { val: value, ack: true };
        if (expiresIn) {
            state.expire = Date.now() + expiresIn;
            adapterCtx.adapter.log.debug('iobStateCacheAdapter setState: ' + key + ' (expires on ' + state.expire + ')');
        } else {
            adapterCtx.adapter.log.debug('iobStateCacheAdapter setState: ' + key);
        }
        this.db[key] = state;
        adapterCtx.adapter.log.debug('iobStateCacheAdapter db is now: ' + JSON.stringify(this.db));
        await this.writeStorage();
    }

    async storageGet(key) {
        await this.checkStorage();
        adapterCtx.adapter.log.debug('iobStateCacheAdapter getState: ' + key);
        if (!(key in this.db)) {
            adapterCtx.adapter.log.debug('iobStateCacheAdapter ID not found: ' + key);
        } else {
            const state = this.db[key];
            if (state.expires > Date.now()) {
                adapterCtx.adapter.log.debug('iobStateCacheAdapter ID expired: ' + key);
                delete this.db[key];
            } else {
                return state.val;
            }
        }
    }

    async set(key, value) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter set: ' + key + ' for ' + this.model);
        this.storageSet(key, value);
    }

    async get(key) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter get: ' + key + ' for ' + this.model);
    }

    async clear(key) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter get: ' + key + ' for ' + this.model);
    }

    async destroy(id) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter destroy: ' + id + ' for ' + this.model);
    }

    async consume(id) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter consume: ' + id + ' for ' + this.model);
    }

    async find(id) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter find: ' + id + ' for ' + this.model);
        return this.storageGet(this.key(id));
    }

    async findByUid(uid) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter findByUid: ' + uid + ' for ' + this.model);
        const id = await this.storageGet(sessionUidKeyFor(uid));
        return this.find(id);
    }

    async findByUserCode(userCode) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter findByUserCode: ' + userCode + ' for ' + this.model);
    }

    async upsert(id, payload, expiresIn) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter upsert: ' + id + ' for ' + this.model);
        const key = this.key(id);

        if (this.model === 'Session') {
            this.storageSet(sessionUidKeyFor(payload.uid), id, expiresIn);
        }

        const { grantId, userCode } = payload;
        if (grantId) {
            adapterCtx.adapter.log.debug('iobStateCacheAdapter grantId: ' + grantId);
            const grantKey = grantKeyFor(grantId);
            const grant = await this.storageGet(grantKey);
            if (!grant) {
                this.storageSet(grantKey, [key]);
            } else {
                grant.push(key);
            }
        }

        if (userCode) {
            adapterCtx.adapter.log.debug('iobStateCacheAdapter userCode: ' + userCode);
            this.storageSet(userCodeKeyFor(userCode), id, expiresIn);
        }

        this.storageSet(key, payload, expiresIn);
    }

    async revokeByGrantId(grantId) {
        adapterCtx.adapter.log.debug('iobStateCacheAdapter revokeByGrantId: ' + grantId + ' for ' + this.model);
    }

    static setCtx(adapter, instanceSettings) {
        adapterCtx.adapter = adapter;
        adapterCtx.instanceSettings = instanceSettings;
        adapterCtx.adapter.log.debug('iobStateCacheAdapter setCtx done');
    }
}

module.exports = iobStateCacheAdapter;