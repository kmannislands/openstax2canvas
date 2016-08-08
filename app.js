var fs = require('fs'), // file stream
    path = require('path'), // node path
    xml2js = require('xml2js'), // xml to json lib
    jsonQuery = require('json-query'), // json query plugin
    dirTree = require('directory-tree'), // for reading directory tree to JSON
    curl = require('curlrequest'), // curl wrapper
    cheerio = require('cheerio'); // barebones jQuery

var sectionCT = 0, // count of found chapters
    imgCT = 0; // and found images
var sectionList = [];


var parser = new xml2js.Parser(); // for parsing xml files when we get there

// set up our canvas-lms client
var config = require('./config/config.js'); // user-created config object

var headers = {
  Authorization: 'Bearer ' + config.canvas_api
};

// FUNCTION DEFINITIONS

function read2JSON(file, afterFN) {
    // read the file, parse XML to JSON
    fs.readFile(file, function(err, data) {
        parser.parseString(data, afterFN);
    });
}

function cacheFile(ext, fileName, content, callback ) {
  // write a JSON object to the cache folder
  fs.writeFile(__dirname + "/cache/"+ fileName + ext, JSON.stringify(content), 'ascii', callback);
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


//NOTE: Modify this array to switch tagnames
var replaceArr = {
  // pairings to replace in cnxml
  'md:title': 'title',
  'md:abstract': 'abstract',
  'list': 'ol',
  'item': 'li',
  'para': 'p',
  'image': 'img',
  'emphasis': 'em',
  'title': 'h2',
  'md:content-url': 'canonical',
  'link': 'embed',
  'quote': 'blockquote',
  'newline':'br'
};

function replacify(str, arr) {
  // fix encoding problems
  str = str.split("\n").join('');
  str = str.split("\r").join('');
  str = str.split("\"").join('"');
  str = str.replace(/\\"/g, '"');

  for (var term in arr) {
    var re = new RegExp('<'+term, 'g'),
        re2 = new RegExp("<\/"+term, 'g');

    str = str.replace(re, '<'+arr[term]); // open tags
    str = str.replace(re2, '</'+arr[term]); // close tags
  }
  return str;
}

function loadExtImgs(instance, spiderUrl, callback) {
  instance.request(spiderUrl, function (err, stdout, meta) {
    var $ = cheerio.load(stdout);
    var ImgUrls = [];
    $('img').each(function () {
      ImgUrls.push(spiderUrl + $(this).attr('src'));
    });
    callback(ImgUrls);
  });
}

function findMatch(currentValue) {
    return currentValue.includes(this);
}

var i = 0;
function parseHTML(indexPath, callback) {
  // read file
  var thisIndex = fs.readFileSync(indexPath, 'utf8');

  // clean the xml and create DOM
  var cleanCNXML = replacify(thisIndex, replaceArr),
      $ = cheerio.load(cleanCNXML); // load our xml to $


  var spiderUrl = $('canonical').html();
  var extUrls = loadExtImgs(curl, spiderUrl, function (extUrls) {

    var thisT = $('title').html();

    // move the abstract to the body
    $('content').prepend('<div class="abstract"></div>');
    $('content div.abstract').prepend($('metadata abstract').html());

    // Letter ol's in questions
    $('exercise ol').attr('style', 'list-style:upper-alpha;');

    // get rid of metadata shit
    $('metadata').empty().remove();

    // move image alt text to img
    $('media').each(function () {
      var altT = $(this).attr('alt').split(' ').join('_');
      var thisSrc = $(this).find('img').attr('src');
      var newUrl = extUrls.find(findMatch, thisSrc);
      $(this).find('img').attr('src', newUrl).attr('alt',altT);
    });
    var figCt = 1;

    // merge note labels into header
    $('note').each(function () {
      var lblTxt = $(this).find('label').html();
      $(this).prepend('<h2> ' + lblTxt + ': </h2>');
      $(this).find('label').remove();
    });
    // swap external links for proper anchor elements
    $('note').prepend('<hr>').append('<hr>');
    $('note').find('embed').each(function () {
      var linkText = $(this).parent().html();
      linkText = linkText.split('url').join('href').split('embed').join('a');
      $(this).parent().replaceWith(linkText);
    });

    // number pictures as figures
    $('figure').each(function () {
        if ($(this).find('caption').length) {
        $(this).find('caption').prepend('<b class="fig-num" data-fig='+figCt+'> Figure ' + figCt + ': </b>');
        $(this).find('caption').attr('style', 'float:left;clear:both;max-width:100%;');
        figCt++;
        var figCap = $(this).find('media').nextAll().html();
        $(this).find('media').nextAll().remove();
        $(this).append('<div class=caption style=width:100%;text-align:left;>'+figCap+'</div>');
      }
    });

    // link embedded references to figures
    $('embed').each(function () {
        var corrsp = $(this).attr('target-id');
        if (corrsp === undefined) return;
        var figNum = $('figure#'+corrsp).find('b.fig-num').attr('data-fig');
        $(this).replaceWith('<a href="#'+corrsp+'"> Figure '+ figNum + '</a>');
    });
    $('img').each(function () {
      $(this).attr('style','display:inline-block');
      $(this).parent('style', 'text-align:center');
    });

    // style abstract a little
    $('div.abstract').attr('style','background-color:#efefef;color:#232323;padding:30px;');

    $('figure').prepend('<hr>').append('<hr>');

    var noteCT = 0;
    $('note').each(function (content) {
      if ($(this).find('h2').html().includes('Click and Explore')) $(this).find('img').attr('style', 'max-width:69px;');
      $(this).after('<div class=note id="note-'+noteCT+'" ></div>'); // make a spot for the Notes
      $('#note-'+noteCT++).html($(this).html()); // fill new div with note html
      $(this).remove(); // remove old note
    });

    $('.summary').prepend('<hr>');
    $('.review-questions').prepend('<hr>');

    // append attr text
    $('content').append('<div><hr><h2 class="medium-header">Attribution</h2><p><span>© May 18, 2016</span> <span><span class="list-comma">OpenStax</span>.</span> <span>Textbook content produced by <span><span class="list-comma">OpenStax</span></span> is licensed under a <a href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution License 4.0</a> license. </span></p><p>Download for free at <a href="http://cnx.org/contents/a7ba2fb8-8925-4987-b182-5f4429d48daa@3.30">http://cnx.org/contents/a7ba2fb8-8925-4987-b182-5f4429d48daa@3.30.</a></p></div>');

    var outStr = $('content').html();
    outStr = outStr.split(/"/g).join('');
    cacheFile('.html','section-'+i++, outStr);
    var parsedHtml =  {
      title: thisT,
      body: outStr
    };
    callback(parsedHtml);
  });
}

function postPage(instance, title, content) {
    var pageObj = {
        'wiki_page[title]': title,
        'wiki_page[body]': content,
        'wiki_page[editing_roles]': 'teachers',
        'wiki_page[notify_of_update]': false,
        'wiki_page[published]': true,
        'wiki_page[front_page]': false
    };

    var specUrl = config.canvas_url + "/api/v1/courses/" + config.course_id + "/pages";
    // make first curl request to obtain upload location, etc.
    instance.request({
        url: specUrl,
        method: "POST",
        timeout: 15,
        retries: 3,
        data: pageObj,
        headers: headers
    }, function(err, stdout, meta) {
        // console.log(stdout); // log response
        // console.log('%s %s', meta.cmd, meta.args.join(' ')); // log curl req
    });
}

// Canvas LMS API is not returning the required 'expires' param
// for file upload to their custom aws cloudfront as of 8/3/16
// so upload fails. Spidering CNX links for now instead

// function uploadImage(instance, file, course_id) {
//   // file needs two params: size and path
//   var size = file.size;
//   file = file.path;
//
//   // now set up our upload object as in https://canvas.instructure.com/doc/api/file.file_uploads.html
//   var fileN = path.basename(file), type;
//   if (fileN.includes('jpg') || fileN.includes('png')) type = 'image/jpg';
//   else if (fileN.includes('png')) type = 'image/png';
//   var fileObj = {
//     name: fileN,
//     size: size,
//     content_type: type,
//     parent_folder_path: path.dirname(file)
//   };
//
//   var specUrl = config.canvas_url + "/api/v1/courses/" + config.course_id +  "/files";
//   // make first curl request to obtain upload location, etc.
//   instance.request({
//     url: specUrl,
//     method: "POST",
//     timeout: 15,
//     retries: 3,
//     data: fileObj,
//     headers: headers
//   }, function(err, stdout, meta){
//     // uncomment to show curl request for debugging
//     // console.log('%s %s', meta.cmd, meta.args.join(' '));
//     if (err) console.log(err);
//     // console.log(stdout);
//     var curlresponse = JSON.parse(stdout);
//     cacheFile('.json', 'response-1', curlresponse);
//     // console.log(curlresponse);
//     var uploadUrl = curlresponse.upload_url; // real target url for upload
//     var fileparams = curlresponse.upload_params; // copy params
//     fileparams.file = '@'+file; // add the file
//     console.log(fileparams);
//     instance.request({
//       url: uploadUrl,
//       method: "POST",
//       data: fileparams
//     }, function(err, stdout, meta) {
//         // console.log('%s %s', meta.cmd, meta.args.join(' '));
//         // callback from actual upload
//         console.log(stdout);
//       });
//
//   });
// }

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
    start: parseInt(readRange[0]) -1,
    stop: parseInt(readRange[1])
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

  var chapterList = {chapters: []};
  var chapCt = 1, title;

  content.chapters.forEach(function(chapter){
    var sectArr = []; // open a new array to store section objects
    var sectCt = 0; // reset the section count
    chapter.sections[0].sectionsArr.forEach(function(sect) {
      imgArr = jsonQuery('children.path',{
        data: dirTree(readDir + "/" +sect.$.document),
        locals: helpers
      }).value.filter(isImg);
      var title = chapCt + "." + sectCt++ + " " + sect.title[0];
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

  chapterList.chapters = chapterList.chapters.slice(readRange.start, readRange.stop); // now let's limit by chapter range

  cacheFile('.json', 'chapter-structure', chapterList, function() {
    // we've assembled a nice JSON skeleton of our book now
    // let's start images uploading and parse html
    var imgUrlArr = jsonQuery('chapters.sections.imgs', {
      data: chapterList
    }).value;

    // get all the section paths and start parsing
    var allTitles = jsonQuery('chapters.sections.title', {data:chapterList}).value;
    var allSectPaths = jsonQuery('chapters.sections.path', {
      data: chapterList
    }).value.forEach(function(currentValue, index, arr){
      // var thisB = parseHTML(currentValue, responseArr);
      var thisB = parseHTML(currentValue, function (thisB) {
        console.log(allTitles[index]);
        postPage(curl, allTitles[index], thisB.body);
      });
    });
  });
});
