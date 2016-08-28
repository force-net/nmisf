var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var dirs = [];
var files = [];

var totalSize = 0;

var readAllFiles = function (baseDir) {
	fs.readdirSync(baseDir).forEach(function (e) {
		var p = baseDir + '/' + e;
		var s = fs.statSync(p);
		if (s.isDirectory()) {
			if (e !== 'test' || includeTestDirs) {
				dirs.push(p);
				readAllFiles(p);
			}
		}
		if (s.isFile()) {
			totalSize += s.size;
			if (/(\.js|\.json|\.node)$/.test(p))
				files.push(p);
		}
	})
}

console.log('nmisf-bundler');

var isHelp = process.argv.indexOf('--help') >= 0 || process.argv.indexOf('--h') >= 0 || process.argv.indexOf('-?') >= 0;

if (isHelp) {
	console.log('\tBundles node_modules folder into 2 files (data and index).');
	console.log('');
	console.log('\tOptions:');
	console.log('\t\t-h: This help');
	console.log('\t\t--bundle-name: Name of bundle (default nmisf-bundle)');
	console.log('\t\t--include-test-dirs: Include test dirs into bundle (default - not include)');
	console.log('\t\t--root-folder: Folder to bundlune (default - node modules)');
	process.exit(0);
}

var folderNameIdx = process.argv.indexOf('--root-folder');
var folderName = folderNameIdx > 0 ? process.argv[folderNameIdx + 1] : 'node_modules';

var bundleNameIdx = process.argv.indexOf('--bundle-name');
var bundleName = bundleNameIdx > 0 ? process.argv[bundleNameIdx + 1] : 'nmisf-bundle';
var includeTestDirs = process.argv.indexOf('--include-test-dirs') >= 0;

dirs.push(folderName);
readAllFiles(folderName);

var idxFile = fs.openSync(bundleName + '.index', 'w');
var bundleFile = fs.openSync(bundleName + '.data', 'w');

dirs.forEach(function (d) {
	fs.writeSync(idxFile, 'D' + d + '\r\n');
});

var filesInfo = {};
var offset = 0;

files.forEach(function (f) {
	// var s = fs.statSync(f);
	var buf = fs.readFileSync(f);
	var hash = crypto.createHash('sha256').update(buf).digest('hex');

	var hasFile = !!filesInfo[hash];

	var localOffset = hasFile ? filesInfo[hash] : offset;
	filesInfo[hash] = localOffset;
	fs.writeSync(idxFile, 'F' + buf.byteLength + ' ' + localOffset + ' ' + f + '\r\n');
	if (!hasFile) {
		fs.writeSync(bundleFile, buf, null, buf.byteLength);
		offset += buf.byteLength;
	}
});

fs.closeSync(idxFile);
fs.closeSync(bundleFile);

console.log();
console.log('Created ' + bundleName + ': ' + files.length + ' files, ' + offset + ' bytes. Orig folder size: ' + totalSize);