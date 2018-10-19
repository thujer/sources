/*
    IndexDB storage
    Author: Tomas Hujer
*/

const S_STORAGE_TYPE_IDB = 1;
const S_STORAGE_TYPE_RAM = 2;

/**
 * Storage adapter
 * @param cb
 * @constructor
 */
function DataStorage() {

    var self = this;

    this.NL_IDB_VERSION = 4;
    this.S_IDB_NAME = 'barcode_client';

    self.o_idb = self.getSupportedEngine();

    self.s_type = S_STORAGE_TYPE_IDB;
}


/**
 * Wait for load external file
 * @param name
 * @param callback
 */
DataStorage.prototype.waitForAvailable = function(name, cb) {

    log_message(1, 'wait ', typeof(idb))

    setTimeout(function() {

        if (window[name]) {
            log_message(1, 'External library ', name,' avaiable')
            cb();
        } else {
            log_message(1, 'Waiting for ' + name, typeof(idb));
            setTimeout(arguments.callee, 1000);
        }

    }, 300);
}


/**
 * Test indexedDB support
 * cb function Callback after select engine
 * @returns {boolean}
 */
DataStorage.prototype.getSupportedEngine = function(cb) {

    var self = this;

    try {

        var a_adapter = [
            {b_supported: typeof(idb) === 'object', s_adapter: 'idb'},
            {b_supported: typeof(window.indexedDB) === 'object', s_adapter: 'window.indexedDB'},
            {b_supported: typeof(window.mozIndexedDB) === 'object', s_adapter: 'window.mozIndexedDB'},
            {b_supported: typeof(window.webkitIndexedDB) === 'object', s_adapter: 'window.webkitIndexedDB'},
            {b_supported: typeof(window.msIndexedDB) === 'object', s_adapter: 'window.msIndexedDB'}
        ];

        log_message(1, 'Supported indexedDB:');

    } catch(e) {
        log_message(1, 'DataStorage not ready yet', e.message, e.stack);
        return false;
    }

    for(var nl_ix in a_adapter) {
        if(a_adapter[nl_ix].b_supported) {
            log_message(1, ':', a_adapter[nl_ix].s_adapter);
        }
    }

    for(var nl_ix in a_adapter) {

        if(a_adapter[nl_ix].b_supported) {

            log_message(1, 'Init selected indexedDB engine:', a_adapter[nl_ix].s_adapter);

            self.s_adapter = a_adapter[nl_ix].s_adapter;

            switch(a_adapter[nl_ix].s_adapter) {
                case 'idb': self.o_idb = idb; break;
                case 'window.indexedDB': self.o_idb = window.indexedDB; break;
                case 'window.mozIndexedDB': self.o_idb = window.mozIndexedDB; break;
                case 'window.webkitIndexedDB': self.o_idb = window.webkitIndexedDB; break;
                case 'window.msIndexedD': self.o_idb = window.msIndexedD; break;
            }

            log_message(1, 'Test iDB open:', typeof(self.o_idb.open));

            if(typeof(self.o_idb.open) === 'function') {
                return self.o_idb;
            }
        }
    };

    return false;


};


function DataStorageRam(s_name) {

    if(this.a_storage === undefined) {
        this.a_storage = [];
    }

    this.a_storage.push(s_name);
}

DataStorageRam.prototype.open = function(s_name) {
    log_message(1, 'StorageRam open:', s_name);
}

DataStorageRam.prototype.put = function(o_object) {
    this.a_storage.push(o_object)
    log_message(1, 'StorageRam put:', this.a_storage);
}


/**
 * Create or open database named by S_IDB_NAME
 * https://developers.google.com/web/ilt/pwa/working-with-indexeddb
 */
DataStorage.prototype.open = function() {

    "use strict";

    var self = this;
    try {
        var o_promise = self.o_idb.open(self.S_IDB_NAME, self.NL_IDB_VERSION, function (upgradeDB) {

            upgradeDB.onsuccess = function (e) {

                var db = e.target.result;

                db.onerror = function (e) {
                    log_message(1, 'DB error', e.target)
                }
            };

            log_message(1, 'iDB version', upgradeDB.oldVersion, ', upgrading...');

            switch (upgradeDB.oldVersion) {
                case 0:
                    log_message(1, 'level ' + upgradeDB.oldVersion);

                    upgradeDB.createObjectStore('barcode_in', {
                        keyPath: 's_code'
                    });

                    var barcodeInStore_by_id = upgradeDB.transaction.objectStore('barcode_in');
                    barcodeInStore_by_id.createIndex('by-id', 'nl_id');

                case 1:
                    log_message(1, 'level ' + upgradeDB.oldVersion);
                    upgradeDB.createObjectStore('barcode_out', {
                        /*keyPath: 's_code'*/
                        /*keyPath: 'nl_id_barcode'*/
                        keyPath: 'nl_id',
                        autoIncrement: true
                    });

                    var barcodeOutStore_by_id = upgradeDB.transaction.objectStore('barcode_out');
                    barcodeOutStore_by_id.createIndex('by-id', 'nl_id');

                case 2:
                    log_message(1, 'level ' + upgradeDB.oldVersion);
                    upgradeDB.createObjectStore('device', {
                        keyPath: 'uid'
                    });

                case 3:
                    log_message(1, 'level ' + upgradeDB.oldVersion);
                    upgradeDB.createObjectStore('geo', {
                        keyPath: 'timestamp'
                    });

            }
        })

    } catch(e) {
        log_message(1, e.message, 'Using RAM storage!');
        self.o_idb = new DataStorageRam(self.S_IDB_NAME);
        self.s_type = S_STORAGE_TYPE_RAM;
        return false;
    }

    /*if(typeof(o_promise.catch) !== 'undefined') {
        o_promise.catch(function(e) {
            log_message(1, 'Database version error, neeeded to renew database !');
        });
    }*/

    /*.catch(function (e) {
        log_message(2, 'Database version error, delete database and create new');
        $('*[data-target="sync_info"]').append('Database version error, delete database and create new\n');
        if (e.name === 'VersionError') {
            self.deleteAll();
        }

    });*/

    return o_promise;
};



