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

var fs = require("fs"),
    jsp = require("uglify-js").parser,
    pro = require("uglify-js").uglify,
    util = require("util"),
    config = require(__dirname + "/config.js"),
    combinators = require(__dirname + "/combinators.js"),
    exec = require("child_process").exec,
    optimist = require("optimist"),
    If = combinators.If,
    Foreach = combinators.Foreach;

var argv = optimist.demand(1)
                   .boolean('quick').alias('q', 'quick')
                   .string('cmd')
                   .string('errmsg')
                   .usage('Usage: $0 [-q|--quick] [--cmd COMMAND] [--timeout TIMEOUT] [--errmsg ERRMSG] FILE [PREDICATE] OPTIONS...')
                   .argv;

var quick = argv.quick,
    file = argv._[0],
    predicate = argv._.length > 1 ? require(argv._[1]) : {},
    predicate_args = argv._.slice(2);

var ast = jsp.parse(fs.readFileSync(file, 'utf-8'));

if(typeof predicate.init === 'function')
    predicate.init(predicate_args);

if(!predicate.test) {
    predicate.cmd = predicate.cmd || argv.cmd;
    if(!predicate.cmd) {
	console.error("No test command specified.");
	process.exit(-1);
    }

    if(typeof predicate.checkResult !== 'function') {
	if(argv.errmsg) {
	    predicate.checkResult = function(error, stdout, stderr, time) {
		if(stderr && stderr.indexOf(argv.errmsg) !== -1) {
		    console.log("    aborted with relevant error");
		    return true;
		} else if(error) {
		    console.log("    aborted with other error");
		    return false;
		} else {
		    console.log("    completed successfully");
		    return false;
		}
	    };
	} else if(argv.timeout) {
	    predicate.checkResult = function(error, stdout, stderr, time) {
		if(error && error.signal === 'SIGTERM') {
		    console.log("    killed by SIGTERM");
		    return true;
		} else if(error) {
		    console.log("    aborted with other error");
		    return false;
		} else {
		    console.log("    completed successfully (" + time + "ms)");
		    return false;
		}
	    };
	} else {
	    predicate.checkResult = function(error, stdout, stderr, time) {
		if(error) {
		    console.log("    aborted with error");
		    return true;
		} else {
		    console.log("    completed successfully");
		    return false;
		}
	    };
	}
    }

    predicate.timeout = predicate.timeout || argv.timeout;
    predicate.test = function(fn, k) {
	var stats = fs.statSync(fn);
	console.log("Testing candidate " + fn + " (" + stats.size + " bytes)");
	var start = new Date();
	var options = { maxBuffer : 4*1024*1024	};
	if(predicate.timeout)
	    options.timeout = predicate.timeout;
	exec(predicate.cmd + " " + fn, options, 
	     function(error, stdout, stderr) {
		 var end = new Date();
		 fs.writeFileSync(fn + ".stdout", stdout);
		 fs.writeFileSync(fn + ".stderr", (error ? "Error: " + error : "") + stderr);
		 k(predicate.checkResult(error, stdout, stderr, end - start));
             });
    };
}

function log_debug(msg) {
    // console.log(msg);
}

// check whether the given file exists
// TODO: this is a bit rough; surely someone has written a module to do this?
function exists(f) {
    try {
	fs.statSync(f);
	return true;
    } catch(e) {
	return false;
    }
}

// determine a suitable temporary directory
var tmp_dir;
for(var i=0;
    exists(tmp_dir=config.tmp_dir+"/tmp"+i);
    ++i);
fs.mkdirSync(tmp_dir);

// keep track of the number of attempts so far
var round = 0;
// the smallest test case so far is kept here
var smallest = tmp_dir + "/minimise_js_smallest.js";
function getTempFileName() {
    var fn = tmp_dir + "/minimise_js_" + round + ".js";
    ++round;
    return fn;
}

function typeOf(nd) {
    if(nd && typeof nd === 'object' && typeof nd[0] === 'string')
	return nd[0];
    return null;
}

