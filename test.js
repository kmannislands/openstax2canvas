// curl wrapper for node... cool
var curl = require('curlrequest'),
    path = require('path');
var config = require('./config/config.js'); // user-created config object

uploadImage(curl, {
  path:'/Users/kieranjarrett/Desktop/test.png',
  size: 966716
}, 1046762);

function uploadImage(instance, thisfile, course_id) {
  // file needs two params: size and path
  var size = thisfile.size;
  thispath = thisfile.path;

  // now set up our upload object as in https://canvas.instructure.com/doc/api/file.file_uploads.html
  var fileN = path.basename(thispath);
  var type;
  if (fileN.includes('jpg') || fileN.includes('png')) type = 'image/jpg';
  else if (fileN.includes('png')) type = 'image/png';
  var fileObj = {
    name: fileN,
    size: size,
    content_type: type,
    parent_folder_path: path.dirname(thispath)
  };
  console.log(fileObj);

  // reader our Auth header
  var headers = {
    Authorization: 'Bearer 7~BaGay2cGSbRcP1iEGEqhEvTms3rt7hlzRYzYauXAI39zuYhYr1MOlndirJpORmbj'
  };
  var specUrl = config.canvas_url + "/api/v1/courses/" + config.course_id +  "files";
  // make first curl request to obtain upload location, etc.
  instance.request({
    url: specUrl,
    data: fileObj,
    headers: headers
  }, function(err, stdout){
    if (err) console.log(err);
    // console.log(stdout);
    console.log('%s %s', meta.cmd, meta.args.join(' '));
  });
}
