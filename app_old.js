var fs = require('fs'), // file stream
    path = require('path'), // node path
    xml2js = require('xml2js'); // xml to json lib
var config = require('./config/config.js');

var sectionCT = 0, // count of found chapters
    imgCT = 0; // and found images
var sectionList = [];

var parser = new xml2js.Parser(); // for parsing xml files when we get there

// Canvas functional client, thanks to canvas-lms.js
// github: https://github.com/rockymadden/canvas-lms.js/

if (config.canvas_url && config.canvas_api)
  console.log("Connecting to " + config.canvas_url);
else console.log("Please create a config file. See README.md for instructions.");

// set up our canvas-lms client
var client = require('canvas-lms.js').client(config.canvas_url, config.canvas_api);

function read2JSON(file, afterFN) {
    // read the file, parse XML to JSON
    fs.readFile(file, function(err, data) {
        parser.parseString(data, afterFN);
    });
}

function cacheJSON(fileName, content, callback ) {
  // write a JSON object to the cache folder
  fs.writeFile(__dirname + "/cache/"+ fileName + ".JSON", JSON.stringify(content), function(err) {
      if (err) {
          return console.log(err);
      }
  });
}

// This function handles arrays and objects
function recurseJSON(obj, callback) {
    var chSecs = []; // chapter sections

    for (var k in obj) {
        if (typeof obj[k] == "object" && obj[k] !== null){
          if (k == "col:content") {
            // chapter level
            var chTitle = obj["md:title"][0];
            var chSections = obj["col:content"][0]["col:module"]; // the array of sections
            var chSectClean = ""; // cleaned section array
            for (var sect in chSections) {
              var sectPath = readDir+"/"+sect.$.document+"/";
            }
          }
          recurseJSON(obj[k], callback);
        } else {
            callback(k, obj[k]);
        }
    }
}

var directoryTreeToObj = function(dir, done) {
    var results = [];

    fs.readdir(dir, function(err, list) {
        if (err)
            return done(err);

        var pending = list.length;

        if (!pending)
            return done(null, {
                name: path.basename(dir),
                type: 'folder',
                children: results
            });

        list.forEach(function(file) {
            file = path.resolve(dir, file);
            fs.stat(file, function(err, stat) {
                if (stat && stat.isDirectory()) {
                    directoryTreeToObj(file, function(err, res) {
                        results.push({
                            name: path.basename(file),
                            type: 'folder',
                            children: res
                        });
                        if (!--pending)
                            done(null, results);
                    });
                } else {
                    var fileN = path.basename(file);
                    results.push({
                        type: 'file',
                        name: fileN
                    });
                    if (fileN === "collection.xml") {
                      read2JSON(file, function(err, result) {
                          if (err) console.err(err);
                          recurseJSON(result, function(key, value){
                              if (key == "document") {
                                // sections are enumerated here
                                sectionCT++;
                              } else {
                                // console.log(key+': ' + value);
                              }
                          });
                          cacheJSON("manifest", result, function(err) {
                            if (err) console.err(err);
                            console.log("Manifest written");
                          });
                      });
                        console.log("Found collection manifest!");
                    } else if (fileN === "index.cnxml") {
                        // index.cnxml's are sections in semantic xml
                        // we want to read them
                        read2JSON(file, function(err, result) {
                            if (err) console.err(err);

                            sectionCT++;
                            var section = {
                                // create a new object with just
                                // relevant specific info
                                title: result.document.title,
                                content: result.document.content
                            };
                            // persist that object as JSON
                            cacheJSON("recent-"+sectionCT, section, function(err) {
                              if (err) console.err(err);
                              // console.log("written");
                            });
                        });
                    } else if (fileN.includes(".jpg") || fileN.includes(".png")) imgCT++;
                    if (!--pending)
                        done(null, results);
                }
            });
        });
    });
};

// Let's handle reading our directory

var readDir, readRange; // path to directory and chapter range

// Get the command-line input:
if (process.argv[2] && process.argv[3]) {
    readDir = process.argv[2];
    readRange = process.argv[3];
    console.log("Reading " + readDir + "...");
} else {
    console.log("Usage: node app.js <path-to-unzipped-openstax> chapter-range");
    return;
}

// Use Async fs to create Json directory tree


directoryTreeToObj(readDir, function(err, res) {
    if (err) console.error(err);
    var jsonTree = res;
    console.log(sectionList);

    console.log("Found " + sectionCT + " sections and " + imgCT + " images");

});
