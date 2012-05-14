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

// given a JS file, checks whether WALA considers a given function reachable
// the name of the desired function should be passed on the command line as
// -reachable fn_name.  

var fs = require("fs"),
    wala = require('./wala_runner.js');

exports.init = function(args) {
    // this call passes on the -reachable argument to WALA
    wala.init(args);
};

exports.test = function(fn, k) {
    var stats = fs.statSync(fn);
    console.log("Testing candidate " + fn + " (" + stats.size + " bytes)");
    wala.analyse(fn,
		 function(error, stdout, stderr) {
		     // call continuation k with "true" if the analysis 
		     // deemed function to be reachable, "false" if it is unreachable or 
		     // an error occurred
		     var reachable = !error && (stdout.indexOf('REACHABLE') !== -1);
		     fs.writeFileSync(fn + ".stdout", stdout);
		     fs.writeFileSync(fn + ".stderr", (error ? "Error: " + error : "") + stderr);
		     if(reachable)
			 console.log("    reachable");
		     else if(error)
	                 console.log("    aborted with an error");
		     else
			 console.log("    unreachable");
		     k(reachable);
		 });
};
