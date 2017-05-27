/* --------------------------------------------------------------------
 * Fill in module info here.
 */

var info = {
    entries: {
        "kubernetes/kubernetes": [
            "kubernetes/styles/main.less",
            "kubernetes/scripts/main.js",
        ],
    },


    files: [
        "kubernetes/manifest.json",
        "kubernetes/override.json",
        "kubernetes/index.html",
    ]
};

var externals = {
    "cockpit": "cockpit",
    "jquery": "jQuery",
};

/* ---------------------------------------------------------------------
 * Implementation
 */

var webpack = require("webpack");
var copy = require("copy-webpack-plugin");
var html = require('html-webpack-plugin');
var extract = require("extract-text-webpack-plugin");
var extend = require("extend");
var path = require("path");
var fs = require("fs");

/* For node 0.10.x we need this defined */
if (typeof(global.Promise) == "undefined")
    global.Promise = require('promise');

/* These can be overridden, typically from the Makefile.am */
var srcdir = process.env.SRCDIR || __dirname;
var builddir = process.env.BUILDDIR || __dirname;
var distdir = builddir + path.sep + "dist";
var libdir = path.resolve(srcdir, "pkg" + path.sep + "lib");
var bowerdir = path.resolve(srcdir, "bower_components");
var section = process.env.ONLYDIR || null;

/* A standard nodejs and webpack pattern */
var production = process.env.NODE_ENV === 'production';

/*
 * Note that we're avoiding the use of path.join as webpack and nodejs
 * want relative paths that start with ./ explicitly.
 *
 * In addition we mimic the VPATH style functionality of GNU Makefile
 * where we first check builddir, and then srcdir. In order to avoid
 * people having to run ./configure to hack on Cockpit we also help
 * resolve files that have a '.in' suffix if the resulting file
 * doesn't exist.
 */

function vpath(/* ... */) {
    var filename = Array.prototype.join.call(arguments, path.sep);
    var expanded = builddir + path.sep + filename;
    if (fs.existsSync(expanded))
        return expanded;
    expanded = srcdir + path.sep + filename;
    if (!fs.existsSync(expanded) && fs.existsSync(expanded + ".in"))
        return expanded + ".in";
    return expanded;
}

/* Qualify all the paths in entries */
Object.keys(info.entries).forEach(function(key) {
    if (section && key.indexOf(section) !== 0) {
        delete info.entries[key];
        return;
    }

    info.entries[key] = info.entries[key].map(function(value) {
        if (value.indexOf("/") === -1)
            return value;
        else
            return vpath("pkg", value);
    });
});

/* Qualify all the paths in files listed */
var files = [];
info.files.forEach(function(value) {
    if (!section || value.indexOf(section) === 0)
        files.push({ from: vpath("pkg", value), to: value });
});
info.files = files;

var plugins = [
    new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    }),
    new copy(info.files),
    new extract("[name].css")
    ];

var output = {
    path: distdir,
    filename: "[name].js",
    sourceMapFilename: "[file].map",
};

/* Only minimize when in production mode */
if (production) {
    plugins.unshift(new webpack.optimize.UglifyJsPlugin({
        beautify: true,
        compress: {
            warnings: false
        },
    }));

    /* Rename output files when minimizing */
    output.filename = "[name].min.js";
}


/* Just for the sake of tests, jquery.js and cockpit.js files */
if (!section || section.indexOf("base1") === 0) {
    files.push({
        from: srcdir + path.sep + "src/base1/cockpit.js",
        to: "base1/cockpit.js"
    }, {
        from: bowerdir + path.sep + "jquery/dist/jquery.js",
        to: "base1/jquery.js"
    }, {
        from: srcdir + path.sep + "po/po.js",
        to: "shell/po.js"
    });
}

module.exports = {
    resolve: {
        alias: {
            "angular": "angular/angular.js",
            "angular-route": "angular-route/angular-route.js",
            "d3": "d3/d3.js",
            "moment": "momentjs/moment.js",
            "react": "react-lite-cockpit/dist/react-lite.js",
            "term": "term.js-cockpit/src/term.js",
        },
        modulesDirectories: [ libdir, bowerdir ]
    },
    resolveLoader: {
        root: path.resolve(srcdir, 'node_modules')
    },
    entry: info.entries,
    output: output,
    externals: externals,
    plugins: plugins,

    devtool: "source-map",

    module: {
        preLoaders: [
            {
                test: /\.js$/, // include .js files
                exclude: /bower_components\/.*\/|\/node_modules/, // exclude external dependencies
                loader: "jshint-loader"
            },
            {
                test: /\.es6$/, // include .js files
                loader: "jshint-loader?esversion=6"
            },
            {
                test: /\.jsx$/,
                exclude: /bower_components\/.*\/|\/node_modules/, // exclude external dependencies
                loader: "eslint-loader"
            }
        ],
        loaders: [
            {
                test: /\.js$/,
                exclude: /bower_components\/.*\/|\/node_modules/,
                loader: 'strict' // Adds "use strict"
            },
            {
                test: /\.jsx$/,
                loader: "babel-loader"
            },
            {
                test: /\.es6$/,
                loader: "babel-loader"
            },
            {
                test: /\.css$/,
                loader: extract.extract("css-loader?minimize=&root=" + libdir)
            },
            {
                test: /\.less$/,
                loader: extract.extract("css-loader?sourceMap&minimize=!less-loader?sourceMap&compress=false&root=" + libdir)
            },
            {
                test: /views\/[^\/]+\.html$/,
                loader: "ng-cache?prefix=[dir]"
            },
            {
                test: /[\/]angular\.js$/,
                loader: "exports?angular"
            }
        ]
    },

    jshint: {
        emitErrors: true,
        failOnHint: true,
        latedef: "nofunc",
        sub: true,
        multistr: true,
        undef: true,
        unused: "vars",
        predef: [ "window", "document", "console" ],
    },
};