DataStorage.prototype.get = function() {

};


DataStorage.prototype.get_first = function(s_set) {

};


DataStorage.prototype.put = function() {

};


DataStorage.prototype.search = function(s_key) {

};


/**
 * Delete indexedDB
 * @param cb
 */
DataStorage.prototype.deleteAll = function(cb) {

    "use strict";

    var self = this;

    var req = window.indexedDB.deleteDatabase(self.S_IDB_NAME);

    req.onsuccess = function () {
        log_message(1, 'Database ' + self.S_IDB_NAME + ' deleted succesfull');

        try {
            cb();
        } catch(e) {}

    };

    req.onerror = function () {
        log_message(1, 'Couldn`t delete database ' + self.S_IDB_NAME);
    };

    req.onblocked = function () {
        log_message(1, "Couldn't delete database due to the operation being blocked");
    };
};


/**
 * Get records number
 */
DataStorage.prototype.getCountDbIn = function() {

    var self = this;

    var _dbPromise = self.open();

    try {

        _dbPromise.then(function (_idb) {

            var tx = _idb.transaction('barcode_in');
            var barcodeStoreIn = tx.objectStore('barcode_in');
            return barcodeStoreIn.count();

        }).then(function(nl_count) {
            log_message(1, 'dbIn: ' + nl_count);
            $('*[data-target="sync_info_count"]').html(nl_count);

        });


    } catch(e) {

        log_message(1, 'getCountDbIn: cannot open iDb', e.message, e.stack);
        return false;
    }
}


DataStorage.prototype.getLogged = function(cb_success, cb_err) {

    var self = this;

    var _dbPromise = self.open();
    if(self.s_type === S_STORAGE_TYPE_IDB) {

        _dbPromise.then(function (_idb) {

            try {

                var tx = _idb.transaction('device', 'readwrite');
                var deviceStore = tx.objectStore('device');
                return deviceStore.openCursor(null);

            } catch(e) {

                log_message(1, 'Cannot open iDb for readwrite', e.message, e.stack);
                return false;
            }

        }).then(function (a_result) {

            if (a_result) {

                if(typeof cb_success === 'function') {
                    cb_success(a_result);
                }

            } else {

                if(typeof cb_err === 'function') {
                    cb_err('Empty result');
                }
            }

        }).catch(function (e) {

            if(typeof cb_err === 'function') {
                cb_err(e.message, e.stack);
            }

        })

    }

    /*
    TODO:
    if(self.s_type === S_STORAGE_TYPE_RAM) {

        login(function(_o_login) {

            if(_o_login.s_device_uid && _o_login.s_surname && _o_login.s_place) {

                // Zkopíruj uid, je to již definovaný klíè
                _o_login.uid = _o_login.s_device_uid;

                self.o_idb.put(_o_login);
                log_message(2, 'New device UID stored to iDB', _o_login.s_device_uid);
                o_login = _o_login;

                show_device_uid();

                return true;

            } else {
                return false;
            }
        });

    }
    */

}



DataStorage.prototype.putLogged = function(o_property, cb) {

    var self = this;

    var _dbPromise = self.open();

    try {

        _dbPromise.then(function (_idb) {
            var tx = _idb.transaction('device', 'readwrite');
            var deviceStore = tx.objectStore('device');
            return deviceStore.put(o_property)
                .then(function () {
                    log_message(1, 'logged putted in iDB');
                    if (typeof cb === 'function') {
                        cb(true);
                    }
                });
        })

    } catch(e) {

        log_message(1, 'Cannot open iDb for readwrite', e.message, e.stack);

        if(typeof cb === 'function') {
            cb(false);
        }

        return false;
    }

}


DataStorage.prototype.updateLogged = function(o_property, cb) {

    var self = this;

    var _dbPromise = self.open();
    _dbPromise.then(function (_idb) {

        try {

            var tx = _idb.transaction('device', 'readwrite');
            var deviceStore = tx.objectStore('device');
            return deviceStore.openCursor(null);

        } catch(e) {

            log_message(1, 'Cannot open iDb for readwrite', e.message, e.stack);
            return false;
        }

    }).then(function (o_result) {

        if(o_result === undefined) {

            self.putLogged(o_property, cb);

        } else {
            if(o_result.hasOwnProperty('value')) {
                console.log('updateLogged', o_result.value);
            }

            _dbPromise.then(function (_idb) {

                for(var s_property in o_property) {

                    //log_message(1, 'updateLogged', s_property)

                    if(o_property.hasOwnProperty(s_property)) {

                        //log_message(1, 'founded', o_property[s_property]);
                        o_result.value[s_property] = o_property[s_property];
                    }

                }

                self.putLogged(o_result.value, cb);

                //log_message(1, 'updateLogged updated: ', o_result.value);

            });

            return true;

        }


    }).catch(function (e) {
        log_message(1, 'updateLogged error', e.message, e.stack);
    })

}