// TODO: CPS makes this function horribly convoluted; can we rewrite it using combinators?
function minimise_array(array, k, nonempty, twolevel) {
    // helper function to minimise all elements of the array
    // if 'twolevel' is set, the children of the elements are minimised rather
    // than the elements themselves
    function children_loop(i, k) {
	if(!k)
	    throw new TypeError("no continuation");
	if(i >= array.length) {
	    k();
	} else {
	    if(twolevel) {
		(function grandchildren_loop(j, k) {
		     if(!k)
			 throw new TypeError("no continuation");
		     if(!array[i] || j >= array[i].length) {
			 k();
		     } else {
			 minimise(array[i][j], array[i], j,
				  function() { grandchildren_loop(j+1, k); });
		     }
		 })(0, (function() { children_loop(i+1, k); }));
	    } else {
		minimise(array[i], array, i,
			 function() { children_loop(i+1, k); });
	    }
	}
    }

    log_debug("minimising array " + util.inspect(array, false, 1));
    if(!nonempty && array.length === 1) {
	// special case: if there is only one element, try removing it
	var elt = array[0];
	array.length = 0;
	test(function(succ) {
		 if(!succ)
		     // didn't work, need to put it back
		     array[0] = elt;
		 children_loop(0, k);
	     });
    } else {
	if(!k)
	    throw new TypeError("no continuation");
	// try removing as many chunks of size sz from array as possible
	// once we're done, switch to size sz/2; if size drops to zero,
	// recursively invoke minimise on the individual elements
	// of the array
	(function outer_loop(sz, k) {
	     if(!k)
		 throw new TypeError("no continuation");
	     if(sz <= 0) {
		 k();
	     } else {
		 log_debug("  chunk size " + sz);
		 var nchunks = Math.floor(array.length/sz);
		 (function inner_loop(i, k) {
		      if(!k)
			  throw new TypeError("no continuation");
		      if(i < 0) {
			  k();
		      } else {
			  // try removing chunk i
			  log_debug("    chunk #" + i);
			  var lo = i*sz,
			  hi = i===nchunks-1 ? array.length : (i+1)*sz;
			  var chunk = array.slice(lo, hi);

			  // avoid creating empty array if nonempty is set
			  if(nonempty && lo === 0 && hi === array.length) {
			      inner_loop(i-1, k);
			  } else {
			      array.splice(lo, hi-lo);
			      test(function(succ) {
				       if(!succ) {
					   // didn't work, need to put it back
					   Array.prototype.splice.apply(array, 
									[lo,0].concat(chunk));
				       }
				       inner_loop(i-1, k);
				   });
			  }
		      }
		  })(nchunks-1,
		     function() { outer_loop(Math.floor(sz/2), k); });
	     }
	 })(Math.floor(array.length/2),
	    function() { children_loop(0, k); });
    }
}

