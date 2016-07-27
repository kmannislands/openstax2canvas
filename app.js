var fs = require('fs'), // file stream
    path = require('path'), // node path
    xml2js = require('xml2js'); // xml to json lib
var config = require('./config/config.js');

var sectionCT = 0, // count of found chapters
    imgCT = 0;  // and found images
var sectionList = [];

var parser = new xml2js.Parser(); // for parsing xml files when we get there

// Canvas functional client, thanks to canvas-lms.js
// github: https://github.com/rockymadden/canvas-lms.js/

var client = require('canvas-lms.js').client('https://canvas.example.com', config.canvas_api);

var diretoryTreeToObj = function(dir, done) {
    var results = [];

    fs.readdir(dir, function(err, list) {
        if (err)
            return done(err);

        var pending = list.length;

        if (!pending)
            return done(null, {name: path.basename(dir), type: 'folder', children: results});

        list.forEach(function(file) {
            file = path.resolve(dir, file);
            fs.stat(file, function(err, stat) {
                if (stat && stat.isDirectory()) {
                    diretoryTreeToObj(file, function(err, res) {
                        results.push({
                            name: path.basename(file),
                            type: 'folder',
                            children: res
                        });
                        if (!--pending)
                            done(null, results);
                    });
                }
                else {
                    var fileN = path.basename(file);
                    results.push({
                        type: 'file',
                        name: fileN
                    });
                    if (fileN === "index.cnxml") {
                      // index.cnxml's are sections in semantic xml
                      fs.readFile(file, function(err, data) {
                          // read the file, parse XML to JSON
                          parser.parseString(data, function (err, result) {
                              if (err) console.err(err);

                              sectionCT = sectionList.push({
                                title: result.document.title,
                                content: result.document.content
                              });
                          });
                      });
                    }
                    else if (fileN.includes(".jpg") || fileN.includes(".png")) imgCT++;
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
if (process.argv[2] && process.argv[3])  {
  readDir = process.argv[2];
  readRange = process.argv[3];
  console.log("Reading " + readDir + "...");
} else {
  console.log("Usage: node app.js <path-to-unzipped-openstax>");
  return;
}

// Use Async fs to create Json directory tree


diretoryTreeToObj(readDir, function(err, res){
    if(err) console.error(err);
    var jsonTree = res;
    console.log(sectionList);
    fs.writeFile(__dirname + "/cache/recent.JSON" , JSON.stringify(sectionList), function(err) {
        if(err) {
            return console.log(err);
        }

        console.log("The file was saved!");
    });
    console.log("Found " + sectionCT + " sections and " + imgCT + " images" );

});

client.withSession(function(canvas) {
  var create, update;
  create = {
    user: {
      name: 'create user'
    },
    pseudonym: {
      unique_id: 'user@example.com'
    }
  };
  update = {
    user: {
      name: 'update user'
    }
  };
  return canvas.postUser(1, create).then(function(response) {
    return response.fold((function() {
      return -1;
    }), (function(r) {
      return r.id;
    }));
  }).done();
});
