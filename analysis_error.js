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

// given a JS file, checks whether WALA can analyse this file without throwing an error

var fs = require("fs"),
    wala = require('./wala_runner.js');

var msg = "";

exports.init = function(args) {
    var idx = args.indexOf('-msg');
    if(idx !== -1) {
	msg = args[idx+1];
	args.splice(idx, 2);
    }
    wala.init(args);
}

exports.test = function(fn, k) {
    var stats = fs.statSync(fn);
    console.log("Testing candidate " + fn + " (" + stats.size + " bytes)");
    wala.analyse(fn,
		 function(error, stdout, stderr) {
		     /* call continuation k with "true" if analysis completed
		      * with an error that contains 'msg', "false" otherwise */
		     fs.writeFileSync(fn + ".stdout", stdout);
		     fs.writeFileSync(fn + ".stderr", (error ? "Error: " + error : "") + stderr);
		     if(error) {
			 if(stderr.indexOf(msg) !== -1) {
	                     console.log("    aborted with an error");
			     k(true);
			 } else {
			     console.log("    aborted with irrelevant error");
			     k(false);
			 }
		     } else {
			 console.log("    completed");
			 k(false);
		     }
		 });
}