function minimise(nd, parent, idx, k) {
    log_debug("minimising " + util.inspect(nd));
    if(!k)
	throw new TypeError("no continuation");
    var ndtp = typeOf(nd);
    if(ndtp === "toplevel") {
	MinimiseArray(nd, 1)(k);
    } else if(ndtp === "block") {
	// knock out as many statements in the block as possible
	// if we end up with a single statement, replace the block with
	// that statement
	If(nd[1], MinimiseArray(nd, 1).
	          Then(If(function() { return !quick && nd[1].length === 1; },
		  	  function(k) { Replace(parent, idx).With(nd[1][0])(k); })))(k);
    } else if(ndtp === "defun" || ndtp === "function") {
	// try removing the function name, shrinking the parameter list, and shrinking the body; if the body ends up being a block, inline it
	If(!quick && ndtp === 'function' && !nd[1], Replace(nd, 1).With(null)).
        Then(If(!quick, MinimiseArray(nd, 2))).
	Then(MinimiseArray(nd, 3)).
	Then(If(function() { return !quick && nd[3].length === 1 && nd[3][0][0] === 'block'; },
	        function(k) { Replace(nd, 3).With(nd[3][0][1])(k); }))(k);
    } else {
	// match other node types only if we're not doing quick minimisation
	// if quick is set, !quick && ndtp will be undefined, so the
	// default branch is taken
	switch(!quick && ndtp) {
	case "string":
	case "num":
	case "regexp":
	    // try replacing with '0' or the empty string
	    Replace(parent, idx).With(["num", 0]).
	    OrElse(Replace(parent, idx).With(["string", ""]))(k);
	    break;
	case "unary-postfix":
	case "unary-prefix":
	    // try replacing with operand
	    Replace(parent, idx).With(nd[2]).
	      AndThen(Minimise(parent, idx)).
	      OrElse(Minimise(nd, 2))(k);
	    break;
	case "assign":
	case "binary":
	    Replace(parent, idx).With(nd[2]).
	      AndThen(Minimise(parent, idx)).
	      OrElse(Replace(parent, idx).With(nd[3]).
		       AndThen(Minimise(parent, idx)).
		       OrElse(Minimise(nd, 2).Then(Minimise(nd, 3))))(k);
	    break;
	case "return":
	    Replace(nd, 1).With(null).OrElse(Minimise(nd, 1))(k);
	    break;
	case "call":
	case "new":
	    Minimise(nd, 1).Then(MinimiseArray(nd, 2))(k);
            break;	
	case "array":
	    MinimiseArray(nd, 1)(k);
	    break;
	case "object":
            MinimiseArray(nd, 1, false, true)(k);	    
	    break;	
	case "if":
	case "conditional":
	    Replace(parent, idx).With(nd[2]).
	      AndThen(Minimise(parent, idx)).
	      OrElse(If(nd[3], Replace(parent, idx).With(nd[3])).
  		       AndThen(Minimise(parent, idx)).
		       OrElse(Minimise(nd, 1).
			      Then(Minimise(nd, 2).
			      Then(Minimise(nd, 3)))))(k);
	    break;
	case "var":
	    MinimiseArray(nd, 1, true, true)(k);
	    break;
	case "switch":
	    // minimise condition, then knock out cases
	    // TODO: simplify cases
	    Minimise(nd, 1).Then(MinimiseArray(nd, 2))(k);
	    break;
	case "for":
	    // try replacing with body, otherwise try removing init/cond/update
	    // and then simplify them
	    // TODO: do we want to be this elaborate?
	    // Replace(parent, idx).With(nd[4]).
	    //     AndThen(Minimise(parent, idx)).
	    //     OrElse(Replace(nd, 1).With(null).
	    //            Then(Replace(nd, 2).With(null)).
	    //            Then(Replace(nd, 3).With(null)).
	    //            Then(Minimise(nd, 1)).
	    //            Then(Minimise(nd, 2)).
	    //            Then(Minimise(nd, 3)).
	    //            Then(Minimise(nd, 4)))(k);
            // MS edited to not replace loop with body and not simplify init,
            // to help preserve some var declarations
		       Replace(nd, 2).With(null).
		       Then(Replace(nd, 3).With(null)).
		       Then(Minimise(nd, 1)).
		       Then(Minimise(nd, 2)).
		       Then(Minimise(nd, 3)).
		       Then(Minimise(nd, 4))(k);
	    break;
	default:
	    if(nd && Array.isArray(nd))
		Foreach((0).upto(nd.length-1),
			function(i) { return Minimise(nd, i); })(k);
	    else
		k();
	}
    }
}

function writeTempFile() {
    var pp = pro.gen_code(ast, { beautify: true });
    var fn = getTempFileName();
    fs.writeFileSync(fn, pp);
    return fn;
}

function test(k) {
    if(!k)
	throw new TypeError("no continuation");
    var fn = writeTempFile();
    predicate.test(fn, function(succ) {
	// if the test succeeded, save it to file 'smallest'
	if(succ)
	    fs.writeFileSync(smallest, pro.gen_code(ast, { beautify: true }));
	k(succ);
    });
}

// save a copy of the original input
var orig = getTempFileName(),
    input = fs.readFileSync(file, 'utf-8');
fs.writeFileSync(orig, input);
fs.writeFileSync(smallest, input);

// get started
predicate.test(orig,
    function(succ) {
        if(succ) {
	    minimise(ast, null, -1,
	       function() {
		   console.log("Minimisation finished; "
			     + "final version is in " + smallest);
		   process.exit(0);
	    });
	} else {
	    console.error("Original file doesn't satisfy predicate.");
	    process.exit(-1);
	}
    });

// combinators; eventually we want to write the above using these
function Minimise(nd, idx) {
    return function(k) {
	minimise(nd[idx], nd, idx, k);
    };
}

function MinimiseArray(nd, idx, nonempty, twolevel) {
    return function(k) {
	minimise_array(nd[idx], k, nonempty, twolevel);
    };
}

function Replace(nd, idx) {
    var oldval = nd[idx];
    return {
	With: function(newval) {
	    return function(k) {
		if(oldval === newval) {
		    k(true);
		} else {
		    nd[idx] = newval;
		    test(function(succ) {
			     if(succ) {
				 k(true);
			     } else {
				 nd[idx] = oldval;
				 k(false);
			     }
			 });
		}
	    };
	}
    };
}

// other things to implement:
//  - replace f(e) by either f or e