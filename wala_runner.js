/*******************************************************************************
 * Copyright (c) 2012 IBM Corporation.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/

// runs the WALA JavaScript analysis on a given JavaScript file

var fs = require("fs"),
    exec = require("child_process").exec,
    paths = require("./wala_paths.js"),
    wala_root = paths.wala_root,
    eclipse_plugins = paths.eclipse_plugins,
    tmp_dir = require("./config.js").tmp_dir;

// dummy driver file for WALA
var driver_file = tmp_dir + "/driver.html";

// classpath to run TestUtil from the command line
var classpath =
    [wala_root + "/com.ibm.wala.core/bin",
     wala_root + "/com.ibm.wala.shrike/bin",
     wala_root + "/com.ibm.wala.util/bin",
     wala_root + "/com.ibm.wala.ide/bin",
     wala_root + "/com.ibm.wala.cast.js/bin",
     wala_root + "/com.ibm.wala.cast.js.rhino/bin",
     wala_root + "/com.ibm.wala.cast.js.rhino/lib/js.jar",
     wala_root + "/com.ibm.wala.cast.js.test/bin",
     wala_root + "/com.ibm.wala.cast.js.rhino.test/bin",
     wala_root + "/com.ibm.wala.cast.js/lib/jericho-html-3.2.jar",
     wala_root + "/com.ibm.wala.cast/bin",
     wala_root + "/com.ibm.wala.cast.test/bin",
     eclipse_plugins + "/org.eclipse.equinox.common_3.6.0.v20110523.jar",
     eclipse_plugins + "/org.eclipse.core.runtime_3.7.0.v20110110.jar",
     eclipse_plugins + "/org.eclipse.osgi_3.7.1.R37x_v20110808-1106.jar",
     eclipse_plugins + "/org.junit_4.8.2.v4_8_2_v20110321-1705/junit.jar"];

var max_heap = "-Xmx1024M";
var timeout = 30;
var enable_assertions = false;
var reachable_name = null;
var edge_caller_callee = null;

// process command line arguments
exports.init = function(args) {
    for(var i=0;i<args.length;++i) {
	if(args[i].match(/^-Xmx/)) {
	    max_heap = args[i];
	} else if(args[i] === '-timeout' && i+1 < args.length) {
	    timeout = args[++i];
	} else if(args[i] === '-ea') {
	    enable_assertions = true;
	} else if(args[i] === '-reachable' && i+1 < args.length) {
            reachable_name = args[++i];
        } else if(args[i] === '-edgeExists' && i+1 < args.length) {
            edge_caller_callee = args[++i];
        } 
    }
};

// process the given file, then invoke the continuation
exports.analyse = function(fn, k) {
    // build command line
    var cmd = ["java", enable_assertions ? "-ea" : "",
               max_heap,
               "-classpath", classpath.join(':'),
               "com.ibm.wala.cast.js.rhino.test.HTMLCGBuilder",
	       "-timeout", timeout+"",
               reachable_name === null ? "" : "-reachable " + reachable_name,
               edge_caller_callee === null ? "" : "-edgeExists " + edge_caller_callee,
               "-src", driver_file].join(' ');
    // populate driver file
    fs.writeFileSync(driver_file,
		     "<html>"
		   + "  <head>"
		   + "    <title></title>"
		   + "    <script type='text/javascript' src='" + fn + "'></script>"
		   + "  </head>"
		   + "  <body></body>"
		   + "</html>");
    // run WALA
    exec(cmd, { maxBuffer: 4*1024*1024 }, k);
};
