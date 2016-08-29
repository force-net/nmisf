# nmisf (Node Modules in Single File)
This is proof-of-concept (but working) project for optimizing node projects by packing node_modules folder in one file (+1 file for index). As a result, faster project copying (due dramatically reduced number of files).

## Features

* Packs node_modules folder into 2 files (data and index)
* Packs only .js, .json and .node files (other files are excluded)
* Same files are deduplicated to reduce result size

## Usage

At first, you should download 2 files (nmisf.js and nmisf-bundler.js). 

_This project is intended to remove node_modules folder, so it is strange idea, to put files of this project into this folder by npm :)_

After obtaining files, you should run in main folder of your project:


```
node nmisf-bundler.js
```

This command will create nmisf-bundle.data and nmisf-bundle.index files with content of node_modules folder.
You can run nmisf-bundler with -h flag to see all available options.


After that, you should add next line at entry point of your application (first require of your start js-file):

```
require('./nmisf.js')();

```

This line will init nmisf module and will wrap node require method to use modules from this bundled files.
You can add options to nmisf:

```
require('./nmisf.js')({
	packedFileName: 'nmisf-bundle', // bundle file-name
	preferBundledFiles: false, // false: if real file was found, use real file. true: always use bundled file
	requireBundledFiles: false // false: if bundle not found found, try to use real file. true: throw exception
});

```


At last, remove node_modules folder and check that application works correctly.

## Restrictions
nmisf overrides only require method. Usually, this is enough for modules, but some libraries manunally search files into their folders (e.g. gulp).
So, if this library is for develop only - there are no problem for production. Otherwise, don't remove node_modules folder completely, leave this module intact).

## License

[MIT](https://github.com/force-net/nmisf/blob/develop/LICENSE) license