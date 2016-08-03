var fs = require('fs'), // file stream
    path = require('path'), // node path
    xml2js = require('xml2js'), // xml to json lib
    jsonQuery = require('json-query'), // json query plugin
    dirTree = require('directory-tree'), // for reading directory tree to JSON
    curl = require('curlrequest'), // curl wrapper
    cheerio = require('cheerio'); // barebones jQuery for the server

var sectionCT = 0, // count of found chapters
    imgCT = 0; // and found images
var sectionList = [];


var parser = new xml2js.Parser(); // for parsing xml files when we get there



// set up our canvas-lms client
var config = require('./config/config.js'); // user-created config object
// var client = require('canvas-lms.js').client(config.canvas_url, config.canvas_api);

// FUNCTION DEFINITIONS

function read2JSON(file, afterFN) {
    // read the file, parse XML to JSON
    fs.readFile(file, function(err, data) {
        parser.parseString(data, afterFN);
    });
}

function cacheFile(ext, fileName, content, callback ) {
  // write a JSON object to the cache folder
  fs.writeFile(__dirname + "/cache/"+ fileName + ext, JSON.stringify(content), callback);
}

function swapKeys(json, replace) {
  for (var rep in replace) {
    // iterate through replace pairings and replace
    json = JSON.parse(JSON.stringify(json).split(rep).join(replace[rep]));
  }
  return json;
}

function isImg(input) {
  fpath = input.toString();
  if (fpath.includes('.jpg') || fpath.includes('.png')) return fpath;
}

// function uploadImgs(client, array) {
//   var create = {
//     name: "test.png",
//     size: 966716,
//     content_type: 'image/jpeg',
//     parent_folder: "/Users/kieranjarrett/Desktop"
//   };
//   client.withSession(function(canvas) {
//     return canvas.postCourseFile(config.course_id, create).done(function(r) {
//       console.log(r.fold());
//     });
//   });
// }

var replaceArr = {
  // pairings to replace in cnxml
  'md:title': 'title',
  'md:abstract': 'abstract',
  'list': 'ul',
  'item': 'li',
  'para': 'p',
  'image': 'img',
  'emphasis': 'em'
};

function replacify(str, arr) {
  str.replace('&#10;', '');
  for (var term in arr) {
    str.replace('<'+term, '<'+arr[term]); // open tags
    str.replace('</'+term, '</'+arr[term]); // close tags
  }
  return str;
}

var i = 0;
function parseHTML(indexPath) {
  var cleanCNXML = replacify(fs.readFileSync(indexPath, 'utf8'), replaceArr),
      $ = cheerio.load(cleanCNXML); // load our xml to $
  cacheFile('.xml','section-'+i++,cleanCNXML);
  console.log($('title').text());
}

function uploadImage(instance, file, course_id) {
  // file needs two params: size and path
  var size = file.size;
  file = file.path;

  // now set up our upload object as in https://canvas.instructure.com/doc/api/file.file_uploads.html
  var fileN = path.basename(file), type;
  if (fileN.includes('jpg') || fileN.includes('png')) type = 'image/jpg';
  else if (fileN.includes('png')) type = 'image/png';
  var fileObj = {
    name: fileN,
    size: size,
    content_type: type,
    parent_folder_path: path.dirname(file)
  };

  // reader our Auth header
  var headers = {
    Authorization: 'Bearer 7~BaGay2cGSbRcP1iEGEqhEvTms3rt7hlzRYzYauXAI39zuYhYr1MOlndirJpORmbj'
  };
  var specUrl = config.canvas_url + "/api/v1/courses/" + config.course_id +  "/files";
  // make first curl request to obtain upload location, etc.
  instance.request({
    url: specUrl,
    method: "POST",
    timeout: 15,
    retries: 3,
    data: fileObj,
    headers: headers
  }, function(err, stdout, meta){
    // uncomment to show curl request for debugging
    // console.log('%s %s', meta.cmd, meta.args.join(' '));
    if (err) console.log(err);
    // console.log(stdout);
    var curlresponse = JSON.parse(stdout);
    cacheFile('.json', 'response-1', curlresponse);
    // console.log(curlresponse);
    var uploadUrl = curlresponse.upload_url; // real target url for upload
    var fileparams = curlresponse.upload_params; // copy params
    fileparams.file = '@'+file; // add the file
    console.log(fileparams);
    instance.request({
      url: uploadUrl,
      method: "POST",
      data: fileparams
    }, function(err, stdout, meta) {
        // console.log('%s %s', meta.cmd, meta.args.join(' '));
        // callback from actual upload
        console.log(stdout);
      });

  });
}

