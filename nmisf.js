var Module = require('module');
var fs = require('fs');
var path = require('path');

// read bundle
var bundleDirs = {};
var bundleFiles = {};
var hBundle;
var preferPackedFiles = false;

var init = function (packedFileName) {
	fs.readFileSync(packedFileName + '.index', 'utf8').split('\r\n').forEach(function (f) {
		if (f[0] == 'D') {
			bundleDirs[path.resolve(f.slice(1))] = {};
		} else if (f[0] == 'F') {
			f = f.slice(1);
			var splIdx1 = f.indexOf(' ');
			var splIdx2 = f.indexOf(' ', splIdx1 + 1);
			var fname = f.substring(splIdx2 + 1);
			var size = parseInt(f.substring(0, splIdx1));
			var offset = parseInt(f.substring(splIdx1 + 1, splIdx2));
			bundleFiles[path.resolve(fname)] = { offset: offset, size: size }
			offset += size;
		}
	});

	hBundle = fs.openSync(packedFileName + '.data', 'r');
}

var readFileFromBundle = function (fileName) {
	var f = bundleFiles[fileName];
	if (!f)
		return undefined;
	var buf = new Buffer(f.size);
	fs.readSync(hBundle, buf, 0, f.size, f.offset);
	return buf;
};

// end read bundle

function stripBOM(content) {
	if (content.charCodeAt(0) === 0xFEFF) {
		content = content.slice(1);
	}
	return content;
}

function stat(filename) {
	// filename = path._makeLong(filename);
	cache = stat.cache;
	if (cache !== null) {
		result = cache.get(filename);
		if (result !== undefined) return result;
	}

	var result = -1;
	if (bundleDirs[filename]) result = 1;
	else if (bundleFiles[filename]) result = 0;
	else result = statReal(filename);
	if (cache !== null) cache.set(filename, result);
	return result;
}

function statReal(filename) {
	var result = -1;
	try {
		var r = fs.statSync(filename);
		if (r.isFile()) result = 0;
		else if (r.isDirectory()) result = 1;
	}
	catch (e) {
	}
	return result;
}

stat.cache = null;


var packageMainCache = {};

function readPackage(requestPath) {
	if (packageMainCache.hasOwnProperty(requestPath)) {
		return packageMainCache[requestPath];
	}

	var jsonPath = path.resolve(requestPath, 'package.json');

	var bundledJson = readFileFromBundle(jsonPath);
	
	if (bundledJson) bundledJson = stripBOM(bundledJson.toString('utf8'));

	var json = bundledJson;

	try {
		if (!json)
			json = stripBOM(fs.readFileSync(path._makeLong(jsonPath), 'utf8'));
	}
	catch (e) {
		return false;
	}

	if (json === undefined) {
		return false;
	}

	try {
		var pkg = packageMainCache[requestPath] = JSON.parse(json).main;
	} catch (e) {
		e.path = jsonPath;
		e.message = 'Error parsing ' + jsonPath + ': ' + e.message;
		throw e;
	}
	return pkg;
}

function tryPackage(requestPath, exts, isMain) {
	var pkg = readPackage(requestPath);

	if (!pkg) return false;

	var filename = path.resolve(requestPath, pkg);
	return tryFile(filename, isMain) ||
		   tryExtensions(filename, exts, isMain) ||
		   tryExtensions(path.resolve(filename, 'index'), exts, isMain);
}

function tryFile(requestPath, isMain) {
	rc = stat(requestPath);

	// return rc === 0 && fs.realpathSync(requestPath);
	return rc === 0 && requestPath;
}

// given a path check a the file exists with any of the set extensions
function tryExtensions(p, exts, isMain) {
	for (var i = 0; i < exts.length; i++) {
	  filename = tryFile(p + exts[i], isMain);

		if (filename) {
			return filename;
		}
	}
	return false;
}

var isPathAbsolute = function (path) {
	if (path.isAbsolute) return path.isAbsolute(path);
	else {
		if (process.platform === 'win32')
			return path.length > 1 && path[1] === ':';
		return path.length > 0 && path[0] === '/';
	}
}

Module._findPath = function(request, paths, isMain) {
	if (isPathAbsolute(request)) {
		paths = [''];
	} else if (!paths || paths.length === 0) {
		return false;
	}

  cacheKey = JSON.stringify({request: request, paths: paths});
	if (Module._pathCache[cacheKey]) {
		return Module._pathCache[cacheKey];
	}

	var exts;
	trailingSlash = request.length > 0 && request.charCodeAt(request.length - 1) === 47/*/*/;

	// For each path
	for (var i = 0; i < paths.length; i++) {
		// Don't search further if path doesn't exist
	  curPath = paths[i];
		if (curPath && stat(curPath) < 1) continue;
		var basePath = path.resolve(curPath, request);
		var filename;

		if (!trailingSlash) {
			rc = stat(basePath);
			if (rc === 0) {  // File.
				filename = basePath;
				// filename = fs.realpathSync(basePath);
			} else if (rc === 1) {  // Directory.
				if (exts === undefined)
					exts = Object.keys(Module._extensions);
				filename = tryPackage(basePath, exts, isMain);
			}

			if (!filename) {
				// try it with each of the extensions
				if (exts === undefined)
					exts = Object.keys(Module._extensions);
				filename = tryExtensions(basePath, exts, isMain);
			}
		}

		if (!filename) {
			if (exts === undefined)
				exts = Object.keys(Module._extensions);
			filename = tryPackage(basePath, exts, isMain);
		}

		if (!filename) {
			// try it with each of the extensions at "index"
			if (exts === undefined)
				exts = Object.keys(Module._extensions);
			filename = tryExtensions(path.resolve(basePath, 'index'), exts, isMain);
		}

		if (filename) {
			Module._pathCache[cacheKey] = filename;
			return filename;
		}
	}
	return false;
};

Module._extensions['.js'] = function (module, filename) {
	var content;
	if (preferPackedFiles)
		content = readFileFromBundle(filename) || fs.readFileSync(filename);
	else
		content = statReal(filename) === 0 ? fs.readFileSync(filename) : readFileFromBundle(filename);

	module._compile(stripBOM(content.toString('utf8')), filename);
};

Module._extensions['.json'] = function (module, filename) {
	var content;
	if (preferPackedFiles)
		content = readFileFromBundle(filename) || fs.readFileSync(filename);
	else
		content = statReal(filename) === 0 ? fs.readFileSync(filename) : readFileFromBundle(filename);

	try {
		module.exports = JSON.parse(stripBOM(content.toString('utf8')));
	} catch (err) {
		err.message = filename + ': ' + err.message;
		throw err;
	}
};

function ensureDirectoryExistence(filePath) {
	var dirname = path.dirname(filePath);
	if (statReal(dirname) > 0) {
		return true;
	}
	ensureDirectoryExistence(dirname);
	fs.mkdirSync(dirname);
}

//Native extension for .node
Module._extensions['.node'] = function (module, filename) {
	// no variants. we should unpack file to some location. Good idea to use it 'original place' (if not exists).
	if (statReal(filename) < 0) {
		ensureDirectoryExistence(filename);
		var buf = readFileFromBundle(filename);
		fs.writeFileSync(filename, buf);
	}

	return process.dlopen(module, path._makeLong(filename));
};

var isInited = false;

module.exports = function (options) {
	if (isInited)
		return;
	isInited = true;

	options = options || {};
	if (options.preferPackedFiles) {
		preferPackedFiles = true;
	}

	init(options.packedFileName || 'nmisf-bundle');
}