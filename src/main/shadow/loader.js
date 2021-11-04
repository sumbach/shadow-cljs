goog.module("shadow.loader");
goog.module.declareLegacyNamespace();

const GMM = goog.require("goog.module.ModuleManager");
const GML = goog.require("goog.module.ModuleLoader");

const GO = goog.require("goog.object");
const GHUC = goog.require("goog.html.uncheckedconversions");
const GSC = goog.require("goog.string.Const");

/** @define {boolean} */
const TEST = goog.define("shadow.loader.TEST", false);

// this is written in JS so it doesn't depend on cljs.core

const ml = new GML();
ml.setSourceUrlInjection(true);

const mm = GMM.getInstance();
mm.setLoader(ml);

let initCalled = false;

function ensureInitWasCalled () {
  if (!initCalled) {
    throw new Error(
      "shadow.loader API was called before shadow.loader.init!\n" +
        "You are probably calling module loader too early before shadow-cljs got fully initialized."
    );
  }
};

function init (uriPrefix) {
  if (TEST) return;

  if (initCalled) {
    throw new Error(
      "shadow.loader.init was already called! If you are calling it manually set :module-loader-init false in your config."
    );
  }

  if (goog.global.shadow$modules) {
    mm.setAllModuleInfo(goog.global.shadow$modules["infos"]);

    var uris = goog.global.shadow$modules["uris"];

    // this is absurd. the uris are generated by the compiler. should be trusted already.
    // I would really like to know how Google integrates this data into their builds
    var trustReason = GSC.from("generated by compiler");

    GO.getKeys(uris).forEach(function (key) {
      var module_uris = uris[key];
      if (module_uris.length == 0) {
        // default module is added without uris since it will always be loaded
        // when this is called
        mm.getModuleInfo(key).setLoaded();
      } else {
        var trusted_uris = [];
        module_uris.forEach(function (module_uri) {
          var trusted =
            GHUC.trustedResourceUrlFromStringKnownToSatisfyTypeContract(
              trustReason,
              uriPrefix + module_uri
            );
          trusted_uris.push(trusted);
        });
        mm.getModuleInfo(key).setTrustedUris(trusted_uris);
      }
    });

    initCalled = true;
  }
};

function getModuleManager() {
  return mm;
};

function getModuleLoader() {
  return ml;
};

// allow calling (shadow.loader/load :with-a-keyword)
function string_id(id) {
  var result = id.toString();
  if (result.charAt(0) == ":") {
    result = result.substring(1);
  }
  return result;
};

function set_load_start(id) {
  mm.beforeLoadModuleCode(id);
};

// FIXME: id no longer required, just keeping it in case someone ends up using old closure lib
function set_loaded (id) {
  mm.setLoaded(id);
};

// ignored. only for cljs.loader compat
function set_loaded_BANG_ () {};

function loaded_QMARK_(id) {
  if (TEST) {
    return true;
  }

  return mm.getModuleInfo(string_id(id)).isLoaded();
};

function with_module(
  moduleId,
  fn,
  opt_handler,
  opt_noLoad,
  opt_userInitiated,
  opt_preferSynchronous
) {
  ensureInitWasCalled();
  return mm.execOnLoad(
    string_id(moduleId),
    fn,
    opt_handler,
    opt_noLoad,
    opt_userInitiated,
    opt_preferSynchronous
  );
};

function load (id, cb) {
  if (TEST) {
    var result = goog.async.Deferred.succeed();
    if (cb) {
      result = result.then(cb);
    }
    return result;
  }

  ensureInitWasCalled();
  id = string_id(id);
  if (cb) {
    mm.execOnLoad(id, cb);
  }
  return mm.load(id);
};

function load_multiple(ids, opt_userInitiated) {
  if (TEST) {
    var result = {};
    for (const id of ids) {
      result[id] = goog.async.Deferred.succeed();
    }
    return result;
  }
  ensureInitWasCalled();
  return mm.loadMultiple(ids, opt_userInitiated);
};

function prefetch (id) {
  if (TEST) return;

  ensureInitWasCalled();
  mm.prefetchModule(string_id(id));
};

function preload (id) {
  if (TEST) return;

  ensureInitWasCalled();
  return mm.preloadModule(string_id(id));
};

exports = {
    preload,
    prefetch,
    load_multiple,
    load,
    with_module,
    loaded_QMARK_,
    set_loaded_BANG_,
    set_loaded,
    set_load_start,
    getModuleLoader,
    getModuleManager,
    init
};