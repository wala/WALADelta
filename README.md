WALA Delta
==========

WALA Delta is a [delta debugger](http://www.st.cs.uni-saarland.de/dd/) for [WALA](http://wala.sf.net)-based JavaScript analyses. It is based on the [JS Delta](http://github.com/wala/jsdelta) package, and provides additional support specifically for debugging analyses using the WALA libraries.

*NOTE*: As of version 0.2.0, WALA Delta no longer includes generic delta debugging functionality, which has been factored out into the new JS Delta package. If you are using WALA Delta in a scenario independent of core WALA, you may consider using JS Delta instead.

Installation
------------

In the root directory of your checkout, invoke

```
npm install
```

to install the `jsdelta` module, which is currently the only dependency of WALADelta.

Usage
-----

WALA Delta provides a number of utility scripts to use with JS Delta. See the documentation of JS Delta for more general information on how test case minimization by delta debugging works.

Several predicates are provided for use with WALA's call-graph builder for JavaScript:

* `analysis_timeout.js` checks whether the WALA analysis completes within a given timeout.
* `analysis_error.js` checks if the WALA analysis terminates with a particular error message.
* `analysis_reachable.js` checks if the WALA analysis deems a specified method to be reachable.

To use these predicates, first save the `wala_paths-example.js` file as `wala_paths.js` and edit the paths appropriately to point to the root directory of your WALA workspace and the plugins directory of your Eclipse installation.

Variable `classpath` in `wala_runner.js` specifies which JARs to put into the classpath when invoking WALA. It uses the paths specified in `wala_paths.js` and should work out of the box with Eclipse 3.6. For other versions, you'll most likely have to adjust the names of the `org.eclipse.equinox.common`, `org.eclipse.core.runtime`, and `org.eclipse.osgi` JARs.

Once you are done, the WALA predicates can be invoked like this:

> node node_modules/jsdelta/delta.js file-to-reduce.js ./analysis_timeout.js

License
-------

WALA Delta is distributed under the Eclipse Public License.  See the LICENSE.txt file in the root directory or <a href="http://www.eclipse.org/legal/epl-v10.html">http://www.eclipse.org/legal/epl-v10.html</a>.  
