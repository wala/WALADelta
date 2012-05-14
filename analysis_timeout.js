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

// given a JS file, checks whether WALA can analyse this file without hitting a given timeout

var fs = require("fs"),
    wala = require('./wala_runner.js');

exports.init = function(args) {
    wala.init(args);
};

exports.test = function(fn, k) {
    var stats = fs.statSync(fn);
    console.log("Testing candidate " + fn + " (" + stats.size + " bytes)");
    wala.analyse(fn,
		 function(error, stdout, stderr) {
		     // call continuation k with "true" if the analysis 
		     // timed out, "false" if it completed normally or with 
		     // an error
		     var timeout = !error && (stdout.indexOf('TIMED OUT') !== -1);
		     fs.writeFileSync(fn + ".stdout", stdout);
		     fs.writeFileSync(fn + ".stderr", (error ? "Error: " + error : "") + stderr);
		     if(timeout)
			 console.log("    timed out");
		     else if(error)
	             console.log("    aborted with an error");
		     else
			 console.log("    completed");
		     k(timeout);
		 });
};
