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

// given a JS file, checks whether WALA finds a given edge in the call graph
// the edge should be passed as -edgeExists src_name:dst_name on the command line

var fs = require("fs"),
    wala = require('./wala_runner.js');

exports.init = function(args) {
    // this call passes on the -edgeExists argument to WALA
    wala.init(args);
};

exports.test = function(fn, k) {
    var stats = fs.statSync(fn);
    console.log("Testing candidate " + fn + " (" + stats.size + " bytes)");
    wala.analyse(fn,
		 function(error, stdout, stderr) {
		     // call continuation k with "true" if the analysis 
		     // deemed edge to exist, "false" if not or 
		     // an error or timeout occurred
		     var edgeExists = !error && (stdout.indexOf('EDGE EXISTS') !== -1);
		     fs.writeFileSync(fn + ".stdout", stdout);
		     fs.writeFileSync(fn + ".stderr", (error ? "Error: " + error : "") + stderr);
		     if(edgeExists)
			 console.log("    edge exists");
		     else if(error)
	                 console.log("    aborted with an error");
		     else
			 console.log("    edge not found");
		     k(edgeExists);
		 });
};