// END FUNCTION DEFINITONS

// jsonQuery helpers

var helpers = {
  get: function(input, key) {
    return input[key];
  }
};

// Let's handle reading our directory

var readDir, readRange; // path to directory and chapter range

// Get the command-line input:
if (process.argv[2] && process.argv[3]) {
    readDir = process.argv[2];
    readRange = process.argv[3].split("-");
    readRange = {
      start: readRange[0],
      stop: readRange[1]
    };
    console.log("Reading " + readDir + " for "+ (readRange.stop - readRange.start) +" chapters...");
} else {
    console.log("Usage: node app.js <path-to-unzipped-openstax> chapter-range");
    return;
}

// if we've made it this far, we got valid parameters & config options
var treeStructure = dirTree(readDir, ['.jpg','.png','.xml','.cnxml']); // JSON file structure

var manifestPath = jsonQuery('children[name=collection.xml]', {
  data: treeStructure
}).value.path; // get long absolute path to collection.xml

console.log("Found manifest at: " + manifestPath); // found our manifest file in the tree

var manifestJ = read2JSON(manifestPath, function(err, data){
  if (err) console.log(err);

  // filter out the main textbook contents
  // to include foreword contents, step back to col:content
  var content = data['col:collection']['col:content'][0]['col:subcollection'];

  content = {
      chapters : swapKeys(content,  {
      // replace problematic xml entity names for querying
      'md:title': 'title',
      'col:content': 'sections',
      'col:module': 'sectionsArr'
    })
  };

  // cacheFile('.json', 'structure', content); // TODO remove raw structure cache

  var chapterList = {chapters: []};
  var chapCt = 1, title;

  content.chapters.forEach(function(chapter){
    var sectArr = []; // open a new array to store section objects
    var sectCt = 1; // reset the section count
    chapter.sections[0].sectionsArr.forEach(function(sect) {
      imgArr = jsonQuery('children.path',{
        data: dirTree(readDir + "/" +sect.$.document),
        locals: helpers
      }).value.filter(isImg);
      if (sect.title[0] == "Introduction") title = sect.title[0];
      else title = chapCt + "." + sectCt++ + " " + sect.title[0];
      var thisSect = {
        title: title,
        path: readDir + "/" +sect.$.document + "/index.cnxml",
        imgs: imgArr
      };
      sectArr.push(thisSect);
    });
    var thisCh = {
      title: chapter.title[0],
      sections: sectArr
    };
    chapterList.chapters.push(thisCh);
    chapCt++;
  });
  cacheFile('.json', 'chapter-structure', chapterList, function() {
    // we've assembled a nice JSON skeleton of our book now
    // let's start images uploading and parse html
    // var imgUrlArr = uploadImgs(client, jsonQuery('chapters.sections.imgs', {
    //   data: chapterList
    // }).value); // hopefully 2xX containing location urls
    // uploadImage(curl, {
    //   path:'/Users/kieranjarrett/Desktop/test.png',
    //   size: 966716
    // }, 1046762);

    // get all the section paths and start parsing
    var allSectPaths = jsonQuery('chapters.sections.path', {
      data: chapterList
    }).value.forEach(function(currentValue, index, arr){
      parseHTML(currentValue);
    });
  });
});
